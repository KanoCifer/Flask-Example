package weread_test

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync/atomic"
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
	if resp.Books[0].FinishReading == 0 {
		t.Error("finishReading should be non-zero")
	}
	// 上游 books 数组不含 isTop，转换后默认为 0
	if resp.Books[0].IsTop != 0 {
		t.Errorf("isTop = %d, want 0 (upstream books field has no isTop)", resp.Books[0].IsTop)
	}
	if len(resp.Archives) != 1 {
		t.Fatalf("expected 1 archive, got %d", len(resp.Archives))
	}
	// 上游 archive 数组不含 archiveId，转换后为空串
	if resp.Archives[0].ArchiveId != "" {
		t.Errorf("archiveId = %q, want empty (upstream archive field has no archiveId)", resp.Archives[0].ArchiveId)
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
				FinishReading: 1, Secret: 0, IsTop: 1,
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
	if string(data) != `{"user_books":[],"archives":[]}` {
		t.Errorf("empty payload = %q", data)
	}
}

func TestParseShelfRaw_FromUpstream(t *testing.T) {
	// 模拟上游 /shelf/sync 真实结构
	raw := dto.WereadShelfRaw{
		Books: []dto.WereadShelfBookRaw{
			{
				BookId: "b1", Title: "书", Author: "作者", Cover: "https://x.com/c.jpg",
				Category: strPtr("科幻"), ReadUpdateTime: 100, UpdateTime: 200,
				FinishReading: 1, Secret: 0,
			},
			{
				BookId: "b2", Title: "无分类书", Author: "某人", Cover: "",
				Category:      nil, // 测试 nil category
				FinishReading: 0, Secret: 1,
			},
		},
		Archive: []dto.WereadShelfArchiveRaw{
			{BookIds: []string{"b1"}, Name: "书单", AlbumIds: []any{"al1", 123}},
		},
	}

	resp := dto.ParseShelfRaw(raw)

	if len(resp.Books) != 2 {
		t.Fatalf("expected 2 books, got %d", len(resp.Books))
	}
	if resp.Books[0].Category != "科幻" {
		t.Errorf("book[0].Category = %q, want 科幻", resp.Books[0].Category)
	}
	if resp.Books[0].FinishReading != 1 {
		t.Errorf("book[0].FinishReading = %d, want 1", resp.Books[0].FinishReading)
	}
	if resp.Books[1].Category != "" {
		t.Errorf("book[1].Category = %q, want empty string", resp.Books[1].Category)
	}
	if resp.Books[1].Secret != 1 {
		t.Errorf("book[1].Secret = %d, want 1", resp.Books[1].Secret)
	}

	if len(resp.Archives) != 1 {
		t.Fatalf("expected 1 archive, got %d", len(resp.Archives))
	}
	if resp.Archives[0].Name != "书单" {
		t.Errorf("archive name = %q, want 书单", resp.Archives[0].Name)
	}
	if len(resp.Archives[0].AlbumIds) != 1 || resp.Archives[0].AlbumIds[0] != "al1" {
		t.Errorf("albumIds filter failed: %+v", resp.Archives[0].AlbumIds)
	}
}

func strPtr(s string) *string { return &s }

// ── FetchReadDetail ──────────────────────────────────────────────────

