package handler

import (
	"encoding/base64"
	"log/slog"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/KanoCifer/kuroome-blog/internal/config"
	"github.com/KanoCifer/kuroome-blog/internal/response"
)

// AmapHandler 处理高德地图安全密钥请求（公开接口，无需鉴权）。
type AmapHandler struct {
	cfg *config.Config
}

func NewAmapHandler(cfg *config.Config) *AmapHandler {
	return &AmapHandler{cfg: cfg}
}

// GetSecurityKey 返回 base64 编码的高德安全密钥。
//
// 安全说明：
//  1. 高德 JS API 的 securityJsCode 是绑定域名的标识符，不是私密密钥
//  2. 真正的密钥是 Web Key（后端持有），用于服务端 API 调用
//  3. 已配置来源验证，限制只有合法前端才能获取
func (h *AmapHandler) GetSecurityKey(c *gin.Context) {
	origin := c.GetHeader("Origin")
	if origin == "" {
		origin = c.GetHeader("Referer")
	}

	// Origin 存在时才校验；空 Origin（如非浏览器客户端）直接放行。
	if origin != "" && !h.isAllowedOrigin(origin) {
		slog.WarnContext(c.Request.Context(), "amap security key: forbidden origin", "origin", origin)
		response.APIError(c, "Forbidden: invalid origin", http.StatusForbidden)
		return
	}

	encoded := base64.StdEncoding.EncodeToString([]byte(h.cfg.Amap.SecurityCode))
	response.Success(c, gin.H{"securityJsCode": encoded})
}

// isAllowedOrigin 检查 origin 是否在允许列表中（子串匹配，与 Python 端一致）。
func (h *AmapHandler) isAllowedOrigin(origin string) bool {
	for _, allowed := range h.cfg.Amap.KeyAllowedOrigins {
		if strings.Contains(origin, allowed) {
			return true
		}
	}
	return false
}

// RegisterRoutes 挂载高德路由到 v3 组。
func (h *AmapHandler) RegisterRoutes(r *gin.RouterGroup) {
	r.GET("/amap/security-key", h.GetSecurityKey)
}
