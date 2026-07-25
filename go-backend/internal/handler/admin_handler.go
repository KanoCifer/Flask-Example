package handler

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/KanoCifer/kuroome-blog/internal/config"
	"github.com/KanoCifer/kuroome-blog/internal/dto"
	"github.com/KanoCifer/kuroome-blog/internal/domain/blog/errs"
	"github.com/KanoCifer/kuroome-blog/internal/response"
)

type AdminServiceer interface {
	AddPost(ctx context.Context, post dto.PostRequest) (id string, err error)
	UpdatePost(ctx context.Context, id string, post dto.PostUpdate) error
	DeletePost(ctx context.Context, id string) error
	ListPostViewsData(ctx context.Context) ([]dto.PostViewResponse, error)
}

type AdminHandler struct {
	adminSvc AdminServiceer
	cfg      *config.Config
}

func NewAdminHandler(adminSvc AdminServiceer, cfg *config.Config) *AdminHandler {
	return &AdminHandler{adminSvc: adminSvc, cfg: cfg}
}

func (h *AdminHandler) AddPost(c *gin.Context) {
	var req dto.PostRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.APIError(c, err.Error())
		return
	}
	id, err := h.adminSvc.AddPost(c.Request.Context(), req)
	if err != nil {
		slog.ErrorContext(c.Request.Context(), "add post error", "error", err)
		response.APIError(c, err.Error(), 500)
		return
	}
	slog.InfoContext(c.Request.Context(), "post created", "post_id", id)
	response.Success(c, gin.H{"_id": id}, "Blog post added successfully")
}

func (h *AdminHandler) UpdatePost(c *gin.Context) {
	var req dto.PostUpdate
	if err := c.ShouldBindJSON(&req); err != nil {
		response.APIError(c, err.Error())
		return
	}
	if req.ID == "" {
		response.APIError(c, "_id is required")
		return
	}
	if err := h.adminSvc.UpdatePost(c.Request.Context(), req.ID, req); err != nil {
		switch {
		case errors.Is(err, blogerrs.ErrPostNotFound):
			slog.WarnContext(c.Request.Context(), "update post failed", "reason", "post_not_found", "post_id", req.ID)
			response.APIError(c, err.Error(), 404)
		case errors.Is(err, blogerrs.ErrInvalidPostID):
			slog.WarnContext(c.Request.Context(), "update post failed", "reason", "invalid_post_id", "post_id", req.ID)
			response.APIError(c, err.Error(), 400)
		default:
			slog.ErrorContext(c.Request.Context(), "update post error", "error", err, "post_id", req.ID)
			response.APIError(c, err.Error(), 500)
		}
		return
	}
	slog.InfoContext(c.Request.Context(), "post updated", "post_id", req.ID)
	response.Success(c, gin.H{"_id": req.ID}, "Blog post updated successfully")
}

func (h *AdminHandler) DeletePost(c *gin.Context) {
	postID := c.Param("post_id")
	if err := h.adminSvc.DeletePost(c.Request.Context(), postID); err != nil {
		switch {
		case errors.Is(err, blogerrs.ErrPostNotFound):
			slog.WarnContext(c.Request.Context(), "delete post failed", "reason", "post_not_found", "post_id", postID)
			response.APIError(c, err.Error(), 404)
		case errors.Is(err, blogerrs.ErrInvalidPostID):
			slog.WarnContext(c.Request.Context(), "delete post failed", "reason", "invalid_post_id", "post_id", postID)
			response.APIError(c, err.Error(), 400)
		default:
			slog.ErrorContext(c.Request.Context(), "delete post error", "error", err, "post_id", postID)
			response.APIError(c, err.Error(), 500)
		}
		return
	}
	slog.InfoContext(c.Request.Context(), "post deleted", "post_id", postID)
	response.Success(c, gin.H{"_id": postID}, "Blog post deleted successfully")
}

func (h *AdminHandler) ListPostViewsData(c *gin.Context) {
	data, err := h.adminSvc.ListPostViewsData(c.Request.Context())
	if err != nil {
		slog.ErrorContext(c.Request.Context(), "list post views data", "error", err)
		response.APIError(c, err.Error(), http.StatusInternalServerError)
		return
	}
	response.Success(c, data, "Post views data retrieved successfully")
}

func (h *AdminHandler) RegisterRoutes(r *gin.RouterGroup, authMW gin.HandlerFunc, adminMW gin.HandlerFunc) {
	r.POST("/post/add", authMW, adminMW, h.AddPost)
	r.PUT("/post/update", authMW, adminMW, h.UpdatePost)
	r.DELETE("/post/:post_id/delete", authMW, adminMW, h.DeletePost)
	r.GET("/post/views", authMW, adminMW, h.ListPostViewsData)
}
