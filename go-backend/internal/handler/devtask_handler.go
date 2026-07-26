package handler

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/KanoCifer/kuroome-blog/internal/config"
	"github.com/KanoCifer/kuroome-blog/internal/domain/devtask/errs"
	"github.com/KanoCifer/kuroome-blog/internal/dto"
	"github.com/KanoCifer/kuroome-blog/internal/response"
	"github.com/KanoCifer/kuroome-blog/internal/service"
	"github.com/KanoCifer/kuroome-blog/pkg/jwt"
)

// DevTaskHandler 处理开发与需求看板请求（需登录 + admin）。
type DevTaskHandler struct {
	svc service.DevTasker
	cfg *config.Config
}

func NewDevTaskHandler(svc service.DevTasker, cfg *config.Config) *DevTaskHandler {
	return &DevTaskHandler{svc: svc, cfg: cfg}
}

// userID 从 context 提取当前登录用户 ID。
func userID(c *gin.Context) int {
	v, _ := c.Get("user_id")
	id, _ := v.(int)
	return id
}

// CreateTask 创建任务  POST /api/v3/dev-tasks
func (h *DevTaskHandler) CreateTask(c *gin.Context) {
	var req dto.DevTaskCreate
	if err := c.ShouldBindJSON(&req); err != nil {
		response.APIError(c, err.Error())
		return
	}

	data, err := h.svc.Create(c.Request.Context(), userID(c), req)
	if err != nil {
		slog.ErrorContext(c.Request.Context(), "create dev task", "error", err)
		response.APIError(c, err.Error(), http.StatusInternalServerError)
		return
	}
	response.Success(c, data, "Task created successfully")
}

// GetTaskBySlug 按 slug 查单条任务  GET /api/v3/dev-tasks/:slug
// 可选查询参数 with_parent=true 触发附带父 spec 数据（仅当任务有 parent_slug 时）。
func (h *DevTaskHandler) GetTaskBySlug(c *gin.Context) {
	slug := c.Param("slug")
	withParent := c.Query("with_parent") == "true"

	data, err := h.svc.GetBySlug(c.Request.Context(), slug, withParent)
	if err != nil {
		switch {
		case errors.Is(err, devtaskerrs.ErrTaskNotFound):
			response.APIError(c, err.Error(), http.StatusNotFound)
		default:
			slog.ErrorContext(c.Request.Context(), "get dev task by slug", "error", err, "slug", slug)
			response.APIError(c, err.Error(), http.StatusInternalServerError)
		}
		return
	}
	response.Success(c, data, "Task retrieved successfully")
}

// ListTasks 分页列出任务  GET /api/v3/dev-tasks?page=1&per_page=10&status=&priority=&type=
func (h *DevTaskHandler) ListTasks(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "10"))

	filter := dto.DevTaskFilter{
		Status:   c.Query("status"),
		Priority: c.Query("priority"),
		Type:     c.Query("type"),
	}
	if d := c.Query("include_deleted"); d == "true" {
		t := true
		filter.IncludeDeleted = &t
	} else {
		f := false
		filter.IncludeDeleted = &f
	}
	if f := c.Query("for_agent"); f != "" {
		switch f {
		case "true":
			t := true
			filter.ForAgent = &t
		case "false":
			f := false
			filter.ForAgent = &f
		}
	}

	data, err := h.svc.List(c.Request.Context(), filter, page, perPage)
	if err != nil {
		slog.ErrorContext(c.Request.Context(), "list dev tasks", "error", err)
		response.APIError(c, err.Error(), http.StatusInternalServerError)
		return
	}
	response.Success(c, data, "Tasks retrieved successfully")
}

// FrontierTasks 返回 agent 当前可认领的任务列表（for_agent=true + 未阻塞 + 待排期）。
// GET /api/v3/dev-tasks/frontier?limit=10
func (h *DevTaskHandler) FrontierTasks(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))

	data, err := h.svc.FindFrontier(c.Request.Context(), limit)
	if err != nil {
		slog.ErrorContext(c.Request.Context(), "frontier dev tasks", "error", err)
		response.APIError(c, err.Error(), http.StatusInternalServerError)
		return
	}
	// 直接返回数组（无分页 envelope），因为 frontier 语义是"接下来干什么的简短清单"。
	response.Success(c, data, "Frontier tasks retrieved successfully")
}

// UpdateTask 部分更新任务  PATCH /api/v3/dev-tasks/:slug
func (h *DevTaskHandler) UpdateTask(c *gin.Context) {
	slug := c.Param("slug")

	var req dto.DevTaskUpdate
	if err := c.ShouldBindJSON(&req); err != nil {
		response.APIError(c, err.Error())
		return
	}

	if err := h.svc.Update(c.Request.Context(), slug, req); err != nil {
		slog.ErrorContext(c.Request.Context(), "update dev task", "error", err, "slug", slug)
		response.APIError(c, err.Error(), http.StatusInternalServerError)
		return
	}
	response.Success(c, nil, "Task updated successfully")
}

