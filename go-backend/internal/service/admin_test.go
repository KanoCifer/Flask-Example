package service

import (
	"context"
	"errors"
	"testing"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"github.com/KanoCifer/kuroome-blog/internal/dto"
	"github.com/KanoCifer/kuroome-blog/internal/domain/blog/errs"
	"github.com/KanoCifer/kuroome-blog/internal/model"
	"github.com/KanoCifer/kuroome-blog/internal/mongo/document"
	"github.com/KanoCifer/kuroome-blog/internal/repository/postgres"
)

// ptr 返回值变量的指针，用于构造指针字段 DTO 字面量。
func ptr[T any](v T) *T { return &v }

// 校验分支不依赖 repo，repo 为 nil 也能覆盖（在调用 repo 前返回）。

func TestAdminService_UpdatePost_InvalidID(t *testing.T) {
	svc := &adminService{} // repo/redis 均为 nil
	err := svc.UpdatePost(context.Background(), "not-a-hex", dto.PostUpdate{
		Title: ptr("t"),
		Body:  ptr("b"),
		ID:    "not-a-hex",
	})
	if !errors.Is(err, blogerrs.ErrInvalidPostID) {
		t.Errorf("err = %v, want ErrInvalidPostID", err)
	}
}

func TestAdminService_DeletePost_InvalidID(t *testing.T) {
	svc := &adminService{}
	err := svc.DeletePost(context.Background(), "%%%")
	if !errors.Is(err, blogerrs.ErrInvalidPostID) {
		t.Errorf("err = %v, want ErrInvalidPostID", err)
	}
}

// ---------- ptrIf 辅助 ----------

func TestPtrIf(t *testing.T) {
	tests := []struct {
		in   string
		want bool // true means nil
	}{
		{"", true},
		{"hello", false},
		{" ", false},
	}
	for _, tt := range tests {
		got := ptrIf(tt.in)
		if tt.want && got != nil {
			t.Errorf("ptrIf(%q) = %v, want nil", tt.in, *got)
		}
		if !tt.want && got == nil {
			t.Errorf("ptrIf(%q) = nil, want non-nil", tt.in)
		}
	}
}

// ---------- mock repos ----------

// mockAdminRepo 为 admin 用例提供最小 AdminRepositoryer 实现。
type mockAdminRepo struct {
	createPostFn      func(ctx context.Context, post *document.Post) (string, error)
	getPostByIDFn     func(ctx context.Context, id string) (*document.Post, error)
	updatePostByIDFn  func(ctx context.Context, id string, update bson.M) error
	deletePostByIDFn  func(ctx context.Context, id string) error
	listPostViewsData func(ctx context.Context) ([]document.PostViewData, error)
}

func (m *mockAdminRepo) CreatePost(ctx context.Context, post *document.Post) (string, error) {
	if m.createPostFn != nil {
		return m.createPostFn(ctx, post)
	}
	return "", nil
}

func (m *mockAdminRepo) GetPostByID(ctx context.Context, id string) (*document.Post, error) {
	if m.getPostByIDFn != nil {
		return m.getPostByIDFn(ctx, id)
	}
	return nil, nil
}

func (m *mockAdminRepo) UpdatePostByID(ctx context.Context, id string, update bson.M) error {
	if m.updatePostByIDFn != nil {
		return m.updatePostByIDFn(ctx, id, update)
	}
	return nil
}

func (m *mockAdminRepo) DeletePostByID(ctx context.Context, id string) error {
	if m.deletePostByIDFn != nil {
		return m.deletePostByIDFn(ctx, id)
	}
	return nil
}

func (m *mockAdminRepo) ListPostViewsData(ctx context.Context) ([]document.PostViewData, error) {
	if m.listPostViewsData != nil {
		return m.listPostViewsData(ctx)
	}
	return nil, nil
}

// ---------- AddPost ----------

func TestAdminService_AddPost_Success(t *testing.T) {
	var captured *document.Post
	repo := &mockAdminRepo{
		createPostFn: func(ctx context.Context, post *document.Post) (string, error) {
			captured = post
			return "507f1f77bcf86cd799439011", nil
		},
	}
	svc := &adminService{repo: repo, redis: nil}

	id, err := svc.AddPost(context.Background(), dto.PostRequest{
		Title: "Hello", Body: "World", Tags: []string{"go"}, IsPinned: true,
	})
	if err != nil {
		t.Fatalf("AddPost: %v", err)
	}
	if id != "507f1f77bcf86cd799439011" {
		t.Errorf("id = %q, want 507f1f77bcf86cd799439011", id)
	}
	if captured == nil || captured.Title != "Hello" {
		t.Errorf("captured post = %+v, want title=Hello", captured)
	}
	if captured.IsPinned != 1 {
		t.Errorf("IsPinned = %d, want 1 (boolToInt(true))", captured.IsPinned)
	}
}