func TestService_FetchReadDetail_Roundtrip(t *testing.T) {
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("miniredis: %v", err)
	}
	defer mr.Close()
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer rdb.Close()

	var reqCount atomic.Int64
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reqCount.Add(1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(sampleReadDetailPayload))
	}))
	defer srv.Close()

	repo := &mockRepository{token: "test-token"}
	svc := weread.New(httpclient.New(), rdb, repo, weread.WithBaseURL(srv.URL))

	ctx := context.Background()
	resp, err := svc.FetchReadDetail(ctx, "user-1", "overall", nil)
	if err != nil {
		t.Fatalf("FetchReadDetail: %v", err)
	}
	if resp == nil {
		t.Fatal("expected non-nil response")
	}
	if resp.UserID != 42 {
		t.Errorf("userID = %d, want 42", resp.UserID)
	}
	if resp.Mode != "overall" {
		t.Errorf("mode = %q, want overall", resp.Mode)
	}
	if resp.BaseTime != 0 {
		t.Errorf("baseTime = %d, want 0", resp.BaseTime)
	}
	if resp.FetchedAt == "" {
		t.Error("fetchedAt should be set")
	}
	if resp.ReadDays == nil || *resp.ReadDays != 5 {
		t.Errorf("readDays = %v, want 5", resp.ReadDays)
	}
	if resp.TotalReadTime == nil || *resp.TotalReadTime != 3600 {
		t.Errorf("totalReadTime = %v, want 3600", resp.TotalReadTime)
	}
	if len(resp.ReadTimes) != 1 || resp.ReadTimes["1700000000"] != 120 {
		t.Errorf("readTimes = %v, want {1700000000:120}", resp.ReadTimes)
	}
	if len(resp.ReadLongest) != 1 {
		t.Fatalf("expected 1 readLongest item, got %d", len(resp.ReadLongest))
	}
	longest := resp.ReadLongest[0]
	if longest.ReadTime != 600 {
		t.Errorf("readLongest.readTime = %d, want 600", longest.ReadTime)
	}
	if longest.Book == nil {
		t.Fatal("readLongest.book should be non-nil")
	}
	if longest.Book.Title == nil || *longest.Book.Title != "三体" {
		t.Errorf("readLongest.book.title = %v, want 三体", longest.Book.Title)
	}
	if longest.Book.Author == nil || *longest.Book.Author != "刘慈欣" {
		t.Errorf("readLongest.book.author = %v, want 刘慈欣", longest.Book.Author)
	}
	if resp.Rank == nil || resp.Rank.Text != "Top 10%" {
		t.Errorf("rank = %v, want Text=Top 10%%", resp.Rank)
	}
	if resp.Rank != nil && resp.Rank.Scheme != "gold" {
		t.Errorf("rank.scheme = %q, want gold", resp.Rank.Scheme)
	}
	if resp.Compare == nil || *resp.Compare != 1.5 {
		t.Errorf("compare = %v, want 1.5", resp.Compare)
	}
	if len(resp.PreferCategory) != 1 {
		t.Fatalf("expected 1 preferCategory, got %d", len(resp.PreferCategory))
	}
	if resp.PreferCategory[0].CategoryTitle != "科幻" {
		t.Errorf("preferCategory[0].categoryTitle = %q, want 科幻", resp.PreferCategory[0].CategoryTitle)
	}
	if resp.PreferCategory[0].ReadingCount != 3 {
		t.Errorf("preferCategory[0].readingCount = %d, want 3", resp.PreferCategory[0].ReadingCount)
	}
	if resp.PreferCategoryWord == nil || *resp.PreferCategoryWord != "最爱科幻" {
		t.Errorf("preferCategoryWord = %v, want 最爱科幻", resp.PreferCategoryWord)
	}
	if len(resp.ReadStat) != 1 {
		t.Fatalf("expected 1 readStat, got %d", len(resp.ReadStat))
	}
	if resp.ReadStat[0].Stat != "weekday" {
		t.Errorf("readStat[0].stat = %q, want weekday", resp.ReadStat[0].Stat)
	}
	if len(resp.PreferAuthor) != 1 {
		t.Fatalf("expected 1 preferAuthor, got %d", len(resp.PreferAuthor))
	}
	if resp.PreferAuthor[0].Name == nil || *resp.PreferAuthor[0].Name != "刘慈欣" {
		t.Errorf("preferAuthor[0].name = %v, want 刘慈欣", resp.PreferAuthor[0].Name)
	}
	if resp.PreferAuthor[0].Count == nil || *resp.PreferAuthor[0].Count != 5 {
		t.Errorf("preferAuthor[0].count = %v, want 5", resp.PreferAuthor[0].Count)
	}
	if resp.AuthorCount == nil || *resp.AuthorCount != 10 {
		t.Errorf("authorCount = %v, want 10", resp.AuthorCount)
	}
	if len(resp.PreferPublisher) != 1 {
		t.Fatalf("expected 1 preferPublisher, got %d", len(resp.PreferPublisher))
	}
	if resp.PreferPublisher[0].Name == nil || *resp.PreferPublisher[0].Name != "重庆出版社" {
		t.Errorf("preferPublisher[0].name = %v, want 重庆出版社", resp.PreferPublisher[0].Name)
	}
	if resp.PreferPublisher[0].Count != 3 {
		t.Errorf("preferPublisher[0].count = %d, want 3", resp.PreferPublisher[0].Count)
	}
	if resp.ReadRate == nil || *resp.ReadRate != 80 {
		t.Errorf("readRate = %v, want 80", resp.ReadRate)
	}
	if resp.WrReadTime == nil || *resp.WrReadTime != 7200 {
		t.Errorf("wrReadTime = %v, want 7200", resp.WrReadTime)
	}
	if resp.WrListenTime == nil || *resp.WrListenTime != 600 {
		t.Errorf("wrListenTime = %v, want 600", resp.WrListenTime)
	}
	if len(resp.PreferTime) != 3 {
		t.Errorf("preferTime length = %d, want 3", len(resp.PreferTime))
	}
	if resp.PreferTimeWord == nil || *resp.PreferTimeWord != "evening" {
		t.Errorf("preferTimeWord = %v, want evening", resp.PreferTimeWord)
	}

	// 第二次调用应命中缓存，不再请求上游
	if _, err := svc.FetchReadDetail(ctx, "user-1", "overall", nil); err != nil {
		t.Fatalf("FetchReadDetail (2nd): %v", err)
	}
	if got := reqCount.Load(); got != 1 {
		t.Errorf("expected 1 upstream request (cache hit on 2nd call), got %d", got)
	}
}

