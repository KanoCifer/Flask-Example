package dto

import (
	"time"

	"github.com/KanoCifer/kuroome-blog/internal/mongo/document"
)

// PostResponse 单篇博客输出 —— 与 Python _serialize_post 形状一致。
type PostResponse struct {
	ID        string   `json:"_id"`
	Title     string   `json:"title"`
	Body      string   `json:"body"`
	Summary   *string  `json:"summary"`
	Cover     *string  `json:"cover"`
	Tags      []string `json:"tags"`
	IsPinned  int      `json:"is_pinned"`
	Views     int      `json:"views"`
	Likes     int      `json:"likes"`
	CreatedAt string   `json:"created_at"`
	UpdatedAt string   `json:"updated_at"`
}

// LikeResponse 点赞响应 —— 返回递增后的最新喜欢数。
type LikeResponse struct {
	Likes int `json:"likes"`
}

// TagResponse 标签聚合项 —— 与 Python aggregate_tag_counts 形状一致。
type TagResponse struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

// BlogListResponse 博客列表响应 —— 与 Python get_blogs 返回形状一致。
type BlogListResponse struct {
	Posts      []PostResponse `json:"posts"`
	Tags       []TagResponse  `json:"tags"`
	Pagination Pagination     `json:"pagination"`
}

// PostsByTagResponse 标签筛选响应 —— 与 Python get_posts_by_tag 返回形状一致。
type PostsByTagResponse struct {
	Posts []PostResponse `json:"posts"`
	Tag   string         `json:"tag"`
	Pagination Pagination     `json:"pagination"`
}

// ToPostResponse document → 输出 DTO —— 与 Python _serialize_post 对齐。
// mongo-driver 将 _id(ObjectID) 解码为 ID 字段的十六进制字符串。
func ToPostResponse(p document.Post) PostResponse {
	return PostResponse{
		ID:        p.ID,
		Title:     p.Title,
		Body:      p.Body,
		Summary:   p.Summary,
		Cover:     p.Cover,
		Tags:      p.Tags,
		IsPinned:  p.IsPinned,
		Views:     p.Views,
		Likes:     p.Likes,
		CreatedAt: formatTime(p.CreatedAt),
		UpdatedAt: formatTime(p.UpdatedAt),
	}
}

// ToPostList 批量转换，使用 ToResponseSlice 统一实现。
func ToPostList(items []document.Post) []PostResponse {
	return ToResponseSlice(items, ToPostResponse)
}

// formatTime 将 time.Time 格式化为 RFC3339 字符串；零值返回 ""。
func formatTime(tm time.Time) string {
	if tm.IsZero() {
		return ""
	}
	return tm.UTC().Format(time.RFC3339)
}
