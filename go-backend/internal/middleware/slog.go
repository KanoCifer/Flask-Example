// Package middleware 提供 gin 中间件：slog 结构化请求日志。
package middleware

import (
	"log/slog"
	"time"

	"github.com/gin-gonic/gin"
)

// SlogMiddleware 在每个请求完成后输出一行结构化 access log。
// 与 Trace 中间件协作：Trace 先把 trace_id 存入 gin Context（c.Set），
// 这里再读出绑定到本条 record，保证 access log 与 handler 日志的 trace_id 一致。
//
// 字段对齐 Gin 官方 structured-logging 推荐 schema：
// method / path / query / status / latency / client_ip / body_size。
func SlogMiddleware(logger *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 跳过 CORS preflight，避免噪音。
		if c.Request.Method == "OPTIONS" {
			c.Next()
			return
		}

		start := time.Now().UTC()
		path := c.Request.URL.Path
		query := c.Request.URL.RawQuery

		c.Next()

		// 绑定 trace_id（Trace 中间件已写入，缺省空串）。
		log := logger.With("trace_id", c.GetString("trace_id"))

		log.Info("request",
			slog.String("method", c.Request.Method),
			slog.String("path", path),
			slog.String("query", query),
			slog.Int("status", c.Writer.Status()),
			slog.Duration("latency", time.Since(start)),
			slog.String("client_ip", ClientIP(c)),
			slog.Int("body_size", c.Writer.Size()),
		)

		if len(c.Errors) > 0 {
			for _, err := range c.Errors {
				log.Error("request error",
					slog.String("error", err.Error()),
					slog.String("type", errType(err.Type)),
				)
			}
		}
	}
}

// errType 把 gin.ErrorType 转为可读字符串，仅用于日志字段。
func errType(t gin.ErrorType) string {
	switch t {
	case gin.ErrorTypeBind:
		return "bind"
	case gin.ErrorTypeRender:
		return "render"
	case gin.ErrorTypePrivate:
		return "private"
	case gin.ErrorTypePublic:
		return "public"
	case gin.ErrorTypeAny:
		return "any"
	default:
		return "unknown"
	}
}
