package service

import (
	"context"
	"errors"
	"testing"

	"go.mongodb.org/mongo-driver/v2/mongo"

	"github.com/KanoCifer/kuroome-blog/internal/domain/blog/errs"
	"github.com/KanoCifer/kuroome-blog/internal/dto"
	"github.com/KanoCifer/kuroome-blog/internal/mongo/document"
)

// ---------- mock BlogRepository ----------

type mockBlogRepo struct {
	listPostsFn      func(ctx context.Context, page, perPage int, search string) ([]document.Post, int64, error)
	aggregateTagsFn  func(ctx context.Context) ([]document.TagCount, error)
	getPostByIDFn    func(ctx context.Context, id string) (*document.Post, error)
	incrementViewsFn func(ctx context.Context, id string) error
	incrementLikesFn func(ctx context.Context, id string) (int, error)
	listPostsByTagFn func(ctx context.Context, tag string, page, perPage int) ([]document.Post, int64, error)
}

func (m *mockBlogRepo) ListPosts(ctx context.Context, page, perPage int, search string) ([]document.Post, int64, error) {
	if m.listPostsFn != nil {
		return m.listPostsFn(ctx, page, perPage, search)
	}
	return nil, 0, nil
}

func (m *mockBlogRepo) AggregateTagCounts(ctx context.Context) ([]document.TagCount, error) {
	if m.aggregateTagsFn != nil {
		return m.aggregateTagsFn(ctx)
	}
	return nil, nil
}

func (m *mockBlogRepo) GetPostByID(ctx context.Context, id string) (*document.Post, error) {
	if m.getPostByIDFn != nil {
		return m.getPostByIDFn(ctx, id)
	}
	return nil, nil
}

func (m *mockBlogRepo) IncrementViews(ctx context.Context, id string) error {
	if m.incrementViewsFn != nil {
		return m.incrementViewsFn(ctx, id)
	}
	return nil
}

func (m *mockBlogRepo) IncrementLikes(ctx context.Context, id string) (int, error) {
	if m.incrementLikesFn != nil {
		return m.incrementLikesFn(ctx, id)
	}
	return 0, nil
}

func (m *mockBlogRepo) ListPostsByTag(ctx context.Context, tag string, page, perPage int) ([]document.Post, int64, error) {
	if m.listPostsByTagFn != nil {
		return m.listPostsByTagFn(ctx, tag, page, perPage)
	}
	return nil, 0, nil
}

func newBlogService(repo BlogRepositoryer) *blogService {
	return &blogService{repo: repo}
}

// ---------- GetPost ----------

func TestBlogService_GetPost_InvalidID(t *testing.T) {
	svc := newBlogService(&mockBlogRepo{})

	_, err := svc.GetPost(context.Background(), "not-a-hex")
	if !errors.Is(err, blogerrs.ErrInvalidPostID) {
		t.Errorf("err = %v, want ErrInvalidPostID", err)
	}
}

func TestBlogService_GetPost_EmptyID(t *testing.T) {
	svc := newBlogService(&mockBlogRepo{})

	_, err := svc.GetPost(context.Background(), "")
	if !errors.Is(err, blogerrs.ErrInvalidPostID) {
		t.Errorf("err = %v, want ErrInvalidPostID", err)
	}
}

func TestBlogService_GetPost_NotFound(t *testing.T) {
	repo := &mockBlogRepo{
		getPostByIDFn: func(ctx context.Context, id string) (*document.Post, error) {
			return nil, mongo.ErrNoDocuments
		},
	}
	svc := newBlogService(repo)

	_, err := svc.GetPost(context.Background(), "507f1f77bcf86cd799439011")
	if !errors.Is(err, blogerrs.ErrPostNotFound) {
		t.Errorf("err = %v, want ErrPostNotFound", err)
	}
}

