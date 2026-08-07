package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/KanoCifer/kuroome-blog/internal/infra/httpclient"
	"github.com/redis/go-redis/v9"
)

const ExchangeApi = "https://api.exchangerate.fun/latest"

type ClientOption func(*CurrencyClient)

// WithBaseURL 覆盖默认上游地址（测试注入用）。
func WithBaseURL(url string) ClientOption {
	return func(c *CurrencyClient) {
		c.baseURL = url
	}
}

type CurrencyClient struct {
	http    *httpclient.Client
	redis   *redis.Client
	baseURL string
}

func NewCurrencyClient(
	http *httpclient.Client,
	redis *redis.Client,
	opts ...ClientOption,
) *CurrencyClient {
	c := &CurrencyClient{
		http:    http,
		redis:   redis,
		baseURL: ExchangeApi,
	}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

func (c *CurrencyClient) GetExchange(ctx context.Context, baseCurrency string, cacheKey string, ttl time.Duration) (raw json.RawMessage, err error) {

	if c.redis != nil {
		cached, err := c.redis.Get(ctx, cacheKey).Bytes()
		if err == nil && len(cached) > 0 {
			slog.DebugContext(ctx, "currency exchange cache hit", "cache_key", cacheKey)
			return cached, nil
		}
	}

	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL, nil)
	if err != nil {
		return nil, fmt.Errorf("[Currency] build req failed %w", err)
	}

	q := req.URL.Query()
	q.Set("base", baseCurrency)
	req.URL.RawQuery = q.Encode()

	resp, err := doWithRetry(ctx, c.http, req)
	if err != nil {
		return nil, fmt.Errorf("Get Exchange failed %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("currency upstream failed: status=%d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read body err %w", err)
	}

	if c.redis != nil {
		go func() {
			cacheCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()

			err := c.redis.Set(cacheCtx, cacheKey, body, ttl).Err()
			if err != nil {
				slog.ErrorContext(cacheCtx, "currency write cache fail", "cache_key", cacheKey, "error", err)
			}
		}()
	}

	return body, nil

}
