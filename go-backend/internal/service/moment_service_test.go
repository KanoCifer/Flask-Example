package service

import (
	"context"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"

	"github.com/KanoCifer/kuroome-blog/internal/dto"
	"github.com/KanoCifer/kuroome-blog/internal/mongo/document"
)

// ---------- mock MomentRepositoryer ----------

type mockMomentRepo struct {
	createFn         func(ctx context.Context, m *document.Moment) error
	getByIDFn        func(ctx context.Context, id string) (*document.Moment, error)
	getByIDAdminFn   func(ctx context.Context, id string) (*document.Moment, error)
	listPublicFn     func(ctx context.Context, tag ...string) ([]document.Moment, error)
	listPublicPageFn func(ctx context.Context, page, pageSize int, tag string) ([]document.Moment, error)
	countPublicFn    func(ctx context.Context, tag string) (int, error)
	listAdminFn      func(ctx context.Context, status string, includeDeleted bool, page, pageSize int) ([]document.Moment, int, error)
	updateFn         func(ctx context.Context, id string, fields bson.M) error
	softDeleteFn     func(ctx context.Context, id string) error
	hardDeleteFn     func(ctx context.Context, id string) error
}

func (m *mockMomentRepo) Create(ctx context.Context, mom *document.Moment) error {
	if m.createFn != nil {
		return m.createFn(ctx, mom)
	}
	return nil
}

func (m *mockMomentRepo) GetByID(ctx context.Context, id string) (*document.Moment, error) {
	if m.getByIDFn != nil {
		return m.getByIDFn(ctx, id)
	}
	return nil, mongo.ErrNoDocuments
}

func (m *mockMomentRepo) GetByIDAdmin(ctx context.Context, id string) (*document.Moment, error) {
	if m.getByIDAdminFn != nil {
		return m.getByIDAdminFn(ctx, id)
	}
	return nil, mongo.ErrNoDocuments
}

func (m *mockMomentRepo) ListPublic(ctx context.Context, tag ...string) ([]document.Moment, error) {
	if m.listPublicFn != nil {
		return m.listPublicFn(ctx, tag...)
	}
	return nil, nil
}

func (m *mockMomentRepo) ListPublicPage(ctx context.Context, page, pageSize int, tag string) ([]document.Moment, error) {
	if m.listPublicPageFn != nil {
		return m.listPublicPageFn(ctx, page, pageSize, tag)
	}
	return nil, nil
}

func (m *mockMomentRepo) CountPublic(ctx context.Context, tag string) (int, error) {
	if m.countPublicFn != nil {
		return m.countPublicFn(ctx, tag)
	}
	return 0, nil
}

func (m *mockMomentRepo) ListAdmin(ctx context.Context, status string, includeDeleted bool, page, pageSize int) ([]document.Moment, int, error) {
	if m.listAdminFn != nil {
		return m.listAdminFn(ctx, status, includeDeleted, page, pageSize)
	}
	return nil, 0, nil
}

func (m *mockMomentRepo) Update(ctx context.Context, id string, fields bson.M) error {
	if m.updateFn != nil {
		return m.updateFn(ctx, id, fields)
	}
	return nil
}

func (m *mockMomentRepo) SoftDelete(ctx context.Context, id string) error {
	if m.softDeleteFn != nil {
		return m.softDeleteFn(ctx, id)
	}
	return nil
}

func (m *mockMomentRepo) HardDelete(ctx context.Context, id string) error {
	if m.hardDeleteFn != nil {
		return m.hardDeleteFn(ctx, id)
	}
	return nil
}

// ---------- Create — PublishedAt 兜底逻辑 ----------

