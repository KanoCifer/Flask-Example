package service

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/KanoCifer/kuroome-blog/internal/dto"
	"github.com/KanoCifer/kuroome-blog/internal/mongo/document"
	"go.mongodb.org/mongo-driver/v2/bson"
)

type FishRepoer interface {
	List(ctx context.Context) ([]document.FishingSpot, error)
	Create(ctx context.Context, spot *document.FishingSpot) error
	Update(ctx context.Context, id string, data bson.M) error
	Delete(ctx context.Context, id string, hardDelete ...bool) error
	GetByID(ctx context.Context, id string) (*document.FishingSpot, error)
}

type Fisher interface {
	GetFishingSpots(ctx context.Context) ([]*dto.FishingSpotResponse, error)
	GetFishingSpotByID(ctx context.Context, id string) (*dto.FishingSpotResponse, error)
	CreateFishingSpot(ctx context.Context, spot *dto.FishingSpotRequest) error
	UpdateFishingSpot(ctx context.Context, id string, spot *dto.FishingSpotUpdate) error
	Delete(ctx context.Context, id string, hardDelete ...bool) error
}

// ErrInvalidKind 是 service 抛出的领域错误 —— handler 据此映射 400 + invalid_kind 标记。
// 不混进 bson / 网络错误，方便定位。
var ErrInvalidKind = errors.New("invalid_kind")

type FishService struct {
	repo FishRepoer
}

func NewFishService(repo FishRepoer) *FishService {
	return &FishService{repo: repo}
}

func (s *FishService) GetFishingSpots(ctx context.Context) ([]*dto.FishingSpotResponse, error) {
	docs, err := s.repo.List(ctx)
	if err != nil {
		return nil, err
	}
	var spots []*dto.FishingSpotResponse
	for _, doc := range docs {
		spots = append(spots, &dto.FishingSpotResponse{
			ID:          doc.ID,
			Name:        doc.Name,
			Description: doc.Description,
			Location:    doc.Location,
			Tags:        doc.Tags,
			Rating:      doc.Rating,
			Images:      doc.Images,
			Kind:        doc.Kind,
		})
	}
	return spots, nil
}

func (s *FishService) GetFishingSpotByID(ctx context.Context, id string) (*dto.FishingSpotResponse, error) {
	doc, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	var out = &dto.FishingSpotResponse{
		ID:          doc.ID,
		Name:        doc.Name,
		Description: doc.Description,
		Location:    doc.Location,
		Tags:        doc.Tags,
		Rating:      doc.Rating,
		Images:      doc.Images,
		Kind:        doc.Kind,
	}

	return out, nil
}

// UpdateFishingSpot 部分更新钓点 —— 与 DevTaskService.Update 同模式：
// 只把前端实际传了的字段塞进 bson.M，避免未传字段被静默覆盖为零值。
// updated_at 由 service 层刷新，repo 只负责执行。
// Kind 二次校验：binding 已通过 oneof，但仍做 IsValidKind 检查
// （gin 版本漂移/中间件顺序错位时兜底）。
func (s *FishService) UpdateFishingSpot(ctx context.Context, id string, spot *dto.FishingSpotUpdate) error {
	if !spot.IsValidKind() {
		return ErrInvalidKind
	}
	data := bson.M{}
	if spot.Name != nil {
		data["name"] = *spot.Name
	}
	if spot.Description != nil {
		data["description"] = *spot.Description
	}
	if spot.Location != nil {
		data["location"] = *spot.Location
	}
	if spot.Tags != nil {
		data["tags"] = *spot.Tags
	}
	if spot.Rating != nil {
		data["rating"] = *spot.Rating
	}
	if spot.Images != nil {
		data["images"] = *spot.Images
	}
	if spot.Kind != nil {
		data["kind"] = *spot.Kind
	}
	if len(data) == 0 {
		return nil
	}
	data["updated_at"] = time.Now().UTC()
	if err := s.repo.Update(ctx, id, data); err != nil {
		return err
	}
	slog.InfoContext(ctx, "fishing spot updated", "id", id)
	return nil
}

func (s *FishService) CreateFishingSpot(ctx context.Context, spot *dto.FishingSpotRequest) error {
	// 二次校验：binding 已验，但当 gin 版本/中间件顺序导致 binding 漏执行时，service 兜底。
	if !spot.IsValidKind() {
		return ErrInvalidKind
	}
	doc := &document.FishingSpot{
		Name:        spot.Name,
		Description: spot.Description,
		Tags:        spot.Tags,
		Rating:      spot.Rating,
		Location:    spot.Location,
		Kind:        spot.Kind,
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
		Images:      spot.Images,
	}
	if err := s.repo.Create(ctx, doc); err != nil {
		return err
	}
	slog.InfoContext(ctx, "fishing spot created", "name", doc.Name)
	return nil
}

// Delete 删除钓点 —— 默认软删（设 DeletedAt），hardDelete=true 时物理删除。
// 签名对齐 repo 层 Delete(id, hardDelete ...bool)。
func (s *FishService) Delete(ctx context.Context, id string, hardDelete ...bool) error {
	return s.repo.Delete(ctx, id, hardDelete...)
}