// SoftDeleteTask 逻辑删除  DELETE /api/v3/dev-tasks/:slug
func (h *DevTaskHandler) SoftDeleteTask(c *gin.Context) {
	slug := c.Param("slug")

	if err := h.svc.SoftDelete(c.Request.Context(), slug); err != nil {
		slog.ErrorContext(c.Request.Context(), "soft delete dev task", "error", err, "slug", slug)
		response.APIError(c, err.Error(), http.StatusInternalServerError)
		return
	}
	response.Success(c, nil, "Task soft-deleted successfully")
}

// HardDeleteTask 物理删除  DELETE /api/v3/dev-tasks/:slug/permanent
func (h *DevTaskHandler) HardDeleteTask(c *gin.Context) {
	slug := c.Param("slug")

	if err := h.svc.HardDelete(c.Request.Context(), slug); err != nil {
		slog.ErrorContext(c.Request.Context(), "hard delete dev task", "error", err, "slug", slug)
		response.APIError(c, err.Error(), http.StatusInternalServerError)
		return
	}
	response.Success(c, nil, "Task permanently deleted")
}

// BatchStatus 批量修改任务状态  POST /api/v3/dev-tasks/batch-status
// 一次把多个 slug（含 spec 父任务）翻到同一状态。
func (h *DevTaskHandler) BatchStatus(c *gin.Context) {
	var req dto.BatchStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.APIError(c, err.Error())
		return
	}

	result, err := h.svc.BatchUpdateStatus(c.Request.Context(), req.Slugs, req.Status)
	if err != nil {
		slog.ErrorContext(c.Request.Context(), "batch status update", "error", err)
		response.APIError(c, err.Error(), http.StatusInternalServerError)
		return
	}
	response.Success(c, dto.BatchStatusResponse{
		Succeeded: result.Succeeded,
		Failed:    result.Failed,
	}, "Batch status update completed")
}

// DevTaskToken 为前端签发 devtask service-JWT。
// GET /api/v3/dev-task/token?days=N
// 前端用用户 JWT 调用此端点，后端校验 admin 后返回 service token。
// days 可选，1..365，默认 1h（兼容看板自身短期 token）；传 days 后按整天计算，
// 用于 MCP server 等长期服务鉴权。
func (h *DevTaskHandler) DevTaskToken(c *gin.Context) {
	if h.cfg.Security.DevTaskSecret == "" {
		response.APIError(c, "devtask secret not configured", http.StatusServiceUnavailable)
		return
	}

	expiresAt := time.Now().UTC().Add(1 * time.Hour)
	if d := c.Query("days"); d != "" {
		days, err := strconv.Atoi(d)
		if err != nil || days < 1 || days > 365 {
			response.APIError(c, "days must be an integer between 1 and 365", http.StatusBadRequest)
			return
		}
		expiresAt = time.Now().UTC().AddDate(0, 0, days)
	}

	token, err := jwt.GenerateServiceToken(expiresAt, h.cfg.Security.DevTaskSecret)
	if err != nil {
		slog.ErrorContext(c.Request.Context(), "generate devtask service token", "error", err)
		response.APIError(c, "failed to generate token", http.StatusInternalServerError)
		return
	}

	response.Success(c, gin.H{
		"token":      token,
		"expires_at": expiresAt.Format(time.RFC3339),
		"days":       int(time.Until(expiresAt).Hours() / 24),
	}, "DevTask token issued successfully")
}

// RegisterRoutes 挂载 devtask 路由（service-JWT 鉴权）。全链路使用 slug 标识。
// devTaskMW 是 service-JWT 中间件；authMW/adminMW 用于 DevTaskToken（用户 JWT + admin 白名单）。
func (h *DevTaskHandler) RegisterRoutes(r *gin.RouterGroup, devTaskMW gin.HandlerFunc, authMW gin.HandlerFunc, adminMW gin.HandlerFunc) {
	g := r.Group("/dev-tasks", devTaskMW)
	g.POST("", h.CreateTask)
	g.GET("", h.ListTasks)
	// 静态前缀必须注册在 :slug 之前 —— Gin 路由按注册顺序匹配，:slug 会吞掉同级的静态 path。
	g.GET("/frontier", h.FrontierTasks)
	g.POST("/batch-status", h.BatchStatus)
	g.GET("/:slug", h.GetTaskBySlug)
	g.PATCH("/:slug", h.UpdateTask)
	g.DELETE("/:slug", h.SoftDeleteTask)
	g.DELETE("/:slug/permanent", h.HardDeleteTask)

	// DevTaskToken 走用户 JWT + admin 白名单（与 CRUD 的 service-JWT 不同）。
	r.GET("/dev-task/token", authMW, adminMW, h.DevTaskToken)
}