func TestBlogService_GetPost_Success(t *testing.T) {
	repo := &mockBlogRepo{
		getPostByIDFn: func(ctx context.Context, id string) (*document.Post, error) {
			return &document.Post{ID: id, Title: "Go Tips", Views: 10}, nil
		},
	}
	svc := newBlogService(repo)

	out, err := svc.GetPost(context.Background(), "507f1f77bcf86cd799439011")
	if err != nil {
		t.Fatalf("GetPost: %v", err)
	}
	if out.Title != "Go Tips" {
		t.Errorf("title = %q, want Go Tips", out.Title)
	}
	if out.Views != 10 {
		t.Errorf("views = %d, want 10", out.Views)
	}
}

// ---------- LikePost ----------

func TestBlogService_LikePost_InvalidID(t *testing.T) {
	svc := newBlogService(&mockBlogRepo{})

	_, err := svc.LikePost(context.Background(), "")
	if !errors.Is(err, blogerrs.ErrInvalidPostID) {
		t.Errorf("err = %v, want ErrInvalidPostID", err)
	}
}

func TestBlogService_LikePost_HexInvalid(t *testing.T) {
	svc := newBlogService(&mockBlogRepo{})

	_, err := svc.LikePost(context.Background(), "zzz")
	if !errors.Is(err, blogerrs.ErrInvalidPostID) {
		t.Errorf("err = %v, want ErrInvalidPostID", err)
	}
}

func TestBlogService_LikePost_Success(t *testing.T) {
	repo := &mockBlogRepo{
		incrementLikesFn: func(ctx context.Context, id string) (int, error) {
			return 42, nil
		},
	}
	svc := newBlogService(repo)

	likes, err := svc.LikePost(context.Background(), "507f1f77bcf86cd799439011")
	if err != nil {
		t.Fatalf("LikePost: %v", err)
	}
	if likes != 42 {
		t.Errorf("likes = %d, want 42", likes)
	}
}

// ---------- IncrementViews ----------

func TestBlogService_IncrementViews_EmptyID(t *testing.T) {
	svc := newBlogService(&mockBlogRepo{})

	err := svc.IncrementViews(context.Background(), "")
	if !errors.Is(err, blogerrs.ErrInvalidPostID) {
		t.Errorf("err = %v, want ErrInvalidPostID", err)
	}
}

func TestBlogService_IncrementViews_Success(t *testing.T) {
	called := false
	repo := &mockBlogRepo{
		incrementViewsFn: func(ctx context.Context, id string) error {
			called = true
			return nil
		},
	}
	svc := newBlogService(repo)

	err := svc.IncrementViews(context.Background(), "507f1f77bcf86cd799439011")
	if err != nil {
		t.Fatalf("IncrementViews: %v", err)
	}
	if !called {
		t.Error("repo.IncrementViews should be called")
	}
}

// ---------- ListPostsByTag ----------

func TestBlogService_ListPostsByTag_EmptyTag(t *testing.T) {
	svc := newBlogService(&mockBlogRepo{})

	_, err := svc.ListPostsByTag(context.Background(), "", 1, 10)
	if !errors.Is(err, blogerrs.ErrInvalidPostID) {
		t.Errorf("err = %v, want ErrInvalidPostID", err)
	}
}

func TestBlogService_ListPostsByTag_WhitespaceTag(t *testing.T) {
	svc := newBlogService(&mockBlogRepo{})

	_, err := svc.ListPostsByTag(context.Background(), "   ", 1, 10)
	if !errors.Is(err, blogerrs.ErrInvalidPostID) {
		t.Errorf("err = %v, want ErrInvalidPostID", err)
	}
}

func TestBlogService_ListPostsByTag_InvalidPagination(t *testing.T) {
	repo := &mockBlogRepo{
		listPostsByTagFn: func(ctx context.Context, tag string, page, perPage int) ([]document.Post, int64, error) {
			// 验证 page 和 perPage 被纠正到有效值
			if page != 1 {
				t.Errorf("page = %d, want 1", page)
			}
			if perPage != 10 {
				t.Errorf("perPage = %d, want 10", perPage)
			}
			return nil, 0, nil
		},
	}
	svc := newBlogService(repo)

	_, err := svc.ListPostsByTag(context.Background(), "go", 0, -5)
	if err != nil {
		t.Fatalf("ListPostsByTag: %v", err)
	}
}

// ---------- ListTags ----------

