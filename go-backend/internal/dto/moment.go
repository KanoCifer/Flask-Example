package dto

import "time"

type MomentVisibility string

const (
	MomentPublic   MomentVisibility = "public"
	MomentPrivate  MomentVisibility = "private"
	MomentUnlisted MomentVisibility = "unlisted"
)

type MomentStatus string

const (
	MomentPublished MomentStatus = "published"
	MomentDraft     MomentStatus = "draft"
	MomentArchived  MomentStatus = "archived"
)

type MomentAttachmentType string

const (
	MomentAttachmentImage MomentAttachmentType = "image"
	MomentAttachmentLink  MomentAttachmentType = "link"
	MomentAttachmentBook  MomentAttachmentType = "book"
	MomentAttachmentQuote MomentAttachmentType = "quote"
)

type MomentAttachment struct {
	Type         MomentAttachmentType `json:"type"`
	URL          string               `json:"url"`
	ThumbnailURL *string              `json:"thumbnail_url"`
	Title        *string              `json:"title"`
	Description  *string              `json:"description"`
	Meta         map[string]any       `json:"meta"`
}

type MomentLocation struct {
	Name      *string  `json:"name"`
	Latitude  *float64 `json:"latitude"`
	Longitude *float64 `json:"longitude"`
}

type MomentRequest struct {
	UserID       int                `json:"user_id"`
	Content      string             `json:"content"`
	Summary      *string            `json:"summary"`
	Visibility   MomentVisibility   `json:"visibility"`
	Status       MomentStatus       `json:"status"`
	Mood         *string            `json:"mood"`
	Tags         []string           `json:"tags"`
	Attachments  []MomentAttachment `json:"attachments"`
	Location     *MomentLocation    `json:"location"`
	Source       *string            `json:"source"`
	IsPinned     bool               `json:"is_pinned"`
	AllowComment bool               `json:"allow_comment"`
}

type MomentResponse struct {
	ID           string             `json:"id"`
	UserID       int                `json:"user_id"`
	Content      string             `json:"content"`
	Summary      *string            `json:"summary"`
	Visibility   MomentVisibility   `json:"visibility"`
	Status       MomentStatus       `json:"status"`
	Mood         *string            `json:"mood"`
	Tags         []string           `json:"tags"`
	Attachments  []MomentAttachment `json:"attachments"`
	Location     *MomentLocation    `json:"location"`
	Source       *string            `json:"source"`
	IsPinned     bool               `json:"is_pinned"`
	AllowComment bool               `json:"allow_comment"`
	LikeCount    int                `json:"like_count"`
	CommentCount int                `json:"comment_count"`
	ViewCount    int                `json:"view_count"`
	PublishedAt  *time.Time         `json:"published_at"`
	CreatedAt    time.Time          `json:"created_at"`
	UpdatedAt    time.Time          `json:"updated_at"`
	DeletedAt    *time.Time         `json:"deleted_at"`
}

type MomentUpdate struct {
	Content      *string             `json:"content"`
	Summary      *string             `json:"summary"`
	Visibility   *MomentVisibility   `json:"visibility"`
	Status       *MomentStatus       `json:"status"`
	Mood         *string             `json:"mood"`
	Tags         *[]string           `json:"tags"`
	Attachments  *[]MomentAttachment `json:"attachments"`
	Location     *MomentLocation     `json:"location"`
	Source       *string             `json:"source"`
	IsPinned     *bool               `json:"is_pinned"`
	AllowComment *bool               `json:"allow_comment"`
}

// MomentFilter moment 列表筛选条件（handler→service）。
// 与 DevTaskFilter 一样保持 string-based：handler 不感知领域枚举，
// 由 service 层负责 string→domain 映射。
type MomentFilter struct {
	// Tag 单个标签过滤（公开接口 ?tag=xxx）。
	Tag string `json:"tag,omitempty"`
	// Status 状态过滤（仅 admin 接口使用）。
	Status string `json:"status,omitempty"`
	// IncludeDeleted 是否包含软删的文档（仅 admin 接口默认 true）。
	IncludeDeleted *bool `json:"include_deleted,omitempty"`
}

// MomentListResponse moment 列表响应 —— 与 React 端
// {moments: Moment[], total, page, page_size} 对齐。
type MomentListResponse struct {
	Moments    []MomentResponse `json:"moments"`
	Total      int              `json:"total"`
	Page       int              `json:"page"`
	PageSize   int              `json:"page_size"`
}
