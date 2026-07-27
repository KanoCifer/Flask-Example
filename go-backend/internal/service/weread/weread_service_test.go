package weread_test

import (
	"context"
	"encoding/json"
	"errors"
	"io"
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

// ── FetchBookInfo ───────────────────────────────────────────────────

const sampleBookPayload = `{
	"bookId": "book-1",
	"title": "三体",
	"author": "刘慈欣",
	"translator": null,
	"cover": "http://example.com/cover.jpg",
	"intro": "地球文明向宇宙发出第一声啼鸣。",
	"category": "科幻",
	"publisher": "重庆出版社",
	"publishTime": "2008-01",
	"isbn": "9787536692930",
	"wordCount": 200000,
	"newRating": 92.5,
	"newRatingCount": 1000,
	"newRatingDetail": {"5": 800, "4": 150, "3": 50}
}`

func TestService_FetchBookInfo_Roundtrip(t *testing.T) {
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("miniredis: %v", err)
	}
	defer mr.Close()
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer rdb.Close()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(sampleBookPayload))
	}))
	defer srv.Close()

	repo := &mockRepository{token: "test-token"}
	svc := weread.New(httpclient.New(), rdb, repo, weread.WithBaseURL(srv.URL))

	resp, err := svc.FetchBookInfo(context.Background(), "user-1", "book-1")
	if err != nil {
		t.Fatalf("FetchBookInfo: %v", err)
	}
	if resp == nil {
		t.Fatal("expected non-nil response")
	}
	if resp.ID != "book-1" {
		t.Errorf("id = %q, want book-1", resp.ID)
	}
	if resp.Title != "三体" {
		t.Errorf("title = %q, want 三体", resp.Title)
	}
	if resp.Author != "刘慈欣" {
		t.Errorf("author = %q, want 刘慈欣", resp.Author)
	}
	if resp.Introduction != "地球文明向宇宙发出第一声啼鸣。" {
		t.Errorf("introduction = %q", resp.Introduction)
	}
	if resp.Publisher != "重庆出版社" {
		t.Errorf("publisher = %q, want 重庆出版社", resp.Publisher)
	}
	if resp.WordCount != 200000 {
		t.Errorf("wordCount = %d, want 200000", resp.WordCount)
	}
	if resp.NewRating != 92.5 {
		t.Errorf("newRating = %f, want 92.5", resp.NewRating)
	}
	if resp.NewRatingCount != 1000 {
		t.Errorf("newRatingCount = %d, want 1000", resp.NewRatingCount)
	}
	if resp.NewRatingDetails["5"] != 800 {
		t.Errorf("newRatingDetails[5] = %d, want 800", resp.NewRatingDetails["5"])
	}
	if resp.FetchedAt.IsZero() {
		t.Error("fetchedAt should be set")
	}
}

func TestService_FetchBookInfo_RequestSendsBookId(t *testing.T) {
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("miniredis: %v", err)
	}
	defer mr.Close()
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer rdb.Close()

	var gotBookId string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var payload map[string]any
		_ = json.Unmarshal(body, &payload)
		if extra, ok := payload["bookId"]; ok {
			gotBookId = extra.(string)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(sampleBookPayload))
	}))
	defer srv.Close()

	repo := &mockRepository{token: "test-token"}
	svc := weread.New(httpclient.New(), rdb, repo, weread.WithBaseURL(srv.URL))

	_, err = svc.FetchBookInfo(context.Background(), "user-1", "book-42")
	if err != nil {
		t.Fatalf("FetchBookInfo: %v", err)
	}
	if gotBookId != "book-42" {
		t.Errorf("bookId in request = %q, want book-42", gotBookId)
	}
}

func TestService_FetchBookInfo_CacheHit(t *testing.T) {
	svc, mr, cleanup := newTestService(t)
	defer cleanup()

	ctx := context.Background()
	cacheKey := "weread:book:book-1"
	if err := mr.Set(cacheKey, sampleBookPayload); err != nil {
		t.Fatalf("miniredis.Set: %v", err)
	}

	resp, err := svc.FetchBookInfo(ctx, "user-1", "book-1")
	if err != nil {
		t.Fatalf("FetchBookInfo: %v", err)
	}
	if resp.ID != "book-1" || resp.Title != "三体" {
		t.Errorf("unexpected response: %+v", resp)
	}
}

func TestService_FetchBookInfo_Unauthorized(t *testing.T) {
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

	_, err = svc.FetchBookInfo(context.Background(), "user-1", "book-1")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestService_FetchBookInfo_InvalidJSON(t *testing.T) {
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

	_, err = svc.FetchBookInfo(context.Background(), "user-1", "book-1")
	if err == nil {
		t.Fatal("expected error on invalid JSON, got nil")
	}
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

func TestDTO_WereadBookResponse_MarshalRoundtrip(t *testing.T) {
	original := dto.WereadBookResponse{
		ID:               "book-1",
		Title:            "三体",
		Author:           "刘慈欣",
		Translator:       "译者",
		Cover:            "https://x.com/c.jpg",
		Introduction:     "简介",
		Category:         "科幻",
		Publisher:        "出版社",
		PublishTime:      "2008-01",
		ISBN:             "9787536692930",
		WordCount:        200000,
		NewRating:        92.5,
		NewRatingCount:   1000,
		NewRatingDetails: map[string]int{"5": 800, "4": 150},
		FetchedAt:        time.Now().UTC().Truncate(time.Second),
	}

	data, err := json.Marshal(original)
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}

	var decoded dto.WereadBookResponse
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal: %v", err)
	}

	if decoded.ID != "book-1" || decoded.Title != "三体" || decoded.Author != "刘慈欣" {
		t.Errorf("basic fields roundtrip failed: %+v", decoded)
	}
	if decoded.Introduction != "简介" {
		t.Errorf("introduction = %q, want 简介", decoded.Introduction)
	}
	if decoded.NewRatingDetails["5"] != 800 {
		t.Errorf("newRatingDetails = %v", decoded.NewRatingDetails)
	}
	if !decoded.FetchedAt.Equal(original.FetchedAt) {
		t.Errorf("fetchedAt = %v, want %v", decoded.FetchedAt, original.FetchedAt)
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