func TestService_FetchReadDetail_Unauthorized(t *testing.T) {
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

	_, err = svc.FetchReadDetail(context.Background(), "user-1", "overall", nil)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !errors.Is(err, weread.ErrUnauthorized) {
		t.Errorf("expected ErrUnauthorized, got %v", err)
	}
}

// sampleReadDetailPayload 是 /readdata/detail 的完整上游响应，覆盖所有 mode 的嵌套字段。
const sampleReadDetailPayload = `{
	"user_id": 42,
	"mode": "overall",
	"baseTime": 0,
	"readTimes": {"1700000000": 120},
	"readDays": 5,
	"totalReadTime": 3600,
	"readLongest": [
		{
			"book": {
				"bookId": "b1",
				"title": "三体",
				"author": "刘慈欣",
				"translator": "译者",
				"intro": "简介",
				"cover": "http://example.com/c.jpg"
			},
			"readTime": 600,
			"tags": ["sci-fi"]
		}
	],
	"rank": {"text": "Top 10%", "scheme": "gold"},
	"compare": 1.5,
	"dayAverageReadTime": 720,
	"preferCategory": [{"categoryTitle": "科幻", "readingCount": 3, "readingTime": 10800}],
	"preferCategoryWord": "最爱科幻",
	"readStat": [{"stat": "weekday", "counts": "10"}],
	"preferAuthor": [{"name": "刘慈欣", "count": 5, "readTime": "10800"}],
	"authorCount": 10,
	"preferPublisher": [{"name": "重庆出版社", "count": 3}],
	"readRate": 80,
	"wrReadTime": 7200,
	"wrListenTime": 600,
	"preferTime": [1, 2, 3],
	"preferTimeWord": "evening"
}`

// ── FetchYearlyHeatmap ───────────────────────────────────────────────