func TestBlogService_ListTags_Passthrough(t *testing.T) {
	repo := &mockBlogRepo{
		aggregateTagsFn: func(ctx context.Context) ([]document.TagCount, error) {
			return []document.TagCount{{Name: "go", Count: 5}, {Name: "vue", Count: 3}}, nil
		},
	}
	svc := newBlogService(repo)

	tags, err := svc.ListTags(context.Background())
	if err != nil {
		t.Fatalf("ListTags: %v", err)
	}
	if len(tags) != 2 {
		t.Errorf("len = %d, want 2", len(tags))
	}
}

// ---------- ListPosts ----------

func TestBlogService_ListPosts_NormalizesPage(t *testing.T) {
	var gotPage int
	repo := &mockBlogRepo{
		listPostsFn: func(ctx context.Context, page, perPage int, search string) ([]document.Post, int64, error) {
			gotPage = page
			return nil, 0, nil
		},
		aggregateTagsFn: func(ctx context.Context) ([]document.TagCount, error) { return nil, nil },
	}
	svc := newBlogService(repo)

	_, err := svc.ListPosts(context.Background(), 0, "")
	if err != nil {
		t.Fatalf("ListPosts: %v", err)
	}
	if gotPage != 1 {
		t.Errorf("page = %d, want 1 (normalized)", gotPage)
	}
}

// ---------- ToPostResponse ----------

func TestSerializePost_ZeroTime(t *testing.T) {
	p := document.Post{ID: "abc", Title: "T"}
	out := dto.ToPostResponse(p)
	if out.CreatedAt != "" {
		t.Errorf("CreatedAt = %q, want empty string for zero time", out.CreatedAt)
	}
	if out.UpdatedAt != "" {
		t.Errorf("UpdatedAt = %q, want empty string for zero time", out.UpdatedAt)
	}
	if out.Title != "T" {
		t.Errorf("title = %q, want T", out.Title)
	}
}

func TestSerializePosts_Empty(t *testing.T) {
	out := dto.ToPostList(nil)
	if len(out) != 0 {
		t.Errorf("len = %d, want 0", len(out))
	}
}

// ---------- pagination ----------

func TestPagination(t *testing.T) {
	tests := []struct {
		name                 string
		page, perPage, total int
		wantPages            int
		wantHasPrev          bool
		wantHasNext          bool
	}{
		{"first_page", 1, 10, 25, 3, false, true},
		{"middle_page", 2, 10, 25, 3, true, true},
		{"last_page", 3, 10, 25, 3, true, false},
		{"single_page", 1, 10, 5, 1, false, false},
		{"empty", 1, 10, 0, 0, false, false},
		{"exact_fit", 2, 10, 20, 2, true, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := pagination(tt.page, tt.perPage, tt.total)
			if p.Pages != tt.wantPages {
				t.Errorf("Pages = %d, want %d", p.Pages, tt.wantPages)
			}
			if p.HasPrev != tt.wantHasPrev {
				t.Errorf("HasPrev = %v, want %v", p.HasPrev, tt.wantHasPrev)
			}
			if p.HasNext != tt.wantHasNext {
				t.Errorf("HasNext = %v, want %v", p.HasNext, tt.wantHasNext)
			}
		})
	}
}

func TestPagination_PrevNextNum(t *testing.T) {
	// page=2, total=3 → prev=1, next=3
	p := pagination(2, 1, 3)
	if p.PrevNum == nil || *p.PrevNum != 1 {
		t.Errorf("PrevNum = %v, want 1", p.PrevNum)
	}
	if p.NextNum == nil || *p.NextNum != 3 {
		t.Errorf("NextNum = %v, want 3", p.NextNum)
	}

	// page=1 → no prev
	p = pagination(1, 1, 3)
	if p.PrevNum != nil {
		t.Errorf("PrevNum = %v, want nil (first page)", p.PrevNum)
	}

	// page=3 (last) → no next
	p = pagination(3, 1, 3)
	if p.NextNum != nil {
		t.Errorf("NextNum = %v, want nil (last page)", p.NextNum)
	}
}
