package handler

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/KanoCifer/kuroome-blog/internal/dto"
	"github.com/KanoCifer/kuroome-blog/internal/errs"
	"github.com/KanoCifer/kuroome-blog/internal/response"
	"github.com/KanoCifer/kuroome-blog/internal/service"
)

// MomentHandler 处理 moment 资源的 HTTP 请求。
//
// 错误处理契约（与 devtask / blog 对齐）：
//   - errs.ErrMomentNotFound   → 404
//   - errs.ErrInvalidObjectID  → 400
//   - 其他                     → 500
//
// handler 不感知 mongo / bson —— 翻译工作在 service.translateRepoErr 完成。
type MomentHandler struct {
	svc service.Momenter
}

func NewMomentHandler(svc service.Momenter) *MomentHandler {
	return &MomentHandler{svc: svc}
}

// ---------- 公开读 ----------

// ListPublicMoments  GET  /v3/moments?page=&page_size=&tag=
func (h *MomentHandler) ListPublicMoments(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))

	filter := dto.MomentFilter{Tag: c.Query("tag")}

	data, err := h.svc.ListPublic(c.Request.Context(), filter, page, pageSize)
	if err != nil {
		slog.ErrorContext(c.Request.Context(), "list public moments", "error", err)
		response.APIError(c, err.Error(), http.StatusInternalServerError)
		return
	}
	response.Success(c, data, "Moments retrieved successfully")
}

// GetPublicMoment  GET  /v3/moments/:id
func (h *MomentHandler) GetPublicMoment(c *gin.Context) {
	id := c.Param("id")

	data, err := h.svc.GetByID(c.Request.Context(), id)
	if err != nil {
		h.respondGetErr(c, err, id, "get public moment")
		return
	}
	response.Success(c, data, "Moment retrieved successfully")
}

// respondGetErr 统一处理 Get / Update / Delete 路径的错误翻译 —— 避免重复写 4-case switch。
func (h *MomentHandler) respondGetErr(c *gin.Context, err error, id, op string) {
	switch {
	case errors.Is(err, errs.ErrMomentNotFound):
		response.APIError(c, err.Error(), http.StatusNotFound)
	case errors.Is(err, errs.ErrInvalidObjectID):
		response.APIError(c, err.Error(), http.StatusBadRequest)
	default:
		slog.ErrorContext(c.Request.Context(), op, "error", err, "id", id)
		response.APIError(c, err.Error(), http.StatusInternalServerError)
	}
}

// ---------- 鉴权写 ----------

// CreateMoment  POST /v3/moments
func (h *MomentHandler) CreateMoment(c *gin.Context) {
	var req dto.MomentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.APIError(c, err.Error())
		return
	}

	data, err := h.svc.Create(c.Request.Context(), userID(c), req)
	if err != nil {
		slog.ErrorContext(c.Request.Context(), "create moment", "error", err)
		response.APIError(c, err.Error(), http.StatusInternalServerError)
		return
	}
	response.Success(c, data, "Moment created successfully")
}

// UpdateMoment  PATCH /v3/moments/:id
// 字段三态语义完全由 dto.MomentUpdate 指针字段 + service.Update 处理，
// handler 不做预处理。
func (h *MomentHandler) UpdateMoment(c *gin.Context) {
	id := c.Param("id")

	var req dto.MomentUpdate
	if err := c.ShouldBindJSON(&req); err != nil {
		response.APIError(c, err.Error())
		return
	}

	if err := h.svc.Update(c.Request.Context(), id, req); err != nil {
		h.respondGetErr(c, err, id, "update moment")
		return
	}
	response.Success(c, nil, "Moment updated successfully")
}

// DeleteMoment  DELETE /v3/moments/:id  （软删）
func (h *MomentHandler) DeleteMoment(c *gin.Context) {
	id := c.Param("id")

	if err := h.svc.SoftDelete(c.Request.Context(), id); err != nil {
		h.respondGetErr(c, err, id, "soft delete moment")
		return
	}
	response.Success(c, nil, "Moment deleted successfully")
}

// ---------- 管理员 ----------

// ListAdminMoments  GET /v3/moments/admin?page=&page_size=&status=&include_deleted=
func (h *MomentHandler) ListAdminMoments(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))

	filter := dto.MomentFilter{Status: c.Query("status")}
	if d := c.Query("include_deleted"); d == "true" {
		t := true
		filter.IncludeDeleted = &t
	} else {
		f := false
		filter.IncludeDeleted = &f
	}

	data, err := h.svc.ListAdmin(c.Request.Context(), filter, page, pageSize)
	if err != nil {
		slog.ErrorContext(c.Request.Context(), "list admin moments", "error", err)
		response.APIError(c, err.Error(), http.StatusInternalServerError)
		return
	}
	response.Success(c, data, "Moments retrieved successfully")
}

// GetAdminMoment  GET /v3/moments/admin/:id
func (h *MomentHandler) GetAdminMoment(c *gin.Context) {
	id := c.Param("id")

	data, err := h.svc.GetByIDAdmin(c.Request.Context(), id)
	if err != nil {
		h.respondGetErr(c, err, id, "get admin moment")
		return
	}
	response.Success(c, data, "Moment retrieved successfully")
}

// HardDeleteMoment  DELETE /v3/moments/admin/:id/permanent  （物理删除）
func (h *MomentHandler) HardDeleteMoment(c *gin.Context) {
	id := c.Param("id")

	if err := h.svc.HardDelete(c.Request.Context(), id); err != nil {
		h.respondGetErr(c, err, id, "hard delete moment")
		return
	}
	response.Success(c, nil, "Moment permanently deleted")
}

// RegisterRoutes 在 v3 组下挂载 moment 路由。
//
// 鉴权策略：
//   - 公开读：ListPublicMoments / GetPublicMoment
//   - 登录写：CreateMoment / UpdateMoment / DeleteMoment（需登录，可由 owner 调用）
//   - 管理员：ListAdminMoments / GetAdminMoment / HardDeleteMoment
//
// 路由顺序注意：admin 子树挂在 :id 之前 —— /moments/admin/:id 是静态前缀优先，
// 否则 :id 会吞掉 /admin/。
func (h *MomentHandler) RegisterRoutes(
	r *gin.RouterGroup,
	authMW gin.HandlerFunc,
	adminMW gin.HandlerFunc,
) {
	r.GET("/moments", h.ListPublicMoments)
	r.GET("/moments/admin", authMW, adminMW, h.ListAdminMoments)
	r.GET("/moments/admin/:id", authMW, adminMW, h.GetAdminMoment)
	r.DELETE("/moments/admin/:id/permanent", authMW, adminMW, h.HardDeleteMoment)

	r.GET("/moments/:id", h.GetPublicMoment)
	r.POST("/moments", authMW, h.CreateMoment)
	r.PATCH("/moments/:id", authMW, h.UpdateMoment)
	r.DELETE("/moments/:id", authMW, h.DeleteMoment)
}