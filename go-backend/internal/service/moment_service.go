package service

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"

	"github.com/KanoCifer/kuroome-blog/internal/domain/moment/errs"
	"github.com/KanoCifer/kuroome-blog/internal/dto"
	"github.com/KanoCifer/kuroome-blog/internal/mongo/document"
)

// 错误策略：
//   - repo 抛底层错误（mongo.ErrNoDocuments / bson.ObjectIDFromHex 错误）
//   - service 把底层错误**翻译**成 errs 包的领域 sentinel
//   - handler 用 errors.Is(err, momenterrs.ErrMomentNotFound) 判 404、momenterrs.ErrInvalidObjectID 判 400
//   - handler 不直接 import mongo 包 —— 保持 transport ↔ storage 分层隔离
//
// momentVisibilityValues 校验 dto → document 枚举的合法值集合。
// 跟 document.MomentVisibility 的常量值一致即可。
var momentVisibilityValues = map[dto.MomentVisibility]document.MomentVisibility{
	dto.MomentPublic:   document.MomentPublic,
	dto.MomentPrivate:  document.MomentPrivate,
	dto.MomentUnlisted: document.MomentUnlisted,
}

// momentStatusValues 同上。
var momentStatusValues = map[dto.MomentStatus]document.MomentStatus{
	dto.MomentPublished: document.MomentPublished,
	dto.MomentDraft:     document.MomentDraft,
	dto.MomentArchived:  document.MomentArchived,
}

// momentAttachmentTypeValues 同上。
var momentAttachmentTypeValues = map[dto.MomentAttachmentType]document.MomentAttachmentType{
	dto.MomentAttachmentImage: document.MomentAttachmentImage,
	dto.MomentAttachmentLink:  document.MomentAttachmentLink,
	dto.MomentAttachmentBook:  document.MomentAttachmentBook,
	dto.MomentAttachmentQuote: document.MomentAttachmentQuote,
}

// Momenter moment 服务接口 —— handler 依赖接口，便于 mock 测试。
type Momenter interface {
	Create(ctx context.Context, userID int, req dto.MomentRequest) (*dto.MomentResponse, error)
	GetByID(ctx context.Context, id string) (*dto.MomentResponse, error)
	GetByIDAdmin(ctx context.Context, id string) (*dto.MomentResponse, error)
	ListPublic(ctx context.Context, filter dto.MomentFilter, page, pageSize int) (*dto.MomentListResponse, error)
	ListAdmin(ctx context.Context, filter dto.MomentFilter, page, pageSize int) (*dto.MomentListResponse, error)
	Update(ctx context.Context, id string, req dto.MomentUpdate) error
	SoftDelete(ctx context.Context, id string) error
	HardDelete(ctx context.Context, id string) error
}

// MomentRepositoryer moment 持久层接口 —— service 依赖接口，便于 mock 测试。
type MomentRepositoryer interface {
	Create(ctx context.Context, m *document.Moment) error
	GetByID(ctx context.Context, id string) (*document.Moment, error)
	GetByIDAdmin(ctx context.Context, id string) (*document.Moment, error)
	ListPublic(ctx context.Context, tag ...string) ([]document.Moment, error)
	ListPublicPage(ctx context.Context, page, pageSize int, tag string) ([]document.Moment, error)
	CountPublic(ctx context.Context, tag string) (int, error)
	ListAdmin(ctx context.Context, status string, includeDeleted bool, page, pageSize int) ([]document.Moment, int, error)
	Update(ctx context.Context, id string, fields bson.M) error
	SoftDelete(ctx context.Context, id string) error
	HardDelete(ctx context.Context, id string) error
}

type MomentService struct {
	repo MomentRepositoryer
}

func NewMomentService(repo MomentRepositoryer) *MomentService {
	return &MomentService{repo: repo}
}

