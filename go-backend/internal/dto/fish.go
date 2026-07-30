package dto

import "github.com/KanoCifer/kuroome-blog/internal/mongo/document"

type FishingSpotResponse struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Location    []float64 `json:"location"`
	Tags        []string  `json:"tags"`
	Rating      float64   `json:"rating"`
	Images      []string  `json:"images"`
	// Kind 水体类型 —— 遗留/未匹配回填的文档可能为 ""。前端 nullable 分支按空串
	// 走 muted 灰。omitempty 避免响应里出现 "kind": "" 这类噪音。
	Kind string `json:"kind,omitempty"`
}

// FishingSpotRequest 创建钓点请求 —— 全字段非指针，Name / Location / Kind 必填。
// Kind 通过 oneof=lake river reservoir 校验，非法值在 binding 阶段就会被拦截。
type FishingSpotRequest struct {
	Name        string    `json:"name" binding:"required"`
	Location    []float64 `json:"location" binding:"required"`
	Description string    `json:"description"`
	Tags        []string  `json:"tags"`
	Rating      float64   `json:"rating"`
	Images      []string  `json:"images"`
	Kind        string    `json:"kind" binding:"required,oneof=lake river reservoir"`
}

// IsValidKind 在 service 层做二次校验：
// 即使 binding 误配置（gin 版本漂移等），也拒绝进入数据库。
func (r *FishingSpotRequest) IsValidKind() bool {
	return document.IsValidKind(r.Kind)
}

// FishingSpotUpdate 更新钓点请求 —— 全字段指针，nil = 不动，非 nil = 显式覆盖。
// Kind 是 *string，nil = 不动；非 nil 也必须经过 IsValidKind 二次校验。
// 与 DevTaskUpdate 同模式：service 层只把非 nil 字段塞进 bson.M，避免 partial update 静默清空。
type FishingSpotUpdate struct {
	Name        *string    `json:"name"`
	Location    *[]float64 `json:"location"`
	Description *string    `json:"description"`
	Tags        *[]string  `json:"tags"`
	Rating      *float64   `json:"rating"`
	Images      *[]string  `json:"images"`
	Kind        *string    `json:"kind,omitempty"`
}

// IsValidKindUpdate nil 视为合法（不动），非 nil 则必须在三值内。
func (u *FishingSpotUpdate) IsValidKind() bool {
	if u == nil || u.Kind == nil {
		return true
	}
	return document.IsValidKind(*u.Kind)
}
