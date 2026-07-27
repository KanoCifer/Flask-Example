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
	FetchBookInfo(ctx context.Context, userID string, bookID string) (*dto.WereadBookResponse, error)
	FetchReadDetail(ctx context.Context, userID, mode string, baseTime *int) (*dto.ReadDetailSnapshot, error)
	FetchYearlyHeatmap(ctx context.Context, userID string, year *int) (map[string]int, error)
	FetchBooksRecommend(ctx context.Context, userID string, count, maxIdx int) ([]dto.BookRecommendItem, error)
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

// GetBookInfo 获取单本书籍详情（代理微信读书 /book/info，Redis 缓存，不落库）。
func (h *WereadHandler) GetBookInfo(c *gin.Context) {
	bookID := c.Param("bookId")
	if bookID == "" {
		response.APIError(c, "无效的请求", http.StatusBadRequest)
		return
	}
	userID := strconv.Itoa(c.GetInt("user_id"))
	if userID == "0" {
		response.APIError(c, "未授权", http.StatusUnauthorized)
		return
	}

	data, err := h.svc.FetchBookInfo(c.Request.Context(), userID, bookID)
	if err != nil {
		slog.ErrorContext(c.Request.Context(), "weread fetch book info", "error", err)
		if errors.Is(err, weread.ErrUnauthorized) {
			response.APIError(c, "微信读书授权已过期", http.StatusUnauthorized)
			return
		}
		response.APIError(c, "获取书籍详情失败", http.StatusInternalServerError)
		return
	}

	response.Success(c, data, "书籍详情获取成功")
}

// GetReadProgress 获取阅读统计快照（mode=weekly/monthly/annually/overall）或年度热力图（perDay=true）。
// 两种模式共用同一 endpoint，通过 perDay 参数分流。
func (h *WereadHandler) GetReadProgress(c *gin.Context) {
	userID := strconv.Itoa(c.GetInt("user_id"))
	if userID == "0" {
		response.APIError(c, "未授权", http.StatusUnauthorized)
		return
	}

	mode := c.Query("mode")
	if mode == "" {
		response.APIError(c, "mode 参数必填", http.StatusBadRequest)
		return
	}

	// perDay=true 走年度热力图分支
	if c.Query("perDay") == "true" {
		var yearPtr *int
		if y := c.Query("year"); y != "" {
			yInt, err := strconv.Atoi(y)
			if err != nil {
				response.APIError(c, "无效的 year 参数", http.StatusBadRequest)
				return
			}
			yearPtr = &yInt
		}

		readTimes, err := h.svc.FetchYearlyHeatmap(c.Request.Context(), userID, yearPtr)
		if err != nil {
			slog.ErrorContext(c.Request.Context(), "weread fetch yearly heatmap", "error", err)
			if errors.Is(err, weread.ErrUnauthorized) {
				response.APIError(c, "微信读书授权已过期", http.StatusUnauthorized)
				return
			}
			response.APIError(c, "获取阅读热力图失败", http.StatusInternalServerError)
			return
		}
		response.Success(c, dto.WereadYearlyHeatmap{ReadTimes: readTimes}, "阅读热力图获取成功")
		return
	}

	// snapshot 分支：阅读统计快照
	var baseTimePtr *int
	if bt := c.Query("baseTime"); bt != "" {
		btInt, err := strconv.Atoi(bt)
		if err != nil {
			response.APIError(c, "无效的 baseTime 参数", http.StatusBadRequest)
			return
		}
		baseTimePtr = &btInt
	}

	snapshot, err := h.svc.FetchReadDetail(c.Request.Context(), userID, mode, baseTimePtr)
	if err != nil {
		slog.ErrorContext(c.Request.Context(), "weread fetch read detail", "error", err)
		if errors.Is(err, weread.ErrUnauthorized) {
			response.APIError(c, "微信读书授权已过期", http.StatusUnauthorized)
			return
		}
		response.APIError(c, "获取阅读统计失败", http.StatusInternalServerError)
		return
	}
	response.Success(c, snapshot, "阅读统计获取成功")
}

// GetBooksRecommend 获取微信读书推荐书籍列表。
func (h *WereadHandler) GetBooksRecommend(c *gin.Context) {
	userID := strconv.Itoa(c.GetInt("user_id"))
	if userID == "0" {
		response.APIError(c, "未授权", http.StatusUnauthorized)
		return
	}

	count := 12
	if cv := c.Query("count"); cv != "" {
		cInt, err := strconv.Atoi(cv)
		if err != nil {
			response.APIError(c, "无效的 count 参数", http.StatusBadRequest)
			return
		}
		count = cInt
	}

	maxIdx := 0
	if mv := c.Query("maxIdx"); mv != "" {
		mInt, err := strconv.Atoi(mv)
		if err != nil {
			response.APIError(c, "无效的 maxIdx 参数", http.StatusBadRequest)
			return
		}
		maxIdx = mInt
	}

	books, err := h.svc.FetchBooksRecommend(c.Request.Context(), userID, count, maxIdx)
	if err != nil {
		slog.ErrorContext(c.Request.Context(), "weread fetch books recommend", "error", err)
		if errors.Is(err, weread.ErrUnauthorized) {
			response.APIError(c, "微信读书授权已过期", http.StatusUnauthorized)
			return
		}
		response.APIError(c, "获取推荐书籍失败", http.StatusInternalServerError)
		return
	}
	response.Success(c, books, "推荐书籍获取成功")
}

// RegisterRoutes 挂载 weread 路由，所有接口需登录鉴权。
func (h *WereadHandler) RegisterRoutes(r *gin.RouterGroup, authMW gin.HandlerFunc) {
	g := r.Group("/weread")
	g.Use(authMW)
	g.POST("/user-info", h.ImportUserToken)
	g.GET("/shelf", h.GetShelf)
	g.GET("/book/:bookId", h.GetBookInfo)
	g.GET("/read-progress", h.GetReadProgress)
	g.GET("/books-recommend", h.GetBooksRecommend)
}