func TestAdminService_AddPost_WithOptionalFields(t *testing.T) {
	var captured *document.Post
	repo := &mockAdminRepo{
		createPostFn: func(ctx context.Context, post *document.Post) (string, error) {
			captured = post
			return "id-1", nil
		},
	}
	svc := &adminService{repo: repo, redis: nil}

	_, err := svc.AddPost(context.Background(), dto.PostRequest{
		Title: "T", Body: "B", Summary: "Summary", Cover: "cover.png",
	})
	if err != nil {
		t.Fatalf("AddPost: %v", err)
	}
	if captured.Summary == nil || *captured.Summary != "Summary" {
		t.Errorf("Summary = %v, want Summary", captured.Summary)
	}
	if captured.Cover == nil || *captured.Cover != "cover.png" {
		t.Errorf("Cover = %v, want cover.png", captured.Cover)
	}
}

// ---------- DeletePost ----------

func TestAdminService_DeletePost_NotFound(t *testing.T) {
	repo := &mockAdminRepo{
		getPostByIDFn: func(ctx context.Context, id string) (*document.Post, error) {
			return nil, mongo.ErrNoDocuments
		},
	}
	svc := &adminService{repo: repo, redis: nil}

	err := svc.DeletePost(context.Background(), "507f1f77bcf86cd799439011")
	if !errors.Is(err, blogerrs.ErrPostNotFound) {
		t.Errorf("err = %v, want ErrPostNotFound", err)
	}
}

func TestAdminService_DeletePost_Success(t *testing.T) {
	deleteCalled := false
	repo := &mockAdminRepo{
		getPostByIDFn: func(ctx context.Context, id string) (*document.Post, error) {
			return &document.Post{ID: id}, nil
		},
		deletePostByIDFn: func(ctx context.Context, id string) error {
			deleteCalled = true
			return nil
		},
	}
	svc := &adminService{repo: repo, redis: nil}

	err := svc.DeletePost(context.Background(), "507f1f77bcf86cd799439011")
	if err != nil {
		t.Fatalf("DeletePost: %v", err)
	}
	if !deleteCalled {
		t.Error("repo.DeletePostByID should be called")
	}
}

// ---------- UpdatePost ----------

func TestAdminService_UpdatePost_NotFound(t *testing.T) {
	repo := &mockAdminRepo{
		getPostByIDFn: func(ctx context.Context, id string) (*document.Post, error) {
			return nil, mongo.ErrNoDocuments
		},
	}
	svc := &adminService{repo: repo, redis: nil}

	err := svc.UpdatePost(context.Background(), "507f1f77bcf86cd799439011", dto.PostUpdate{
		Title: ptr("t"),
		Body:  ptr("b"),
	})
	if !errors.Is(err, blogerrs.ErrPostNotFound) {
		t.Errorf("err = %v, want ErrPostNotFound", err)
	}
}

// ---------- ListPostViewsData ----------

func TestAdminService_ListPostViewsData_Passthrough(t *testing.T) {
	repo := &mockAdminRepo{
		listPostViewsData: func(ctx context.Context) ([]document.PostViewData, error) {
			return []document.PostViewData{
				{Title: "Post A", Views: 100},
				{Title: "Post B", Views: 50},
			}, nil
		},
	}
	svc := &adminService{repo: repo}

	data, err := svc.ListPostViewsData(context.Background())
	if err != nil {
		t.Fatalf("ListPostViewsData: %v", err)
	}
	if len(data) != 2 {
		t.Errorf("len = %d, want 2", len(data))
	}
	if data[0].Title != "Post A" || data[0].Views != 100 {
		t.Errorf("data[0] = %+v, want {Post A 100}", data[0])
	}
}

func TestAdminService_ListPostViewsData_Error(t *testing.T) {
	repo := &mockAdminRepo{
		listPostViewsData: func(ctx context.Context) ([]document.PostViewData, error) {
			return nil, errors.New("mongo error")
		},
	}
	svc := &adminService{repo: repo}

	_, err := svc.ListPostViewsData(context.Background())
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

// ---------- TrackVisitor ----------

// 校验 TrackVisitor 走 visitor repo 直写，Redis 侧不再被调用。
// repo 层为 nil 的 AdminService 调用这里会 panic；故构造时注入真实
// in-memory SQLite，模拟新引入的 VisitorRepo 注入链路。
func TestAdminService_TrackVisitor_WritesToPostgres(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&model.VisitorTrack{}); err != nil {
		t.Fatalf("automigrate: %v", err)
	}

	svc := NewAdminService(nil, postgres.NewVisitorRepo(db), nil)
	data := dto.VisitorTrackRequest{
		VisitorID:   "v-1",
		PageURL:     "https://example.com/posts/1",
		PagePath:    "/posts/1",
		BrowserName: "Chrome",
		// Referrer / Browser / ScreenResolution / Language 留空 → 期望入库 NULL
	}
	if err := svc.TrackVisitor(context.Background(), data); err != nil {
		t.Fatalf("TrackVisitor: %v", err)
	}

	var got model.VisitorTrack
	if err := db.First(&got).Error; err != nil {
		t.Fatalf("reload: %v", err)
	}
	if got.VisitorID != "v-1" {
		t.Errorf("VisitorID = %q, want v-1", got.VisitorID)
	}
	if got.BrowserName == nil || *got.BrowserName != "Chrome" {
		t.Errorf("BrowserName = %v, want Chrome", got.BrowserName)
	}
	if got.Referrer != nil {
		t.Errorf("Referrer = %q, want nil", *got.Referrer)
	}
	if got.Browser != nil {
		t.Errorf("Browser = %q, want nil", *got.Browser)
	}
}