func TestService_FetchYearlyHeatmap_Concurrent(t *testing.T) {
	t.Run("all months succeed", func(t *testing.T) {
		mr, err := miniredis.Run()
		if err != nil {
			t.Fatalf("miniredis: %v", err)
		}
		defer mr.Close()
		rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
		defer rdb.Close()

		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			body, _ := io.ReadAll(r.Body)
			var payload map[string]any
			_ = json.Unmarshal(body, &payload)
			baseTime, _ := payload["baseTime"].(float64)
			w.Header().Set("Content-Type", "application/json")
			resp := map[string]any{
				"readTimes": map[string]int{strconv.Itoa(int(baseTime)): 120},
			}
			data, _ := json.Marshal(resp)
			_, _ = w.Write(data)
		}))
		defer srv.Close()

		repo := &mockRepository{token: "test-token"}
		svc := weread.New(httpclient.New(), rdb, repo, weread.WithBaseURL(srv.URL))

		heatmap, err := svc.FetchYearlyHeatmap(context.Background(), "user-1", nil)
		if err != nil {
			t.Fatalf("FetchYearlyHeatmap: %v", err)
		}
		// 当前年份应拉取多个月（1..当前月），合并后应有多个条目
		if len(heatmap) < 2 {
			t.Errorf("expected entries from multiple months, got %d: %v", len(heatmap), heatmap)
		}
		for k, v := range heatmap {
			if v != 120 {
				t.Errorf("heatmap[%s] = %d, want 120", k, v)
			}
		}
	})

	t.Run("partial failure returns partial result", func(t *testing.T) {
		mr, err := miniredis.Run()
		if err != nil {
			t.Fatalf("miniredis: %v", err)
		}
		defer mr.Close()
		rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
		defer rdb.Close()

		// 计算服务将请求的各月 baseTime，让后半段月份返回 500 模拟部分失败。
		now := time.Now()
		targetYear := now.Year()
		lastMonth := int(now.Month())
		timestamps := make([]int, 0, lastMonth)
		for m := 1; m <= lastMonth; m++ {
			ts := time.Date(targetYear, time.Month(m), 1, 0, 0, 0, 0, now.Location())
			timestamps = append(timestamps, int(ts.Unix()))
		}
		failFrom := len(timestamps) / 2
		failing := make(map[int]bool, len(timestamps)-failFrom)
		for _, ts := range timestamps[failFrom:] {
			failing[ts] = true
		}

		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			body, _ := io.ReadAll(r.Body)
			var payload map[string]any
			_ = json.Unmarshal(body, &payload)
			baseTime, _ := payload["baseTime"].(float64)
			if failing[int(baseTime)] {
				w.WriteHeader(http.StatusInternalServerError)
				_, _ = w.Write([]byte(`{"error":"boom"}`))
				return
			}
			w.Header().Set("Content-Type", "application/json")
			resp := map[string]any{
				"readTimes": map[string]int{strconv.Itoa(int(baseTime)): 120},
			}
			data, _ := json.Marshal(resp)
			_, _ = w.Write(data)
		}))
		defer srv.Close()

		repo := &mockRepository{token: "test-token"}
		svc := weread.New(httpclient.New(), rdb, repo, weread.WithBaseURL(srv.URL))

		heatmap, err := svc.FetchYearlyHeatmap(context.Background(), "user-1", nil)
		if err != nil {
			t.Fatalf("FetchYearlyHeatmap should not error on partial failure, got: %v", err)
		}
		// 部分成功：结果非空，成功月份存在，失败月份不存在
		if len(heatmap) == 0 {
			t.Error("expected non-empty partial result")
		}
		for _, ts := range timestamps[:failFrom] {
			if _, ok := heatmap[strconv.Itoa(ts)]; !ok {
				t.Errorf("heatmap should contain successful baseTime %d", ts)
			}
		}
		for _, ts := range timestamps[failFrom:] {
			if _, ok := heatmap[strconv.Itoa(ts)]; ok {
				t.Errorf("heatmap should not contain failed baseTime %d", ts)
			}
		}
	})
}

// ── FetchBooksRecommend ──────────────────────────────────────────────

