package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

// RateLimiter 是一个用 Redis 滑动窗口实现的简易限流器。
//
// key 策略: rl:{scope}:{identifier}, 其中 identifier 通常是客户端 IP。
// 窗口内累计请求数 → 超限返回 429 + Retry-After。
type RateLimiter struct {
	redis   *redis.Client
	scope   string                    // 限流维度名, 如 "login", "register"
	limit   int                       // 窗口内最大请求数
	window  time.Duration             // 窗口大小
	keyFunc func(*gin.Context) string // 自定义 key 生成, 默认 ClientIP
}

// RateOption 用于 NewRateLimiter 的函数选项。
type RateOption func(*RateLimiter)

// WithKeyFunc 替换默认的 ClientIP key 生成函数。
func WithKeyFunc(fn func(*gin.Context) string) RateOption {
	return func(r *RateLimiter) { r.keyFunc = fn }
}

// NewRateLimiter 构造一个限流器。
func NewRateLimiter(redis *redis.Client, scope string, limit int, window time.Duration, opts ...RateOption) *RateLimiter {
	rl := &RateLimiter{
		redis:   redis,
		scope:   scope,
		limit:   limit,
		window:  window,
		keyFunc: func(c *gin.Context) string { return ClientIP(c) },
	}
	for _, opt := range opts {
		opt(rl)
	}
	return rl
}

// Middleware 返回 gin 中间件函数。
func (rl *RateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if rl.redis == nil {
			c.Next()
			return
		}
		key := fmt.Sprintf("rl:%s:%s", rl.scope, rl.keyFunc(c))
		ok, err := rl.allow(c, key)
		if err != nil {
			// Redis 故障时放行(避免服务完全不可用)
			c.Next()
			return
		}
		if !ok {
			c.Header("Retry-After", strconv.Itoa(int(rl.window.Seconds())))
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": "请求过于频繁, 请稍后再试",
			})
			return
		}
		c.Next()
	}
}

// allow 使用 Redis INCR + TTL 滑动窗口。
func (r *RateLimiter) allow(c *gin.Context, key string) (bool, error) {
	ctx := redisContext(c)
	pipe := r.redis.Pipeline()
	incr := pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, r.window)
	_, err := pipe.Exec(ctx)
	if err != nil {
		return false, err
	}
	return incr.Val() <= int64(r.limit), nil
}

// redisContext 从 gin context 透传, 没有就用 Background。
func redisContext(c *gin.Context) context.Context {
	if ctx := c.Request.Context(); ctx != nil {
		return ctx
	}
	return context.Background()
}
