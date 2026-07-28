package handler

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	blogerrs "github.com/KanoCifer/kuroome-blog/internal/domain/blog/errs"
	"github.com/KanoCifer/kuroome-blog/internal/dto"
	"github.com/KanoCifer/kuroome-blog/internal/response"
)

// BlogServiceer 博客读表面 —— handler 依赖接口，便于 mock 测试。
type BlogServiceer interface {
	ListPosts(ctx context.Context, page int, search string) (*dto.BlogListResponse, error)
	GetPost(ctx context.Context, id string) (*dto.PostResponse, error)
	IncrementViews(ctx context.Context, id string) error
	LikePost(ctx context.Context, id string) (int, error)
	ListTags(ctx context.Context) ([]dto.TagResponse, error)
	ListPostsByTag(ctx context.Context, tag string, page, perPage int) (*dto.PostsByTagResponse, error)
}

// BlogHandler 处理博客读请求（公开接口，无需鉴权）。
type BlogHandler struct {
	blogSvc BlogServiceer
}

func NewBlogHandler(blogSvc BlogServiceer) *BlogHandler {
	return &BlogHandler{blogSvc: blogSvc}
}

func (h *BlogHandler) GetBlogs(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	search := c.Query("search")

	data, err := h.blogSvc.ListPosts(c.Request.Context(), page, search)
	if err != nil {
		slog.ErrorContext(c.Request.Context(), "get blogs", "error", err)
		response.APIError(c, err.Error(), http.StatusInternalServerError)
		return
	}
	response.Success(c, data, "Blogs retrieved successfully")
}

func (h *BlogHandler) GetBlogPost(c *gin.Context) {
	_id := c.Param("id")
	if _id == "" {
		_id = c.Query("_id")
	}

	data, err := h.blogSvc.GetPost(c.Request.Context(), _id)
	if err != nil {
		switch {
		case errors.Is(err, blogerrs.ErrInvalidPostID):
			response.APIError(c, err.Error(), http.StatusBadRequest)
		case errors.Is(err, blogerrs.ErrPostNotFound):
			response.APIError(c, err.Error(), http.StatusNotFound)
		default:
			slog.ErrorContext(c.Request.Context(), "get blog post", "error", err)
			response.APIError(c, err.Error(), http.StatusInternalServerError)
		}
		return
	}
	// Fire-and-forget view increment —— 阅读量计数，不阻塞返回响应。
	go func() {
		if err := h.blogSvc.IncrementViews(c.Request.Context(), _id); err != nil {
			slog.ErrorContext(c.Request.Context(), "increment views", "error", err, "id", _id)
		}
	}()
	response.Success(c, data, "Blog post retrieved successfully")
}

func (h *BlogHandler) GetTags(c *gin.Context) {
	tags, err := h.blogSvc.ListTags(c.Request.Context())
	if err != nil {
		slog.ErrorContext(c.Request.Context(), "get tags", "error", err)
		response.APIError(c, err.Error(), http.StatusInternalServerError)
		return
	}
	response.Success(c, gin.H{"tags": tags}, "Tags retrieved successfully")
}

func (h *BlogHandler) GetPostsByTag(c *gin.Context) {
	tag := c.Param("tag")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "10"))

	data, err := h.blogSvc.ListPostsByTag(c.Request.Context(), tag, page, perPage)
	if err != nil {
		if errors.Is(err, blogerrs.ErrInvalidPostID) {
			response.APIError(c, "Tag is required", http.StatusBadRequest)
			return
		}
		slog.ErrorContext(c.Request.Context(), "get posts by tag", "error", err)
		response.APIError(c, err.Error(), http.StatusInternalServerError)
		return
	}
	response.Success(c, data, "Posts retrieved successfully")
}

// LikePost 处理点赞请求（公开接口，无需鉴权）—— 原子递增并返回最新喜欢数。
func (h *BlogHandler) LikePost(c *gin.Context) {
	id := c.Param("id")

	likes, err := h.blogSvc.LikePost(c.Request.Context(), id)
	if err != nil {
		switch {
		case errors.Is(err, blogerrs.ErrInvalidPostID):
			response.APIError(c, err.Error(), http.StatusBadRequest)
		case errors.Is(err, blogerrs.ErrPostNotFound):
			response.APIError(c, err.Error(), http.StatusNotFound)
		default:
			slog.ErrorContext(c.Request.Context(), "like post", "error", err, "id", id)
			response.APIError(c, err.Error(), http.StatusInternalServerError)
		}
		return
	}
	response.Success(c, dto.LikeResponse{Likes: likes}, "Liked successfully")
}

// RegisterRoutes 挂载博客读路由到 v3 组。
//
// 注意：/post 是 /blogs/:id 的双路由别名（前端 blogGateway 仍使用 v3/post?_id=xxx），
// 不可删除。若前端迁移到 /blogs/:id 后可清理。
func (h *BlogHandler) RegisterRoutes(r *gin.RouterGroup) {
	// cacheP5 := middleware.CacheController("public, max-age=300")  // 5 min — 列表
	// cacheP10 := middleware.CacheController("public, max-age=600") // 10 min — 详情
	// cacheH1 := middleware.CacheController("public, max-age=3600") // 1 h — 标签

	r.GET("/blogs", h.GetBlogs)
	r.GET("/blogs/:id", h.GetBlogPost)
	r.POST("/blogs/:id/like", h.LikePost)
	r.GET("/post", h.GetBlogPost)
	r.GET("/tags", h.GetTags)
	r.GET("/tags/:tag/posts", h.GetPostsByTag)
}