// Create 创建一条 moment。
// dto→document 的转换在此层完成：repo 只认 document 类型（与 devtask 模式一致）。
//
// status=published 且未显式指定 PublishedAt 时,默认用 now 作为发布时间,
// 避免新建的发布态 moment 在前端列表/详情显示发布时间为 null。
// draft / archived 状态保持 PublishedAt=nil。
func (s *MomentService) Create(
	ctx context.Context,
	userID int,
	req dto.MomentRequest,
) (*dto.MomentResponse, error) {
	now := time.Now().UTC()
	var publishedAt *time.Time
	if req.Status == dto.MomentPublished {
		publishedAt = &now
	}
	m := &document.Moment{
		UserID:       userID,
		Content:      req.Content,
		Summary:      req.Summary,
		Visibility:   toDocVisibility(req.Visibility),
		Status:       toDocStatus(req.Status),
		Mood:         req.Mood,
		Tags:         req.Tags,
		Attachments:  toDocAttachments(req.Attachments),
		Location:     toDocLocation(req.Location),
		Source:       req.Source,
		IsPinned:     req.IsPinned,
		AllowComment: req.AllowComment,
		PublishedAt:  publishedAt,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := s.repo.Create(ctx, m); err != nil {
		return nil, err
	}

	slog.InfoContext(ctx, "moment created", "user_id", userID, "visibility", m.Visibility)
	out := dto.ToMomentResponse(*m)
	return &out, nil
}

// toDocVisibility dto 枚举 → document 枚举。
// 非法值回退到 public，避免写入未知字符串。
func toDocVisibility(v dto.MomentVisibility) document.MomentVisibility {
	if mapped, ok := momentVisibilityValues[v]; ok {
		return mapped
	}
	return document.MomentPublic
}

func toDocStatus(s dto.MomentStatus) document.MomentStatus {
	if mapped, ok := momentStatusValues[s]; ok {
		return mapped
	}
	return document.MomentDraft
}

func toDocAttachmentType(t dto.MomentAttachmentType) document.MomentAttachmentType {
	if mapped, ok := momentAttachmentTypeValues[t]; ok {
		return mapped
	}
	return document.MomentAttachmentImage
}

func toDocAttachments(src []dto.MomentAttachment) []document.MomentAttachment {
	if len(src) == 0 {
		return nil
	}
	out := make([]document.MomentAttachment, len(src))
	for i, a := range src {
		out[i] = document.MomentAttachment{
			Type:         toDocAttachmentType(a.Type),
			URL:          a.URL,
			ThumbnailURL: a.ThumbnailURL,
			Title:        a.Title,
			Description:  a.Description,
			Meta:         a.Meta,
		}
	}
	return out
}

func toDocLocation(src *dto.MomentLocation) *document.MomentLocation {
	if src == nil {
		return nil
	}
	return &document.MomentLocation{
		Name:      src.Name,
		Latitude:  src.Latitude,
		Longitude: src.Longitude,
	}
}

// GetByID 按 ID 查单条 moment。
//   - ID 格式非法 → 翻译为 momenterrs.ErrInvalidObjectID
//   - 文档不存在 → 翻译为 momenterrs.ErrMomentNotFound
func (s *MomentService) GetByID(ctx context.Context, id string) (*dto.MomentResponse, error) {
	m, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, translateRepoErr(err)
	}
	out := dto.ToMomentResponse(*m)
	return &out, nil
}

// GetByIDAdmin 管理员按 ID 查单条 moment，包含软删的文档。
// 翻译规则与 GetByID 一致，但仓库层不过滤 deleted_at。
func (s *MomentService) GetByIDAdmin(ctx context.Context, id string) (*dto.MomentResponse, error) {
	m, err := s.repo.GetByIDAdmin(ctx, id)
	if err != nil {
		return nil, translateRepoErr(err)
	}
	out := dto.ToMomentResponse(*m)
	return &out, nil
}

// ListPublic 公开接口分页查询：只取 visibility=public、未软删的文档。
// 可选 ?tag=xxx 过滤单个标签。返回 {moments, total, page, page_size}。
func (s *MomentService) ListPublic(
	ctx context.Context,
	filter dto.MomentFilter,
	page, pageSize int,
) (*dto.MomentListResponse, error) {
	page, pageSize = normalizePagination(page, pageSize)

	moments, err := s.repo.ListPublicPage(ctx, page, pageSize, filter.Tag)
	if err != nil {
		return nil, err
	}
	total, err := s.repo.CountPublic(ctx, filter.Tag)
	if err != nil {
		return nil, err
	}

	return &dto.MomentListResponse{
		Moments:    dto.ToMomentList(moments),
		Pagination: pagination(page, pageSize, total),
	}, nil
}

