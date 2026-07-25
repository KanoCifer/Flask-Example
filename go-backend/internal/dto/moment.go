package dto

import (
	"time"

	"github.com/KanoCifer/kuroome-blog/internal/mongo/document"
)

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
// {moments: Moment[], pagination: Pagination} 对齐。
type MomentListResponse struct {
	Moments    []MomentResponse `json:"moments"`
	Pagination Pagination       `json:"pagination"`
}

// momentVisibilityValues document 枚举 → dto 枚举映射。
var momentVisibilityValues = map[document.MomentVisibility]MomentVisibility{
	document.MomentPublic:   MomentPublic,
	document.MomentPrivate:  MomentPrivate,
	document.MomentUnlisted: MomentUnlisted,
}

// momentStatusValues document 枚举 → dto 枚举映射。
var momentStatusValues = map[document.MomentStatus]MomentStatus{
	document.MomentPublished: MomentPublished,
	document.MomentDraft:     MomentDraft,
	document.MomentArchived:  MomentArchived,
}

// momentAttachmentTypeValues document 枚举 → dto 枚举映射。
var momentAttachmentTypeValues = map[document.MomentAttachmentType]MomentAttachmentType{
	document.MomentAttachmentImage: MomentAttachmentImage,
	document.MomentAttachmentLink:  MomentAttachmentLink,
	document.MomentAttachmentBook:  MomentAttachmentBook,
	document.MomentAttachmentQuote: MomentAttachmentQuote,
}

// ToMomentResponse document → 输出 DTO。
func ToMomentResponse(m document.Moment) MomentResponse {
	return MomentResponse{
		ID:           m.ID,
		UserID:       m.UserID,
		Content:      m.Content,
		Summary:      m.Summary,
		Visibility:   momentVisibilityToDTO(m.Visibility),
		Status:       momentStatusToDTO(m.Status),
		Mood:         m.Mood,
		Tags:         m.Tags,
		Attachments:  momentAttachmentsToDTO(m.Attachments),
		Location:     momentLocationToDTO(m.Location),
		Source:       m.Source,
		IsPinned:     m.IsPinned,
		AllowComment: m.AllowComment,
		LikeCount:    m.LikeCount,
		CommentCount: m.CommentCount,
		ViewCount:    m.ViewCount,
		PublishedAt:  m.PublishedAt,
		CreatedAt:    m.CreatedAt,
		UpdatedAt:    m.UpdatedAt,
		DeletedAt:    m.DeletedAt,
	}
}

// ToMomentList 批量转换，使用 ToResponseSlice 统一实现。
func ToMomentList(items []document.Moment) []MomentResponse {
	return ToResponseSlice(items, ToMomentResponse)
}

// momentVisibilityToDTO document 枚举 → dto 枚举。
func momentVisibilityToDTO(v document.MomentVisibility) MomentVisibility {
	if mapped, ok := momentVisibilityValues[v]; ok {
		return mapped
	}
	return MomentPublic
}

// momentStatusToDTO document 枚举 → dto 枚举。
func momentStatusToDTO(s document.MomentStatus) MomentStatus {
	if mapped, ok := momentStatusValues[s]; ok {
		return mapped
	}
	return MomentDraft
}

// momentAttachmentTypeToDTO document 枚举 → dto 枚举。
func momentAttachmentTypeToDTO(t document.MomentAttachmentType) MomentAttachmentType {
	if mapped, ok := momentAttachmentTypeValues[t]; ok {
		return mapped
	}
	return MomentAttachmentImage
}

// momentAttachmentsToDTO 批量 document → dto 附件转换。
func momentAttachmentsToDTO(src []document.MomentAttachment) []MomentAttachment {
	if len(src) == 0 {
		return nil
	}
	out := make([]MomentAttachment, len(src))
	for i, a := range src {
		out[i] = MomentAttachment{
			Type:         momentAttachmentTypeToDTO(a.Type),
			URL:          a.URL,
			ThumbnailURL: a.ThumbnailURL,
			Title:        a.Title,
			Description:  a.Description,
			Meta:         a.Meta,
		}
	}
	return out
}

// momentLocationToDTO document → dto 位置转换。
func momentLocationToDTO(src *document.MomentLocation) *MomentLocation {
	if src == nil {
		return nil
	}
	return &MomentLocation{
		Name:      src.Name,
		Latitude:  src.Latitude,
		Longitude: src.Longitude,
	}
}