func TestMomentService_Create_Published_DefaultsPublishedAt(t *testing.T) {
	before := time.Now().UTC()
	var captured *document.Moment

	repo := &mockMomentRepo{
		createFn: func(_ context.Context, m *document.Moment) error {
			captured = m
			return nil
		},
	}
	svc := NewMomentService(repo)

	_, err := svc.Create(context.Background(), 1, dto.MomentRequest{
		Content: "hello",
		Status:  dto.MomentPublished,
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if captured == nil {
		t.Fatal("repo.Create 没被调用")
	}
	if captured.PublishedAt == nil {
		t.Fatal("published status 时 PublishedAt 应非 nil")
	}
	after := time.Now().UTC()
	if captured.PublishedAt.Before(before) || captured.PublishedAt.After(after) {
		t.Errorf("PublishedAt = %v, 想在 [%v, %v]", *captured.PublishedAt, before, after)
	}
}

func TestMomentService_Create_Draft_PublishedAtNil(t *testing.T) {
	var captured *document.Moment
	repo := &mockMomentRepo{
		createFn: func(_ context.Context, m *document.Moment) error {
			captured = m
			return nil
		},
	}
	svc := NewMomentService(repo)

	_, err := svc.Create(context.Background(), 1, dto.MomentRequest{
		Content: "draft",
		Status:  dto.MomentDraft,
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if captured.PublishedAt != nil {
		t.Errorf("draft 状态 PublishedAt 应为 nil, got %v", *captured.PublishedAt)
	}
}

func TestMomentService_Create_Archived_PublishedAtNil(t *testing.T) {
	var captured *document.Moment
	repo := &mockMomentRepo{
		createFn: func(_ context.Context, m *document.Moment) error {
			captured = m
			return nil
		},
	}
	svc := NewMomentService(repo)

	_, err := svc.Create(context.Background(), 1, dto.MomentRequest{
		Content: "old",
		Status:  dto.MomentArchived,
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if captured.PublishedAt != nil {
		t.Errorf("archived 状态 PublishedAt 应为 nil, got %v", *captured.PublishedAt)
	}
}

// ---------- Update — PublishedAt 回填逻辑 ----------

func TestMomentService_Update_DraftToPublished_FillsPublishedAt(t *testing.T) {
	before := time.Now().UTC()
	var capturedFields bson.M

	repo := &mockMomentRepo{
		getByIDFn: func(_ context.Context, id string) (*document.Moment, error) {
			return &document.Moment{
				ID:          id,
				Status:      document.MomentDraft,
				PublishedAt: nil,
			}, nil
		},
		updateFn: func(_ context.Context, _ string, fields bson.M) error {
			capturedFields = fields
			return nil
		},
	}
	svc := NewMomentService(repo)

	err := svc.Update(context.Background(), "507f1f77bcf86cd799439011", dto.MomentUpdate{
		Status: ptr(dto.MomentPublished),
	})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	pa, ok := capturedFields["published_at"]
	if !ok {
		t.Fatal("fields[published_at] 缺失,draft→published 应回填")
	}
	paTime, ok := pa.(time.Time)
	if !ok {
		t.Fatalf("published_at 类型 = %T, want time.Time", pa)
	}
	after := time.Now().UTC()
	if paTime.Before(before) || paTime.After(after) {
		t.Errorf("published_at = %v, want in [%v, %v]", paTime, before, after)
	}
}

func TestMomentService_Update_AlreadyPublished_DoesNotOverwritePublishedAt(t *testing.T) {
	var capturedFields bson.M
	existing := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

	repo := &mockMomentRepo{
		getByIDFn: func(_ context.Context, id string) (*document.Moment, error) {
			return &document.Moment{
				ID:          id,
				Status:      document.MomentPublished,
				PublishedAt: &existing,
			}, nil
		},
		updateFn: func(_ context.Context, _ string, fields bson.M) error {
			capturedFields = fields
			return nil
		},
	}
	svc := NewMomentService(repo)

	err := svc.Update(context.Background(), "507f1f77bcf86cd799439011", dto.MomentUpdate{
		Content: ptr("edit"),
		Status:  ptr(dto.MomentPublished),
	})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if _, ok := capturedFields["published_at"]; ok {
		t.Errorf("已 published 不应覆写 published_at, got %v", capturedFields["published_at"])
	}
}

func TestMomentService_Update_PublishedToDraft_DoesNotWritePublishedAt(t *testing.T) {
	var capturedFields bson.M
	existing := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

	repo := &mockMomentRepo{
		getByIDFn: func(_ context.Context, id string) (*document.Moment, error) {
			return &document.Moment{
				ID:          id,
				Status:      document.MomentPublished,
				PublishedAt: &existing,
			}, nil
		},
		updateFn: func(_ context.Context, _ string, fields bson.M) error {
			capturedFields = fields
			return nil
		},
	}
	svc := NewMomentService(repo)

	err := svc.Update(context.Background(), "507f1f77bcf86cd799439011", dto.MomentUpdate{
		Status: ptr(dto.MomentDraft),
	})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if _, ok := capturedFields["published_at"]; ok {
		t.Errorf("published→draft 不应写入 published_at, got %v", capturedFields["published_at"])
	}
}

// ptr 由 admin_test.go 顶部提供(generic 指针字面量辅助)。