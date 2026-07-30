package handler

import (
	"errors"
	"log/slog"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"

	"github.com/KanoCifer/kuroome-blog/internal/dto"
	"github.com/KanoCifer/kuroome-blog/internal/middleware"
	"github.com/KanoCifer/kuroome-blog/internal/response"
	"github.com/KanoCifer/kuroome-blog/internal/service"
)

// kindBindingErrMessage gin binding tag 触发 oneof 失败时返回的字符串固定形态。
// 我们嗅探字符串以把 binding 阶段的 kind 错误也归一为同一个 invalid_kind 标记。
const kindBindingErrMessage = "Field validation for 'Kind' failed on the 'oneof' tag"

// isInvalidKindError 嗅探 binding / service 两层错误。
// service 走 errors.Is(ErrInvalidKind)；binding 阶段是字符串嗅探，因为 gin 没导出
// 一种 stable 的字段级错误类型（v10.ValidationErrors 会被 ShouldBindJSON 包成
// errors.New 字符串，无法独立 errors.Is 出原 ValidationErrors）。
func isInvalidKindError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, service.ErrInvalidKind) {
		return true
	}
	var verr validator.ValidationErrors
	if errors.As(err, &verr) {
		for _, fe := range verr {
			if fe.Field() == "Kind" && fe.Tag() == "oneof" {
				return true
			}
		}
	}
	return strings.Contains(err.Error(), kindBindingErrMessage)
}

// FishHandler 处理钓点资源的 CRUD 请求。
type FishHandler struct {
	svc service.Fisher
}

func NewFishHandler(svc service.Fisher) *FishHandler {
	return &FishHandler{svc: svc}
}

// GetFishingSpotsList 列出所有钓点  GET /fish/spots
func (h *FishHandler) GetFishingSpotsList(c *gin.Context) {
	spots, err := h.svc.GetFishingSpots(c.Request.Context())
	if err != nil {
		slog.ErrorContext(c.Request.Context(), "list fishing spots", "error", err)
		response.APIError(c, err.Error())
		return
	}
	response.Success(c, spots)
}

// GetFishingSpot 按 ID 查单条钓点  GET /fish/spots/:id
func (h *FishHandler) GetFishingSpot(c *gin.Context) {
	id := c.Param("id")
	spot, err := h.svc.GetFishingSpotByID(c.Request.Context(), id)
	if err != nil {
		slog.ErrorContext(c.Request.Context(), "get fishing spot", "error", err, "id", id)
		response.APIError(c, err.Error())
		return
	}
	response.Success(c, spot)
}

// CreateFishingSpot 创建钓点  POST /fish/spots
func (h *FishHandler) CreateFishingSpot(c *gin.Context) {
	var req dto.FishingSpotRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		if isInvalidKindError(err) {
			response.APIError(c, "invalid_kind: kind 必须在 lake/river/reservoir 之一", 400)
			return
		}
		response.APIError(c, err.Error())
		return
	}
	if err := h.svc.CreateFishingSpot(c.Request.Context(), &req); err != nil {
		if isInvalidKindError(err) {
			response.APIError(c, "invalid_kind: kind 必须在 lake/river/reservoir 之一", 400)
			return
		}
		slog.ErrorContext(c.Request.Context(), "create fishing spot", "error", err)
		response.APIError(c, err.Error())
		return
	}
	response.Success(c, nil)
}

// UpdateFishingSpot 部分更新钓点  PATCH /fish/spots/:id
// 配合 dto.FishingSpotUpdate 指针字段：仅传了的字段才覆盖，未传字段保持原值。
func (h *FishHandler) UpdateFishingSpot(c *gin.Context) {
	id := c.Param("id")
	var req dto.FishingSpotUpdate
	if err := c.ShouldBindJSON(&req); err != nil {
		if isInvalidKindError(err) {
			response.APIError(c, "invalid_kind: kind 必须在 lake/river/reservoir 之一", 400)
			return
		}
		response.APIError(c, err.Error())
		return
	}
	if err := h.svc.UpdateFishingSpot(c.Request.Context(), id, &req); err != nil {
		if isInvalidKindError(err) {
			response.APIError(c, "invalid_kind: kind 必须在 lake/river/reservoir 之一", 400)
			return
		}
		slog.ErrorContext(c.Request.Context(), "update fishing spot", "error", err, "id", id)
		response.APIError(c, err.Error())
		return
	}
	response.Success(c, nil)
}

// DeleteFishingSpot 删除钓点  DELETE /fish/spots/:id
// 默认软删（设 DeletedAt）；?hard=true 时走物理删除。
func (h *FishHandler) DeleteFishingSpot(c *gin.Context) {
	id := c.Param("id")
	hard := c.Query("hard") == "true"
	if err := h.svc.Delete(c.Request.Context(), id, hard); err != nil {
		slog.ErrorContext(c.Request.Context(), "delete fishing spot", "error", err, "id", id)
		response.APIError(c, err.Error())
		return
	}
	response.Success(c, nil)
}

// RegisterRoutes 在 r 下挂载钓点路由。
// GET 公开（列表 / 详情）加 1h 缓存；POST / PATCH / DELETE 需 auth + admin 中间件保护。
func (h *FishHandler) RegisterRoutes(r *gin.RouterGroup, authMW gin.HandlerFunc, adminMW gin.HandlerFunc) {
	cacheH1 := middleware.CacheController("public, max-age=3600")

	f := r.Group("/fish")
	f.GET("/spots", cacheH1, h.GetFishingSpotsList)
	f.GET("/spots/:id", cacheH1, h.GetFishingSpot)
	f.POST("/spots", authMW, adminMW, h.CreateFishingSpot)
	f.PATCH("/spots/:id", authMW, adminMW, h.UpdateFishingSpot)
	f.DELETE("/spots/:id", authMW, adminMW, h.DeleteFishingSpot)
}