// ListAdmin 管理员分页查询：覆盖全部 visibility / status；
// include_deleted 缺省按 false 处理。
func (s *MomentService) ListAdmin(
	ctx context.Context,
	filter dto.MomentFilter,
	page, pageSize int,
) (*dto.MomentListResponse, error) {
	page, pageSize = normalizePagination(page, pageSize)
	includeDeleted := filter.IncludeDeleted != nil && *filter.IncludeDeleted

	moments, total, err := s.repo.ListAdmin(ctx, filter.Status, includeDeleted, page, pageSize)
	if err != nil {
		return nil, err
	}

	return &dto.MomentListResponse{
		Moments:    dto.ToMomentList(moments),
		Pagination: pagination(page, pageSize, total),
	}, nil
}

// normalizePagination 兜底 page / pageSize：page<1 → 1；pageSize<1 → 10。
// 避免除零 / 越界，让 handler 不必每个分支都补默认值。
func normalizePagination(page, pageSize int) (int, int) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	}
	return page, pageSize
}

// Update 部分更新；按 dto.MomentUpdate 字段是否传了（指针非 nil）构造 $set。
// 复刻 /btw 的 PATCH 三态语义：
//   - 指针 nil   → 字段不在 PATCH 中，不动
//   - 指针非 nil → 显式写入（包括 &""、&0、&[]）
//
// 注意：dto.MomentUpdate.Location 当前是 *MomentLocation，无法区分"未传"与"显式
// 置 null"；要严格三态需改为 **MomentLocation。
func (s *MomentService) Update(
	ctx context.Context,
	id string,
	req dto.MomentUpdate,
) error {
	now := time.Now().UTC()
	fields := bson.M{"updated_at": now}

	if req.Content != nil {
		fields["content"] = *req.Content
	}
	if req.Summary != nil {
		fields["summary"] = *req.Summary
	}
	if req.Visibility != nil {
		fields["visibility"] = toDocVisibility(*req.Visibility)
	}
	if req.Status != nil {
		fields["status"] = toDocStatus(*req.Status)
	}
	if req.Mood != nil {
		fields["mood"] = *req.Mood
	}
	if req.Tags != nil {
		fields["tags"] = *req.Tags
	}

	// 状态迁移 draft→published 时,如果当前 published_at 为空,
	// 默认补 now 为发布时间,避免新发布的 moment 沉到公开列表底部。
	// 已 published(本次显式或已存在)的不覆写;非 published 状态也不写入。
	if req.Status != nil && *req.Status == dto.MomentPublished {
		existing, err := s.repo.GetByID(ctx, id)
		if err != nil {
			return translateRepoErr(err)
		}
		if existing != nil && existing.PublishedAt == nil {
			fields["published_at"] = now
		}
	}
	if req.Attachments != nil {
		fields["attachments"] = toDocAttachments(*req.Attachments)
	}
	if req.Location != nil {
		fields["location"] = toDocLocation(req.Location)
	}
	if req.Source != nil {
		fields["source"] = *req.Source
	}
	if req.IsPinned != nil {
		fields["is_pinned"] = *req.IsPinned
	}
	if req.AllowComment != nil {
		fields["allow_comment"] = *req.AllowComment
	}

	return translateRepoErr(s.repo.Update(ctx, id, fields))
}

// SoftDelete 软删；底层 repo 已检测 MatchedCount=0 并翻译成 momenterrs.ErrMomentNotFound。
func (s *MomentService) SoftDelete(ctx context.Context, id string) error {
	return translateRepoErr(s.repo.SoftDelete(ctx, id))
}

// HardDelete 物理删除；底层 repo 已检测 DeletedCount=0 并翻译。
func (s *MomentService) HardDelete(ctx context.Context, id string) error {
	return translateRepoErr(s.repo.HardDelete(ctx, id))
}

// translateRepoErr 把 repo / mongo 层的错误统一翻译成 errs 包的领域错误。
// 让 handler 只需依赖 errs 包，不用 import mongo 也不感知 storage 实现。
func translateRepoErr(err error) error {
	if err == nil {
		return nil
	}
	// 非法 ObjectID：bson.ObjectIDFromHex 返回的错误是 bson 的 InvalidObjectIDError
	if errors.Is(err, momenterrs.ErrInvalidObjectID) {
		return err
	}
	// 文档不存在
	if errors.Is(err, mongo.ErrNoDocuments) {
		return momenterrs.ErrMomentNotFound
	}
	return err
}