func TestService_FetchBooksRecommend_BothShapes(t *testing.T) {
	t.Run("direct list shape", func(t *testing.T) {
		mr, err := miniredis.Run()
		if err != nil {
			t.Fatalf("miniredis: %v", err)
		}
		defer mr.Close()
		rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
		defer rdb.Close()

		const payload = `[{"bookId":"b1","title":"t","author":"a","cover":"http://x.com/c.jpg","reason":"r","readingCount":1,"searchIdx":0,"newRating":90}]`
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(payload))
		}))
		defer srv.Close()

		repo := &mockRepository{token: "test-token"}
		svc := weread.New(httpclient.New(), rdb, repo, weread.WithBaseURL(srv.URL))

		items, err := svc.FetchBooksRecommend(context.Background(), "user-1", 10, 0)
		if err != nil {
			t.Fatalf("FetchBooksRecommend: %v", err)
		}
		if len(items) != 1 {
			t.Fatalf("expected 1 item, got %d", len(items))
		}
		assertRecommendItem(t, items[0], "b1", "t", "a", "r", 1, 0, 90, true)
	})

	t.Run("wrapped shape", func(t *testing.T) {
		mr, err := miniredis.Run()
		if err != nil {
			t.Fatalf("miniredis: %v", err)
		}
		defer mr.Close()
		rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
		defer rdb.Close()

		const payload = `{"books": [{"book":{"bookId":"b1","title":"t","author":"a","cover":"http://x.com/c.jpg"},"reason":"r","readingCount":1,"searchIdx":0,"newRating":90}]}`
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(payload))
		}))
		defer srv.Close()

		repo := &mockRepository{token: "test-token"}
		svc := weread.New(httpclient.New(), rdb, repo, weread.WithBaseURL(srv.URL))

		items, err := svc.FetchBooksRecommend(context.Background(), "user-1", 10, 0)
		if err != nil {
			t.Fatalf("FetchBooksRecommend: %v", err)
		}
		if len(items) != 1 {
			t.Fatalf("expected 1 item, got %d", len(items))
		}
		assertRecommendItem(t, items[0], "b1", "t", "a", "r", 1, 0, 90, true)
	})
}

// assertRecommendItem 校验 BookRecommendItem 各字段映射。
// hasCover 控制是否断言 Cover 非 nil。
func assertRecommendItem(t *testing.T, item dto.BookRecommendItem, bookID, title, author, reason string, readingCount, searchIdx, newRating int, hasCover bool) {
	t.Helper()
	if item.BookId != bookID {
		t.Errorf("bookId = %q, want %q", item.BookId, bookID)
	}
	if item.Title != title {
		t.Errorf("title = %q, want %q", item.Title, title)
	}
	if item.Author != author {
		t.Errorf("author = %q, want %q", item.Author, author)
	}
	if item.Reason != reason {
		t.Errorf("reason = %q, want %q", item.Reason, reason)
	}
	if item.ReadingCount != readingCount {
		t.Errorf("readingCount = %d, want %d", item.ReadingCount, readingCount)
	}
	if item.SearchIdx != searchIdx {
		t.Errorf("searchIdx = %d, want %d", item.SearchIdx, searchIdx)
	}
	if item.NewRating != newRating {
		t.Errorf("newRating = %d, want %d", item.NewRating, newRating)
	}
	if hasCover {
		if item.Cover == nil || *item.Cover == "" {
			t.Errorf("expected non-nil non-empty cover, got %v", item.Cover)
		}
	} else {
		if item.Cover != nil {
			t.Errorf("expected nil cover, got %q", *item.Cover)
		}
	}
}

// ── FetchBookProgress ────────────────────────────────────────────────

// sampleBookProgressNested 是上游 /book/getprogress 的嵌套形态:
// 顶层仅 bookId/timestamp,进度字段包在 raw["book"] 里。
const sampleBookProgressNested = `{
	"bookId": "book-1",
	"timestamp": 1700000000,
	"book": {
		"chapterUid": 100,
		"chapterOffset": 50,
		"progress": 42,
		"updateTime": 1700000000,
		"readingTime": 3600,
		"finishTime": 0,
		"isStartReading": 1
	}
}`

// sampleBookProgressFlat 是直平形态:进度字段直接在顶层。
const sampleBookProgressFlat = `{
	"chapterUid": 100,
	"chapterOffset": 50,
	"progress": 42,
	"updateTime": 1700000000,
	"readingTime": 3600,
	"finishTime": 0,
	"isStartReading": 1
}`

// buildProgressService 构造指向指定响应的测试 Service,复用 newTestService 的固定 token。
func buildProgressService(t *testing.T, mr *miniredis.Miniredis, srv *httptest.Server) *weread.Service {
	t.Helper()
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })

	repo := &mockRepository{token: "test-token"}
	return weread.New(httpclient.New(), rdb, repo, weread.WithBaseURL(srv.URL))
}

