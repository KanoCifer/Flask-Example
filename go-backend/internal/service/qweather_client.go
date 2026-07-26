package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/KanoCifer/kuroome-blog/internal/infra/httpclient"
	"github.com/KanoCifer/kuroome-blog/pkg/qweather"
)

var (
	// ErrInvalidLocation 请求未提供 location 或 location_id。
	ErrInvalidLocation = errors.New("weather: must provide location or location_id")
	// ErrUpstream QWeather 上游返回非 2xx 状态码（封装 status）。
	ErrUpstream = errors.New("weather: upstream QWeather returned error")
	// ErrUnavailable 网络错误、超时或读取 body 失败（封装底层原因）。
	ErrUnavailable = errors.New("weather: QWeather unavailable")
)

// qweatherClient 封装"鉴权 + 缓存 + HTTP"三合一，对外只暴露
// Get / ResolveLocation。file-private，handler 只看到 Weatherer interface。
//
// 复用 internal/infra/httpclient.Client 的 trace_id 注入与出站日志，
// 不另起 *http.Client。
//
// 日志直接走 slog.InfoContext 等顶层函数（logger.Init 已 SetDefault，
// trace_id 由 routerHandler 从 ctx 提取并注入记录）。
type qweatherClient struct {
	http   *httpclient.Client
	redis  *redis.Client
	base   string
	signer *qweather.Signer
	now    func() time.Time // 注入时钟，便于测试 JWT iat/exp
}

// newQWeatherClient 构造 qweatherClient。
func newQWeatherClient(
	http *httpclient.Client,
	redis *redis.Client,
	base string,
	signer *qweather.Signer,
) *qweatherClient {
	return &qweatherClient{
		http:   http,
		redis:  redis,
		base:   base,
		signer: signer,
		now:    time.Now,
	}
}

// Get 发起鉴权 + 缓存的 GET 请求，行为对齐 Python 端
// _QWeatherClient.get(...)：
//  1. Redis GET cacheKey；命中直接返回；
//  2. 未命中则签名/取 JWT，构造请求头 Authorization: Bearer <token>；
//  3. 通过 httpclient.Client.Do 发出请求（自动注入 X-Trace-Id）；
//  4. 非 2xx → ErrUpstream；网络/读取错误 → ErrUnavailable；
//  5. 成功后 SET cacheKey 写回 redis。
//
// 返回的 json.RawMessage 是上游原始 payload，handler 可直接转发或继续解析。
func (c *qweatherClient) Get(
	ctx context.Context,
	path string,
	params map[string]string,
	cacheKey string,
	ttl time.Duration,
) (json.RawMessage, error) {
	// 1. cache hit
	if c.redis != nil {
		cached, err := c.redis.Get(ctx, cacheKey).Bytes()
		if err == nil && len(cached) > 0 {
			slog.DebugContext(ctx, "qweather cache hit", "cache_key", cacheKey)
			return cached, nil
		}
	}

	// 2. JWT（优先 redis 缓存）
	token, err := c.signer.Cached(ctx, c.redis, 24*time.Hour, c.now())
	if err != nil {
		return nil, fmt.Errorf("qweather: get jwt: %w", err)
	}

	// 3. construct request
	url := c.base + path
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("qweather: build request: %w", err)
	}
	q := req.URL.Query()
	for k, v := range params {
		q.Set(k, v)
	}
	req.URL.RawQuery = q.Encode()
	req.Header.Set("Authorization", "Bearer "+token)

	// 4. send
	resp, err := c.http.Do(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrUnavailable, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("%w: status=%d", ErrUpstream, resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("%w: read body: %v", ErrUnavailable, err)
	}

	// 5. cache write
	if c.redis != nil {
		_ = c.redis.Set(ctx, cacheKey, body, ttl).Err()
	}
	return body, nil
}

// ResolveLocation 校验位置输入并返回 (effective value, params)：
//   - locID 非空优先；
//   - 其次 loc；
//   - 两者都为空 → ErrInvalidLocation（handler 映射 400）。
func (c *qweatherClient) ResolveLocation(loc, locID *string) (string, map[string]string, error) {
	if locID != nil && *locID != "" {
		return *locID, map[string]string{"location": *locID}, nil
	}
	if loc != nil && *loc != "" {
		return *loc, map[string]string{"location": *loc}, nil
	}
	return "", nil, ErrInvalidLocation
}
