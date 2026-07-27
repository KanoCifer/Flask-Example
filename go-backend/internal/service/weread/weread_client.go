// Package weread 封装微信读书开放 API 的客户端与业务逻辑。
package weread

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"maps"
	"net/http"
	"time"

	"github.com/KanoCifer/kuroome-blog/internal/infra/httpclient"
	"github.com/redis/go-redis/v9"
)

var (
	// ErrUpstream 微信读书上游返回错误。
	ErrUpstream = fmt.Errorf("[weread] upstream failed")
	// ErrUnauthorized 用户微信读书授权已过期或无效。
	ErrUnauthorized = fmt.Errorf("[weread] unauthorized or token expired")
)

const (
	skillVersion = "1.0.3"
	baseURL      = "https://i.weread.qq.com/api/agent/gateway"
	maxRetry     = 3
)

var defaultHeaders = map[string]string{
	"Content-Type": "application/json",
}

// Client 封装微信读书 API 的 HTTP 调用、鉴权和缓存。
type Client struct {
	http         *httpclient.Client
	redis        *redis.Client
	repo         Repositoryer
	baseURL      string
	skillVersion string
	headers      map[string]string
}

// ClientOption 配置 Client（函数选项模式，便于测试注入）。
type ClientOption func(*Client)

// WithBaseURL 覆盖默认 baseURL（测试用）。
func WithBaseURL(url string) ClientOption {
	return func(c *Client) {
		c.baseURL = url
	}
}

// NewClient 构造微信读书 HTTP 客户端。
func NewClient(httpCli *httpclient.Client, redisCli *redis.Client, repo Repositoryer, opts ...ClientOption) *Client {
	c := &Client{
		http:         httpCli,
		redis:        redisCli,
		repo:         repo,
		baseURL:      baseURL,
		skillVersion: skillVersion,
		headers:      defaultHeaders,
	}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

// BuildPayload 构造请求 Payload 和鉴权 Header。
func (c *Client) BuildPayload(ctx context.Context, userID string, apiName string, extraData ...map[string]any) (map[string]any, map[string]string) {
	token, _ := c.repo.GetUserToken(ctx, userID)
	slog.DebugContext(ctx, "weread token", "userID", userID, "token", token)
	payload := map[string]any{
		"skill_version": skillVersion,
		"api_name":      apiName,
	}
	for _, data := range extraData {
		if data != nil {
			maps.Copy(payload, data)
		}
	}

	authHeader := map[string]string{
		"Authorization": fmt.Sprintf("Bearer %s", token),
	}
	maps.Copy(authHeader, c.headers)

	slog.DebugContext(ctx, "weread build payload", "payload", payload, "authHeader", authHeader)

	return payload, authHeader
}

// InvalidateCache 删除一个缓存 key，用于 refresh=true 时强制下一次 SendRequest 走上游。
// 空 key / nil redis 直接返回 nil 不报错。
func (c *Client) InvalidateCache(ctx context.Context, cacheKey string) error {
	if c.redis == nil || cacheKey == "" {
		return nil
	}
	return c.redis.Del(ctx, cacheKey).Err()
}

// SendRequest 发送 POST 请求到微信读书 API，带 Redis 缓存和重试。
// 缓存命中时直接返回；未命中则请求上游，写回缓存后返回。
func (c *Client) SendRequest(ctx context.Context, cacheKey string, ttl time.Duration, userID string, apiName string, extraData ...map[string]any) (json.RawMessage, error) {
	// 缓存命中
	cachedResp, err := c.redis.Get(ctx, cacheKey).Bytes()
	if err == nil {
		slog.DebugContext(ctx, "weread cache hit", "cache_key", cacheKey)
		return json.RawMessage(cachedResp), nil
	}

	payload, authHeader := c.BuildPayload(ctx, userID, apiName, extraData...)

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("%w: marshal payload: %w", ErrUpstream, err)
	}

	newReq := func() (*http.Request, error) {
		req, err := http.NewRequestWithContext(
			ctx,
			http.MethodPost,
			c.baseURL,
			bytes.NewReader(payloadBytes), // 每次都是新的 Reader
		)
		if err != nil {
			return nil, err
		}

		for k, v := range authHeader {
			req.Header.Set(k, v)
		}

		return req, nil
	}

	resp, err := doWithRetry(ctx, c.http, newReq)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrUpstream, err)
	}
	slog.DebugContext(ctx, "weread request", "api_name", apiName, "status", resp.StatusCode)

	if resp.StatusCode == http.StatusUnauthorized {
		return nil, fmt.Errorf("%w: status=%d", ErrUnauthorized, resp.StatusCode)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("%w: status=%d", ErrUpstream, resp.StatusCode)
	}

	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("%w: read body: %w", ErrUpstream, err)
	}

	// 同步写回缓存:确保响应返回前缓存已落定,避免 ctx 取消 / 测试 rdb.Close() 导致丢写。
	if c.redis != nil {
		if err := c.redis.Set(ctx, cacheKey, body, ttl).Err(); err != nil {
			slog.WarnContext(ctx, "weread cache write failed", "cache_key", cacheKey, "error", err)
		}
	}

	return json.RawMessage(body), nil
}

func doWithRetry(
	ctx context.Context,
	cli *httpclient.Client,
	newReq func() (*http.Request, error),
) (*http.Response, error) {
	var (
		resp *http.Response
		err  error
	)

	for i := 0; i <= maxRetry; i++ {
		req, reqErr := newReq()
		if reqErr != nil {
			return nil, reqErr
		}

		resp, err = cli.Do(ctx, req)
		if err == nil && resp.StatusCode < 500 {
			return resp, nil
		}

		if resp != nil {
			resp.Body.Close()
		}

		if i < maxRetry {
			backoff := time.Duration(i+1) * time.Second

			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(backoff):
			}
		}
	}

	if err != nil {
		return nil, err
	}

	return resp, nil
}