func TestService_FetchBookProgress_NestedShape(t *testing.T) {
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("miniredis: %v", err)
	}
	t.Cleanup(mr.Close)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(sampleBookProgressNested))
	}))
	t.Cleanup(srv.Close)

	svc := buildProgressService(t, mr, srv)

	p, err := svc.FetchBookProgress(context.Background(), "user-1", "book-1", false)
	if err != nil {
		t.Fatalf("FetchBookProgress: %v", err)
	}
	if p == nil {
		t.Fatal("expected non-nil progress")
	}
	if p.ChapterUid == nil || *p.ChapterUid != 100 {
		t.Errorf("chapterUid = %v, want 100", p.ChapterUid)
	}
	if p.ChapterOffset == nil || *p.ChapterOffset != 50 {
		t.Errorf("chapterOffset = %v, want 50", p.ChapterOffset)
	}
	if p.Progress == nil || *p.Progress != 42 {
		t.Errorf("progress = %v, want 42", p.Progress)
	}
	if p.ReadingTime != 3600 {
		t.Errorf("readingTime = %d, want 3600", p.ReadingTime)
	}
	if p.IsStartReading == nil || *p.IsStartReading != 1 {
		t.Errorf("isStartReading = %v, want 1", p.IsStartReading)
	}
}

func TestService_FetchBookProgress_FlatShape(t *testing.T) {
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("miniredis: %v", err)
	}
	t.Cleanup(mr.Close)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(sampleBookProgressFlat))
	}))
	t.Cleanup(srv.Close)

	svc := buildProgressService(t, mr, srv)

	p, err := svc.FetchBookProgress(context.Background(), "user-1", "book-1", false)
	if err != nil {
		t.Fatalf("FetchBookProgress: %v", err)
	}
	if p.ChapterUid == nil || *p.ChapterUid != 100 {
		t.Errorf("chapterUid = %v, want 100", p.ChapterUid)
	}
	if p.ReadingTime != 3600 {
		t.Errorf("readingTime = %d, want 3600", p.ReadingTime)
	}
}

func TestService_FetchBookProgress_CacheHitOnSecondCall(t *testing.T) {
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("miniredis: %v", err)
	}
	t.Cleanup(mr.Close)

	var reqCount atomic.Int64
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		reqCount.Add(1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(sampleBookProgressNested))
	}))
	t.Cleanup(srv.Close)

	svc := buildProgressService(t, mr, srv)
	ctx := context.Background()

	// 第一次:缓存未命中,请求上游并写缓存。
	if _, err := svc.FetchBookProgress(ctx, "user-1", "book-1", false); err != nil {
		t.Fatalf("FetchBookProgress (1st): %v", err)
	}
	// 第二次:应直接命中缓存。
	if _, err := svc.FetchBookProgress(ctx, "user-1", "book-1", false); err != nil {
		t.Fatalf("FetchBookProgress (2nd): %v", err)
	}
	if got := reqCount.Load(); got != 1 {
		t.Errorf("expected 1 upstream request (cache hit on 2nd), got %d", got)
	}

	// 缓存键校验
	cacheKey := "weread:book-progress:user-1:book-1"
	if !mr.Exists(cacheKey) {
		t.Errorf("cache key %q should exist", cacheKey)
	}
}

func TestService_FetchBookProgress_RefreshBypassesCache(t *testing.T) {
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("miniredis: %v", err)
	}
	t.Cleanup(mr.Close)

	var reqCount atomic.Int64
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		reqCount.Add(1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(sampleBookProgressNested))
	}))
	t.Cleanup(srv.Close)

	svc := buildProgressService(t, mr, srv)
	ctx := context.Background()

	// 第一次:写缓存。
	if _, err := svc.FetchBookProgress(ctx, "user-1", "book-1", false); err != nil {
		t.Fatalf("FetchBookProgress (1st): %v", err)
	}
	// 第二次 (refresh=true):绕过旧缓存,重新请求上游。
	if _, err := svc.FetchBookProgress(ctx, "user-1", "book-1", true); err != nil {
		t.Fatalf("FetchBookProgress (refresh): %v", err)
	}
	if got := reqCount.Load(); got != 2 {
		t.Errorf("expected 2 upstream requests (refresh bypasses cache), got %d", got)
	}
	// refresh 后缓存应存在新值
	if !mr.Exists("weread:book-progress:user-1:book-1") {
		t.Errorf("cache should be repopulated after refresh")
	}
}

