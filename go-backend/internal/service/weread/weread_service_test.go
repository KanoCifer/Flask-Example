package weread_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"

	"github.com/KanoCifer/kuroome-blog/internal/domain/weread/errs"
	"github.com/KanoCifer/kuroome-blog/internal/dto"
	"github.com/KanoCifer/kuroome-blog/internal/infra/httpclient"
	"github.com/KanoCifer/kuroome-blog/internal/service/weread"
)

// newTestService 构造一个指向测试服务器的 weread.Service。
func newTestService(t *testing.T) (*weread.Service, *miniredis.Miniredis, func()) {
	t.Helper()

	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("miniredis.Run: %v", err)
	}
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(sampleShelfPayload))
	}))

	repo := &mockRepository{token: "test-token"}
	// 用 WithBaseURL 注入测试服务器地址
	svc := weread.New(
		httpclient.New(),
		rdb,
		repo,
		weread.WithBaseURL(srv.URL),
	)

	cleanup := func() {
		srv.Close()
		_ = rdb.Close()
		mr.Close()
	}
	return svc, mr, cleanup
}

// ── FetchUserShelf ───────────────────────────────────────────────────

func TestService_FetchUserShelf_Roundtrip(t *testing.T) {
	svc, _, cleanup := newTestService(t)
	defer cleanup()

	resp, err := svc.FetchUserShelf(context.Background(), "user-1")
	if err != nil {
		t.Fatalf("FetchUserShelf: %v", err)
	}
	if resp == nil {
		t.Fatal("expected non-nil response")
	}
	if len(resp.Books) != 1 {
		t.Fatalf("expected 1 book, got %d", len(resp.Books))
	}
	if resp.Books[0].BookId != "abc123" {
		t.Errorf("bookId = %q, want abc123", resp.Books[0].BookId)
	}
	if resp.Books[0].Title != "三体" {
		t.Errorf("title = %q, want 三体", resp.Books[0].Title)
	}
	if resp.Books[0].Author != "刘慈欣" {
		t.Errorf("author = %q, want 刘慈欣", resp.Books[0].Author)
	}
	if resp.Books[0].ReadUpdateTime != 1700000000 {
		t.Errorf("readUpdateTime = %d, want 1700000000", resp.Books[0].ReadUpdateTime)
	}
	if !resp.Books[0].FinishReading {
		t.Error("finishReading should be true")
	}
	if !resp.Books[0].IsTop {
		t.Error("isTop should be true")
	}
	if len(resp.Archives) != 1 {
		t.Fatalf("expected 1 archive, got %d", len(resp.Archives))
	}
	if resp.Archives[0].ArchiveId != "arc1" {
		t.Errorf("archiveId = %q, want arc1", resp.Archives[0].ArchiveId)
	}
	if resp.Archives[0].Name != "我的书单" {
		t.Errorf("archive name = %q, want 我的书单", resp.Archives[0].Name)
	}
}

func TestService_FetchUserShelf_CacheHit(t *testing.T) {
	svc, mr, cleanup := newTestService(t)
	defer cleanup()

	ctx := context.Background()
	cacheKey := "weread:shelf:user-1"

	// 预填缓存（模拟上一次请求已写入）
	if err := mr.Set(cacheKey, sampleShelfPayload); err != nil {
		t.Fatalf("miniredis.Set: %v", err)
	}

	resp, err := svc.FetchUserShelf(ctx, "user-1")
	if err != nil {
		t.Fatalf("FetchUserShelf: %v", err)
	}
	if len(resp.Books) != 1 || resp.Books[0].BookId != "abc123" {
		t.Errorf("unexpected response: %+v", resp)
	}
}

