package handler

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/KanoCifer/kuroome-blog/internal/dto"
	"github.com/KanoCifer/kuroome-blog/internal/response"
	"github.com/KanoCifer/kuroome-blog/internal/service/weread"
)

// Wereader 定义 handler 依赖的 weread 业务接口。
type Wereader interface {
	CreateUserToken(ctx context.Context, userID string, token string) error
	FetchUserShelf(ctx context.Context, userID string) (*dto.WereadShelfResponse, error)
}

// WereadHandler 处理微信读书相关请求。
type WereadHandler struct {
	svc Wereader
}

// NewWereadHandler 构造 WereadHandler。
func NewWereadHandler(svc Wereader) *WereadHandler {
	return &WereadHandler{svc: svc}
}

func (h *WereadHandler) ImportUserToken(c *gin.Context) {
	var req dto.WereadTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.APIError(c, "无效的请求", http.StatusBadRequest)
		return
	}
	userID := strconv.Itoa(c.GetInt("user_id"))
	if userID == "0" {
		response.APIError(c, "未授权", http.StatusUnauthorized)
		return
	}
	if err := h.svc.CreateUserToken(c.Request.Context(), userID, req.Data); err != nil {
		slog.ErrorContext(c.Request.Context(), "weread import token", "error", err)
		response.APIError(c, "导入失败", http.StatusInternalServerError)
		return
	}
	response.Success(c, nil, "导入成功")
}

// GetShelf 获取当前登录用户的微信读书书架数据。
func (h *WereadHandler) GetShelf(c *gin.Context) {
	userID := strconv.Itoa(c.GetInt("user_id"))
	if userID == "0" {
		response.APIError(c, "未授权", http.StatusUnauthorized)
		return
	}

	data, err := h.svc.FetchUserShelf(c.Request.Context(), userID)
	if err != nil {
		slog.ErrorContext(c.Request.Context(), "weread fetch shelf", "error", err)
		if errors.Is(err, weread.ErrUnauthorized) {
			response.APIError(c, "微信读书授权已过期", http.StatusUnauthorized)
			return
		}
		response.APIError(c, "获取书架失败", http.StatusInternalServerError)
		return
	}

	response.Success(c, data, "书架获取成功")
}

// RegisterRoutes 挂载 weread 路由，所有接口需登录鉴权。
func (h *WereadHandler) RegisterRoutes(r *gin.RouterGroup, authMW gin.HandlerFunc) {
	g := r.Group("/weread")
	g.Use(authMW)
	g.POST("/user-info", h.ImportUserToken)
	g.GET("/shelf", h.GetShelf)
}
