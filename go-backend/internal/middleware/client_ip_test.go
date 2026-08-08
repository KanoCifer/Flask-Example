package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

// TestRealClientIPMiddleware 验证真实 IP 解析：仅可信反代的 X-Forwarded-For 末段
// 被采纳，直连 / 不可信来源一律忽略转发头按对端 IP 处理。
func TestRealClientIPMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name       string
		trusted    []string // 传入中间件的可信代理列表
		remoteAddr string   // RemoteAddr（对端 IP）
		xff        string   // X-Forwarded-For 头
		xrip       string   // X-Real-IP 头
		want       string
	}{
		{
			name:       "trusted proxy, XFF last segment wins",
			trusted:    []string{"127.0.0.1"},
			remoteAddr: "127.0.0.1:5555",
			xff:        "203.0.113.7, 10.0.0.1",
			want:       "10.0.0.1",
		},
		{
			name:       "trusted proxy, single XFF value",
			trusted:    []string{"127.0.0.1"},
			remoteAddr: "127.0.0.1:5555",
			xff:        "203.0.113.7",
			want:       "203.0.113.7",
		},
		{
			name:       "trusted proxy, empty XFF falls back to X-Real-IP",
			trusted:    []string{"127.0.0.1"},
			remoteAddr: "127.0.0.1:5555",
			xrip:       "203.0.113.9",
			want:       "203.0.113.9",
		},
		{
			name:       "trusted proxy via CIDR network",
			trusted:    []string{"10.0.0.0/8"},
			remoteAddr: "10.1.2.3:5555",
			xff:        "198.51.100.7, 172.16.0.9",
			want:       "172.16.0.9",
		},
		{
			name:       "untrusted source ignores forged XFF",
			trusted:    []string{"127.0.0.1"},
			remoteAddr: "198.51.100.2:5555",
			xff:        "6.6.6.6",
			want:       "198.51.100.2",
		},
		{
			name:       "no forwarding headers returns remote",
			trusted:    []string{"127.0.0.1"},
			remoteAddr: "127.0.0.1:5555",
			want:       "127.0.0.1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := gin.New()
			r.Use(RealClientIPMiddleware(tt.trusted))
			r.GET("/", func(c *gin.Context) {
				c.String(http.StatusOK, ClientIP(c))
			})

			w := httptest.NewRecorder()
			req, _ := http.NewRequest("GET", "/", nil)
			req.RemoteAddr = tt.remoteAddr
			if tt.xff != "" {
				req.Header.Set("X-Forwarded-For", tt.xff)
			}
			if tt.xrip != "" {
				req.Header.Set("X-Real-IP", tt.xrip)
			}
			r.ServeHTTP(w, req)

			if got := w.Body.String(); got != tt.want {
				t.Errorf("ClientIP() = %q, want %q", got, tt.want)
			}
		})
	}
}
