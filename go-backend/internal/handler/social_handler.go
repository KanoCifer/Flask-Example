package handler

import (
	"log/slog"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"

	"github.com/KanoCifer/kuroome-blog/internal/response"
)

const likeKey = "site:total_likes"

// SocialHandler 处理点赞相关请求（公开接口，无需鉴权）。
type SocialHandler struct {
	redis *redis.Client
}

func NewSocialHandler(redis *redis.Client) *SocialHandler {
	return &SocialHandler{redis: redis}
}

// AddLike 原子递增点赞数。
func (h *SocialHandler) AddLike(c *gin.Context) {
	var req struct {
		LikesCount int `json:"likes_count" binding:"required,gt=0"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.APIError(c, "invalid request body", http.StatusBadRequest)
		return
	}

	if h.redis == nil {
		response.APIError(c, "server error", http.StatusInternalServerError)
		return
	}

	ctx := c.Request.Context()
	total, err := h.redis.IncrBy(ctx, likeKey, int64(req.LikesCount)).Result()
	if err != nil {
		slog.ErrorContext(ctx, "incrby likes failed", "error", err)
		response.APIError(c, "server error", http.StatusInternalServerError)
		return
	}

	response.Success(c, gin.H{"likes_count": total}, "Like added successfully")
}

// GetLikes 获取当前总点赞数。
func (h *SocialHandler) GetLikes(c *gin.Context) {
	if h.redis == nil {
		response.APIError(c, "server error", http.StatusInternalServerError)
		return
	}

	ctx := c.Request.Context()
	val, err := h.redis.Get(ctx, likeKey).Result()
	if err == redis.Nil {
		response.Success(c, gin.H{"likes_count": 0}, "Likes count retrieved successfully")
		return
	}
	if err != nil {
		slog.ErrorContext(ctx, "get likes failed", "error", err)
		response.APIError(c, "server error", http.StatusInternalServerError)
		return
	}

	count, _ := strconv.ParseInt(val, 10, 64)
	response.Success(c, gin.H{"likes_count": count}, "Likes count retrieved successfully")
}

// RegisterRoutes 挂载点赞路由到 v3 组。
func (h *SocialHandler) RegisterRoutes(r *gin.RouterGroup, publicMWs ...gin.HandlerFunc) {
	r.POST("/likes", append(publicMWs, h.AddLike)...)
	r.GET("/likes", h.GetLikes)
}