func TestService_FetchUserShelf_Unauthorized(t *testing.T) {
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("miniredis: %v", err)
	}
	defer mr.Close()
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer rdb.Close()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":"unauthorized"}`))
	}))
	defer srv.Close()

	repo := &mockRepository{token: "bad"}
	svc := weread.New(httpclient.New(), rdb, repo, weread.WithBaseURL(srv.URL))

	_, err = svc.FetchUserShelf(context.Background(), "user-1")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestService_FetchUserShelf_InvalidJSON(t *testing.T) {
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("miniredis: %v", err)
	}
	defer mr.Close()
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer rdb.Close()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`not json`))
	}))
	defer srv.Close()

	repo := &mockRepository{token: "t"}
	svc := weread.New(httpclient.New(), rdb, repo, weread.WithBaseURL(srv.URL))

	_, err = svc.FetchUserShelf(context.Background(), "user-1")
	if err == nil {
		t.Fatal("expected error on invalid JSON, got nil")
	}
}

// ── CreateUserToken ──────────────────────────────────────────────────

func TestService_CreateUserToken_ValidToken(t *testing.T) {
	svc, _, cleanup := newTestService(t)
	defer cleanup()

	// 合法 token（wrk- 开头）应通过验证并委托给 repo
	err := svc.CreateUserToken(context.Background(), "user-1", "wrk-abc123")
	if err != nil {
		t.Fatalf("CreateUserToken: %v", err)
	}
}

func TestService_CreateUserToken_InvalidToken(t *testing.T) {
	svc, _, cleanup := newTestService(t)
	defer cleanup()

	// 非法 token（非 wrk- 开头）应返回 ErrInvaildWereadToken
	err := svc.CreateUserToken(context.Background(), "user-1", "invalid-token")
	if !errors.Is(err, errs.ErrInvaildWereadToken) {
		t.Errorf("expected ErrInvaildWereadToken, got %v", err)
	}
}

func TestService_CreateUserToken_EmptyToken(t *testing.T) {
	svc, _, cleanup := newTestService(t)
	defer cleanup()

	err := svc.CreateUserToken(context.Background(), "user-1", "")
	if !errors.Is(err, errs.ErrInvaildWereadToken) {
		t.Errorf("expected ErrInvaildWereadToken for empty token, got %v", err)
	}
}

func TestService_CreateUserToken_RepoError(t *testing.T) {
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("miniredis: %v", err)
	}
	defer mr.Close()
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer rdb.Close()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		_, _ = w.Write([]byte(`{}`))
	}))
	defer srv.Close()

	// repo 返回错误时应传播
	repo := &mockRepository{token: "t", createErr: errors.New("db error")}
	svc := weread.New(httpclient.New(), rdb, repo, weread.WithBaseURL(srv.URL))

	err = svc.CreateUserToken(context.Background(), "user-1", "wrk-valid")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

// ── DTO 序列化 ───────────────────────────────────────────────────────

func TestDTO_WereadShelfResponse_MarshalRoundtrip(t *testing.T) {
	original := dto.WereadShelfResponse{
		Books: []dto.WereadShelfBook{
			{
				BookId: "b1", Title: "书", Author: "作者", Cover: "https://x.com/c.jpg",
				Category: "科幻", ReadUpdateTime: 100, UpdateTime: 200,
				FinishReading: true, Secret: false, IsTop: true,
			},
		},
		Archives: []dto.WereadShelfArchive{
			{ArchiveId: "a1", Name: "书单", BookIds: []string{"b1"}},
		},
	}

	data, err := json.Marshal(original)
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}

	var decoded dto.WereadShelfResponse
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal: %v", err)
	}

	if len(decoded.Books) != 1 || decoded.Books[0].BookId != "b1" {
		t.Errorf("books roundtrip failed: %+v", decoded.Books)
	}
	if len(decoded.Archives) != 1 || decoded.Archives[0].Name != "书单" {
		t.Errorf("archives roundtrip failed: %+v", decoded.Archives)
	}
}

func TestDTO_WereadShelfResponse_Empty(t *testing.T) {
	// 空书架应序列化为 {"books":[],"archives":[]}
	empty := dto.WereadShelfResponse{
		Books:    []dto.WereadShelfBook{},
		Archives: []dto.WereadShelfArchive{},
	}
	data, err := json.Marshal(empty)
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}
	if string(data) != `{"books":[],"archives":[]}` {
		t.Errorf("empty payload = %q", data)
	}
}

// ── 接口断言 ─────────────────────────────────────────────────────────

var _ weread.Reader = (*weread.Service)(nil)

// 防止 unused import
var _ = time.Second
