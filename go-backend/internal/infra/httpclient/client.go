// Package httpclient 提供可复用的 HTTP 客户端基础设施，集成 trace_id 传播
// 与出站请求日志。service 层通过它发出外部请求，避免各自内联构造
// *http.Client，统一超时、trace 串联与可观测性。
//
// 典型用法：
//
//	cli := httpclient.New(httpclient.WithTimeout(10*time.Second))
//	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
//	resp, err := cli.Do(ctx, req)
package httpclient

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/KanoCifer/kuroome-blog/internal/logger"
)

// defaultTimeout 出站请求默认超时。
const defaultTimeout = 10 * time.Second

// Client 封装 *http.Client，在 Do 时自动：
//   - 把 ctx 中的 trace_id 注入 X-Trace-Id 请求头，与 Trace 中间件串联；
//   - 记录 method / url / status / latency 结构化日志。
//
// Client 被设计为无状态、可并发使用。service 层把它作为字段持有，
// 由 appstate 构造并注入。
type Client struct {
	base   *http.Client
	logger *slog.Logger
}

// Option 配置 Client。
type Option func(*Client)

// WithTimeout 覆盖默认超时。
func WithTimeout(d time.Duration) Option {
	return func(c *Client) {
		c.base.Timeout = d
	}
}

// WithLogger 覆盖默认 logger（默认 slog.Default()）。
func WithLogger(l *slog.Logger) Option {
	return func(c *Client) {
		c.logger = l
	}
}

// New 构造一个 Client。
func New(opts ...Option) *Client {
	c := &Client{
		base:   &http.Client{Timeout: defaultTimeout},
		logger: slog.Default(),
	}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

// Do 发送请求。传入的 req 应当已通过 http.NewRequestWithContext 绑定
// ctx，这样 trace_id 才能被正确传播。
//
// Do 会：
//  1. 从 ctx 读取 trace_id 并写入 req 的 X-Trace-Id 头（若存在）；
//  2. 记录一条结构化日志，包含 method / url / status / latency；
//  3. 返回底层 *http.Client 的原始响应与错误，由调用方负责关闭 Body。
func (c *Client) Do(ctx context.Context, req *http.Request) (*http.Response, error) {
	if id, ok := logger.TraceIDFromContext(ctx); ok && id != "" {
		req.Header.Set("X-Trace-Id", id)
	}

	start := time.Now()
	resp, err := c.base.Do(req)
	latency := time.Since(start)

	if err != nil {
		c.logger.Error("outbound request failed",
			slog.String("method", req.Method),
			slog.String("url", req.URL.Redacted()),
			slog.Duration("latency", latency),
			slog.Any("error", err),
		)
		return resp, err
	}

	c.logger.Info("outbound request",
		slog.String("method", req.Method),
		slog.String("url", req.URL.Redacted()),
		slog.Int("status", resp.StatusCode),
		slog.Duration("latency", latency),
	)
	return resp, nil
}
