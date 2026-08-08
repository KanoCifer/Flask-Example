package handler

import (
	"errors"
	"io"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/KanoCifer/kuroome-blog/internal/config"
	"github.com/KanoCifer/kuroome-blog/internal/dto"
	"github.com/KanoCifer/kuroome-blog/internal/middleware"
	"github.com/KanoCifer/kuroome-blog/internal/response"
	"github.com/KanoCifer/kuroome-blog/internal/service"
)

var errNotNumber = errors.New("not a number")

type MonitorHandler struct {
	svc service.Monitorer
	cfg *config.Config
}

func NewMonitorHandler(svc service.Monitorer, cfg *config.Config) *MonitorHandler {
	return &MonitorHandler{svc: svc, cfg: cfg}
}

const (
	defaultDays = 7
	maxDays     = 90
)

// bindDays 解析并校验 days 查询参数（1..90，默认 7）。
func bindDays(c *gin.Context) (int, bool) {
	days := defaultDays
	if daysStr := c.Query("days"); daysStr != "" {
		var d int
		if _, err := ginStrAtoi(daysStr, &d); err != nil || d < 1 || d > maxDays {
			response.APIError(c, "days must be an integer between 1 and 90", http.StatusBadRequest)
			return 0, false
		}
		days = d
	}
	return days, true
}

func ginStrAtoi(s string, out *int) (int, error) {
	n := 0
	for _, ch := range s {
		if ch < '0' || ch > '9' {
			return 0, errNotNumber
		}
		n = n*10 + int(ch-'0')
	}
	*out = n
	return n, nil
}

// bindPagination 解析 page / page_size（page>=1, 1<=page_size<=100）。
func bindPagination(c *gin.Context) (page, pageSize int, ok bool) {
	page = 1
	pageSize = 20
	if v := c.Query("page"); v != "" {
		var d int
		if _, err := ginStrAtoi(v, &d); err != nil || d < 1 {
			response.APIError(c, "page must be a positive integer", http.StatusBadRequest)
			return 0, 0, false
		}
		page = d
	}
	if v := c.Query("page_size"); v != "" {
		var d int
		if _, err := ginStrAtoi(v, &d); err != nil || d < 1 || d > 100 {
			response.APIError(c, "page_size must be an integer between 1 and 100", http.StatusBadRequest)
			return 0, 0, false
		}
		pageSize = d
	}
	return page, pageSize, true
}

// GetOverview 处理 GET /status/overview。
func (h *MonitorHandler) GetOverview(c *gin.Context) {
	days, ok := bindDays(c)
	if !ok {
		return
	}
	data, err := h.svc.GetOverview(c.Request.Context(), days)
	if err != nil {
		response.APIError(c, err.Error(), http.StatusInternalServerError)
		return
	}
	response.Success(c, data, "Visitor overview data retrieved successfully")
}

// GetVisitors 处理 GET /status/visitors。
func (h *MonitorHandler) GetVisitors(c *gin.Context) {
	days, ok := bindDays(c)
	if !ok {
		return
	}
	page, pageSize, ok := bindPagination(c)
	if !ok {
		return
	}
	data, err := h.svc.GetVisitors(c.Request.Context(), days, page, pageSize)
	if err != nil {
		response.APIError(c, err.Error(), http.StatusInternalServerError)
		return
	}
	response.Success(c, data, "Visitor list retrieved successfully")
}

// GetUserLogins 处理 GET /status/user-logins。
func (h *MonitorHandler) GetUserLogins(c *gin.Context) {
	days, ok := bindDays(c)
	if !ok {
		return
	}
	page, pageSize, ok := bindPagination(c)
	if !ok {
		return
	}
	data, err := h.svc.GetUserLogins(c.Request.Context(), days, page, pageSize)
	if err != nil {
		response.APIError(c, err.Error(), http.StatusInternalServerError)
		return
	}
	response.Success(c, data, "User login logs retrieved successfully")
}

// ServerStatus 处理 GET /status/server/status，返回实时 CPU/内存/磁盘指标。
func (h *MonitorHandler) ServerStatus(c *gin.Context) {
	data, err := h.svc.GetServerStatus()
	if err != nil {
		response.APIError(c, err.Error(), http.StatusInternalServerError)
		return
	}
	response.Success(c, data, "Server status retrieved successfully")
}

// ServerStatusStream 处理 GET /status/server/status/stream，通过 SSE 每 5s
// 推送一帧 server status payload，对齐 Python EventSourceResponse。
func (h *MonitorHandler) ServerStatusStream(c *gin.Context) {
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")

	ch, err := h.svc.StreamServerStatus(c.Request.Context())
	if err != nil {
		response.APIError(c, err.Error(), http.StatusInternalServerError)
		return
	}

	c.Stream(func(w io.Writer) bool {
		select {
		case <-c.Request.Context().Done():
			return false
		case data, ok := <-ch:
			if !ok {
				return false
			}
			c.SSEvent("message", data)
			return true
		}
	})
}

// TrackVisitor 处理 POST /status/track —— 记录访客追踪数据（公开，无需鉴权）。
func (h *MonitorHandler) TrackVisitor(c *gin.Context) {
	if !h.cfg.Admin.EnableTracking {
		c.Status(204)
		return
	}
	var req dto.VisitorTrackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.APIError(c, err.Error())
		return
	}
	req.IpAddress = middleware.ClientIP(c)
	if err := h.svc.TrackVisitor(c.Request.Context(), req); err != nil {
		slog.ErrorContext(c.Request.Context(), "track visitor", "error", err)
		response.APIError(c, err.Error(), 500)
		return
	}
	c.Status(204)
}

// GetStatusDetail 处理 GET /status/detail —— 返回版本、服务、系统状态概览（公开）。
func (h *MonitorHandler) GetStatusDetail(c *gin.Context) {
	data, err := h.svc.GetStatusDetail(c.Request.Context())
	if err != nil {
		response.APIError(c, err.Error(), http.StatusInternalServerError)
		return
	}
	response.Success(c, data, "Status detail retrieved successfully")
}

// RegisterRoutes 挂载 monitor 端点。
// 监控统计走 auth + admin 鉴权；访客追踪（/status/track）和状态详情（/status/detail）公开。
func (h *MonitorHandler) RegisterRoutes(r *gin.RouterGroup, authMW gin.HandlerFunc, adminMW gin.HandlerFunc) {

	r.GET("/status/overview", authMW, adminMW, h.GetOverview)
	r.GET("/status/visitors", authMW, adminMW, h.GetVisitors)
	r.GET("/status/user-logins", authMW, adminMW, h.GetUserLogins)
	r.GET("/status/server/status", authMW, adminMW, h.ServerStatus)
	r.GET("/status/server/status/stream", authMW, adminMW, h.ServerStatusStream)
	r.POST("/status/track", h.TrackVisitor)
	r.GET("/status/detail", h.GetStatusDetail)
}