func TestService_FetchBookProgress_Unauthorized(t *testing.T) {
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("miniredis: %v", err)
	}
	t.Cleanup(mr.Close)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":"unauthorized"}`))
	}))
	t.Cleanup(srv.Close)

	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })
	repo := &mockRepository{token: "bad"}
	svc := weread.New(httpclient.New(), rdb, repo, weread.WithBaseURL(srv.URL))

	_, err = svc.FetchBookProgress(context.Background(), "user-1", "book-1", false)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !errors.Is(err, weread.ErrUnauthorized) {
		t.Errorf("expected ErrUnauthorized, got %v", err)
	}
}

// sampleBookProgressRealUpstream 是 trace_id=0c604ad8 回归的完整 upstream 形态:
// 顶层 bookId/timestamp/upgrade_info,嵌套 book 内含完整阅读进度字段。
// task-235 引入 — 锁定真实契约,防止后续再把 isStartReading 误判为 string。
const sampleBookProgressRealUpstream = `{
	"bookId": "book-1",
	"timestamp": 1700000000,
	"book": {
		"appId": "app",
		"bookVersion": 1,
		"reviewId": "r1",
		"chapterUid": 100,
		"chapterOffset": 50,
		"chapterIdx": 5,
		"updateTime": 1700000000,
		"synckey": 1,
		"summary": "summary",
		"repairOffsetTime": 0,
		"readingTime": 3600,
		"progress": 42,
		"isStartReading": 1,
		"ttsTime": 0,
		"startReadingTime": 1699999999,
		"installId": "inst",
		"recordReadingTime": 3600
	},
	"upgrade_info": {
		"latest_version": "1.0.0",
		"current_version": "1.0.0",
		"message": "",
		"upgrade_url": ""
	}
}`

// TestService_FetchBookProgress_RealUpstream 回归测试:
// isStartReading 必须是 number(0/1),不能被任何上游新增字段拖入 unmarshal 失败。
func TestService_FetchBookProgress_RealUpstream(t *testing.T) {
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("miniredis: %v", err)
	}
	t.Cleanup(mr.Close)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(sampleBookProgressRealUpstream))
	}))
	t.Cleanup(srv.Close)

	svc := buildProgressService(t, mr, srv)

	p, err := svc.FetchBookProgress(context.Background(), "user-1", "book-1", false)
	if err != nil {
		t.Fatalf("FetchBookProgress: %v", err)
	}
	if p == nil {
		t.Fatal("expected non-nil progress")
	}
	if p.IsStartReading == nil || *p.IsStartReading != 1 {
		t.Errorf("isStartReading = %v, want 1 (number from upstream)", p.IsStartReading)
	}
	if p.Progress == nil || *p.Progress != 42 {
		t.Errorf("progress = %v, want 42", p.Progress)
	}
	if p.ReadingTime != 3600 {
		t.Errorf("readingTime = %d, want 3600", p.ReadingTime)
	}
}

func TestService_FetchBookProgress_InvalidJSON(t *testing.T) {
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("miniredis: %v", err)
	}
	t.Cleanup(mr.Close)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`not json`))
	}))
	t.Cleanup(srv.Close)

	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })
	repo := &mockRepository{token: "t"}
	svc := weread.New(httpclient.New(), rdb, repo, weread.WithBaseURL(srv.URL))

	_, err = svc.FetchBookProgress(context.Background(), "user-1", "book-1", false)
	if err == nil {
		t.Fatal("expected error on invalid JSON, got nil")
	}
}

// ── 接口断言 ─────────────────────────────────────────────────────────

var _ weread.Reader = (*weread.Service)(nil)

// 防止 unused import
var _ = time.Second
