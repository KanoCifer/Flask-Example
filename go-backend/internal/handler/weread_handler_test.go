package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/KanoCifer/kuroome-blog/internal/dto"
	"github.com/KanoCifer/kuroome-blog/internal/response"
	"github.com/KanoCifer/kuroome-blog/internal/service/weread"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// ── mock Wereader ────────────────────────────────────────────────────

type mockWereader struct {
	fetchFn            func(ctx context.Context, userID string) (*dto.WereadShelfResponse, error)
	createFn           func(ctx context.Context, userID string, token string) error
	fetchBookFn        func(ctx context.Context, userID string, bookID string) (*dto.WereadBookResponse, error)
	fetchReadDetailFn  func(ctx context.Context, userID, mode string, baseTime *int) (*dto.ReadDetailSnapshot, error)
	fetchHeatmapFn     func(ctx context.Context, userID string, year *int) (map[string]int, error)
	fetchRecommendFn   func(ctx context.Context, userID string, count, maxIdx int) ([]dto.BookRecommendItem, error)
}

var _ Wereader = (*mockWereader)(nil)

func (m *mockWereader) FetchUserShelf(ctx context.Context, userID string) (*dto.WereadShelfResponse, error) {
	if m.fetchFn != nil {
		return m.fetchFn(ctx, userID)
	}
	return nil, nil
}

func (m *mockWereader) CreateUserToken(ctx context.Context, userID string, token string) error {
	if m.createFn != nil {
		return m.createFn(ctx, userID, token)
	}
	return nil
}

func (m *mockWereader) FetchBookInfo(ctx context.Context, userID string, bookID string) (*dto.WereadBookResponse, error) {
	if m.fetchBookFn != nil {
		return m.fetchBookFn(ctx, userID, bookID)
	}
	return nil, nil
}

func (m *mockWereader) FetchReadDetail(ctx context.Context, userID, mode string, baseTime *int) (*dto.ReadDetailSnapshot, error) {
	if m.fetchReadDetailFn != nil {
		return m.fetchReadDetailFn(ctx, userID, mode, baseTime)
	}
	return nil, nil
}

func (m *mockWereader) FetchYearlyHeatmap(ctx context.Context, userID string, year *int) (map[string]int, error) {
	if m.fetchHeatmapFn != nil {
		return m.fetchHeatmapFn(ctx, userID, year)
	}
	return nil, nil
}

func (m *mockWereader) FetchBooksRecommend(ctx context.Context, userID string, count, maxIdx int) ([]dto.BookRecommendItem, error) {
	if m.fetchRecommendFn != nil {
		return m.fetchRecommendFn(ctx, userID, count, maxIdx)
	}
	return nil, nil
}

// ── helpers ─────────────────────────────────────────────────────────

func newWereadTestRouter(svc Wereader) *gin.Engine {
	h := NewWereadHandler(svc)
	r := gin.New()
	g := r.Group("/v3")
	h.RegisterRoutes(g, fakeWereadAuthMW)
	return r
}

// fakeWereadAuthMW 模拟认证中间件，直接写入 user_id。
func fakeWereadAuthMW(c *gin.Context) {
	c.Set("user_id", 42)
	c.Next()
}

func doWereadGET(r *gin.Engine, path string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func decodeWereadResponse(t *testing.T, body []byte) response.Response {
	t.Helper()
	var r response.Response
	if err := json.Unmarshal(body, &r); err != nil {
		t.Fatalf("decode response: %v\nbody=%s", err, body)
	}
	return r
}

// ── GetShelf ─────────────────────────────────────────────────────────

func TestWereadHandler_GetShelf_Success(t *testing.T) {
	svc := &mockWereader{
		fetchFn: func(_ context.Context, userID string) (*dto.WereadShelfResponse, error) {
			if userID != "42" {
				t.Errorf("userID = %q, want 42", userID)
			}
			return &dto.WereadShelfResponse{
				Books: []dto.WereadShelfBook{
					{BookId: "b1", Title: "三体", Author: "刘慈欣"},
				},
				Archives: []dto.WereadShelfArchive{
					{ArchiveId: "a1", Name: "书单"},
				},
			}, nil
		},
	}

	w := doWereadGET(newWereadTestRouter(svc), "/v3/weread/shelf")
	if w.Code != 200 {
		t.Fatalf("status = %d, want 200; body=%s", w.Code, w.Body.String())
	}

	resp := decodeWereadResponse(t, w.Body.Bytes())
	if resp.Message != "书架获取成功" {
		t.Errorf("message = %q, want 书架获取成功", resp.Message)
	}

	data, ok := resp.Data.(map[string]any)
	if !ok {
		t.Fatalf("data type = %T, want object", resp.Data)
	}
	books, ok := data["user_books"].([]any)
	if !ok || len(books) != 1 {
		t.Fatalf("books = %v, want list of 1", data["user_books"])
	}
	book := books[0].(map[string]any)
	if book["bookId"] != "b1" || book["title"] != "三体" {
		t.Errorf("book = %v", book)
	}
}

func TestWereadHandler_GetShelf_Unauthorized(t *testing.T) {
	svc := &mockWereader{
		fetchFn: func(_ context.Context, _ string) (*dto.WereadShelfResponse, error) {
			return nil, weread.ErrUnauthorized
		},
	}

	w := doWereadGET(newWereadTestRouter(svc), "/v3/weread/shelf")
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401; body=%s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "微信读书授权已过期") {
		t.Errorf("body = %s", w.Body.String())
	}
}

func TestWereadHandler_GetShelf_InternalError(t *testing.T) {
	svc := &mockWereader{
		fetchFn: func(_ context.Context, _ string) (*dto.WereadShelfResponse, error) {
			return nil, errors.New("upstream timeout")
		},
	}

	w := doWereadGET(newWereadTestRouter(svc), "/v3/weread/shelf")
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500; body=%s", w.Code, w.Body.String())
	}
}

func TestWereadHandler_GetShelf_RequiresAuth(t *testing.T) {
	// 未经过 fakeAuthMW 的路由应返回 401
	h := NewWereadHandler(&mockWereader{})
	r := gin.New()
	g := r.Group("/v3")
	// 不注入 authMW → 没有 user_id
	g.GET("/weread/shelf", h.GetShelf)

	w := doWereadGET(r, "/v3/weread/shelf")
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401; body=%s", w.Code, w.Body.String())
	}
}

// ── GetBookInfo ──────────────────────────────────────────────────────

func TestWereadHandler_GetBookInfo_Success(t *testing.T) {
	var gotUserID, gotBookID string
	svc := &mockWereader{
		fetchBookFn: func(_ context.Context, userID string, bookID string) (*dto.WereadBookResponse, error) {
			gotUserID = userID
			gotBookID = bookID
			return &dto.WereadBookResponse{
				ID:           "book-1",
				Title:        "三体",
				Author:       "刘慈欣",
				Introduction: "地球文明向宇宙发出第一声啼鸣。",
			}, nil
		},
	}

	w := doWereadGET(newWereadTestRouter(svc), "/v3/weread/book/book-1")
	if w.Code != 200 {
		t.Fatalf("status = %d, want 200; body=%s", w.Code, w.Body.String())
	}

	resp := decodeWereadResponse(t, w.Body.Bytes())
	if resp.Message != "书籍详情获取成功" {
		t.Errorf("message = %q, want 书籍详情获取成功", resp.Message)
	}
	if gotUserID != "42" {
		t.Errorf("userID = %q, want 42", gotUserID)
	}
	if gotBookID != "book-1" {
		t.Errorf("bookID = %q, want book-1", gotBookID)
	}

	data, ok := resp.Data.(map[string]any)
	if !ok {
		t.Fatalf("data type = %T, want object", resp.Data)
	}
	if data["title"] != "三体" || data["author"] != "刘慈欣" {
		t.Errorf("data = %v", data)
	}
	if data["introduction"] != "地球文明向宇宙发出第一声啼鸣。" {
		t.Errorf("introduction = %v", data["introduction"])
	}
	if data["fetched_at"] == nil {
		t.Error("fetched_at should be present")
	}
}

func TestWereadHandler_GetBookInfo_Unauthorized(t *testing.T) {
	svc := &mockWereader{
		fetchBookFn: func(_ context.Context, _, _ string) (*dto.WereadBookResponse, error) {
			return nil, weread.ErrUnauthorized
		},
	}

	w := doWereadGET(newWereadTestRouter(svc), "/v3/weread/book/book-1")
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401; body=%s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "微信读书授权已过期") {
		t.Errorf("body = %s", w.Body.String())
	}
}

func TestWereadHandler_GetBookInfo_InternalError(t *testing.T) {
	svc := &mockWereader{
		fetchBookFn: func(_ context.Context, _, _ string) (*dto.WereadBookResponse, error) {
			return nil, errors.New("upstream timeout")
		},
	}

	w := doWereadGET(newWereadTestRouter(svc), "/v3/weread/book/book-1")
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500; body=%s", w.Code, w.Body.String())
	}
}

func TestWereadHandler_GetBookInfo_RequiresAuth(t *testing.T) {
	h := NewWereadHandler(&mockWereader{})
	r := gin.New()
	g := r.Group("/v3")
	// 不注入 authMW → 没有 user_id
	g.GET("/weread/book/:bookId", h.GetBookInfo)

	w := doWereadGET(r, "/v3/weread/book/book-1")
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401; body=%s", w.Code, w.Body.String())
	}
}

// ── ImportUserToken ─────────────────────────────────────────────────

func TestWereadHandler_ImportUserToken_Success(t *testing.T) {
	var gotUserID, gotToken string
	svc := &mockWereader{
		createFn: func(_ context.Context, userID string, token string) error {
			gotUserID = userID
			gotToken = token
			return nil
		},
	}

	h := NewWereadHandler(svc)
	r := gin.New()
	g := r.Group("/v3")
	g.Use(fakeWereadAuthMW)
	g.POST("/weread/user-info", h.ImportUserToken)

	req := httptest.NewRequest(http.MethodPost, "/v3/weread/user-info",
		strings.NewReader(`{"data":"wrk-abc123"}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", w.Code, w.Body.String())
	}
	if gotUserID != "42" {
		t.Errorf("userID = %q, want 42", gotUserID)
	}
	if gotToken != "wrk-abc123" {
		t.Errorf("token = %q, want wrk-abc123", gotToken)
	}
}

func TestWereadHandler_ImportUserToken_BadRequest(t *testing.T) {
	svc := &mockWereader{
		createFn: func(_ context.Context, _, _ string) error {
			return nil
		},
	}

	h := NewWereadHandler(svc)
	r := gin.New()
	g := r.Group("/v3")
	g.Use(fakeWereadAuthMW)
	g.POST("/weread/user-info", h.ImportUserToken)

	// 缺少 data 字段 → 400
	req := httptest.NewRequest(http.MethodPost, "/v3/weread/user-info",
		strings.NewReader(`{}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body=%s", w.Code, w.Body.String())
	}
}

func TestWereadHandler_ImportUserToken_InternalError(t *testing.T) {
	svc := &mockWereader{
		createFn: func(_ context.Context, _, _ string) error {
			return errors.New("db error")
		},
	}

	h := NewWereadHandler(svc)
	r := gin.New()
	g := r.Group("/v3")
	g.Use(fakeWereadAuthMW)
	g.POST("/weread/user-info", h.ImportUserToken)

	req := httptest.NewRequest(http.MethodPost, "/v3/weread/user-info",
		strings.NewReader(`{"data":"wrk-abc123"}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500; body=%s", w.Code, w.Body.String())
	}
}

func TestWereadHandler_ImportUserToken_RequiresAuth(t *testing.T) {
	h := NewWereadHandler(&mockWereader{})
	r := gin.New()
	g := r.Group("/v3")
	// 不注入 authMW → 没有 user_id
	g.POST("/weread/user-info", h.ImportUserToken)

	req := httptest.NewRequest(http.MethodPost, "/v3/weread/user-info",
		strings.NewReader(`{"data":"wrk-abc123"}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401; body=%s", w.Code, w.Body.String())
	}
}

// ── GetReadProgress (snapshot) ─────────────────────────────────────

func TestWereadHandler_GetReadProgress_Success(t *testing.T) {
	var gotMode string
	svc := &mockWereader{
		fetchReadDetailFn: func(_ context.Context, userID, mode string, baseTime *int) (*dto.ReadDetailSnapshot, error) {
			gotMode = mode
			if userID != "42" {
				t.Errorf("userID = %q, want 42", userID)
			}
			readDays := 5
			return &dto.ReadDetailSnapshot{
				UserID:    42,
				Mode:      mode,
				ReadTimes: map[string]int{"2026-01-01": 1200},
				ReadDays:  &readDays,
			}, nil
		},
	}

	w := doWereadGET(newWereadTestRouter(svc), "/v3/weread/read-progress?mode=weekly")
	if w.Code != 200 {
		t.Fatalf("status = %d, want 200; body=%s", w.Code, w.Body.String())
	}

	resp := decodeWereadResponse(t, w.Body.Bytes())
	if resp.Message != "阅读统计获取成功" {
		t.Errorf("message = %q, want 阅读统计获取成功", resp.Message)
	}
	if gotMode != "weekly" {
		t.Errorf("mode = %q, want weekly", gotMode)
	}

	data, ok := resp.Data.(map[string]any)
	if !ok {
		t.Fatalf("data type = %T, want object", resp.Data)
	}
	if data["mode"] != "weekly" {
		t.Errorf("data.mode = %v, want weekly", data["mode"])
	}
}

func TestWereadHandler_GetReadProgress_Unauthorized(t *testing.T) {
	svc := &mockWereader{
		fetchReadDetailFn: func(_ context.Context, _, _ string, _ *int) (*dto.ReadDetailSnapshot, error) {
			return nil, weread.ErrUnauthorized
		},
	}

	w := doWereadGET(newWereadTestRouter(svc), "/v3/weread/read-progress?mode=weekly")
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401; body=%s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "微信读书授权已过期") {
		t.Errorf("body = %s", w.Body.String())
	}
}

func TestWereadHandler_GetReadProgress_RequiresAuth(t *testing.T) {
	h := NewWereadHandler(&mockWereader{})
	r := gin.New()
	g := r.Group("/v3")
	// 不注入 authMW → 没有 user_id
	g.GET("/weread/read-progress", h.GetReadProgress)

	w := doWereadGET(r, "/v3/weread/read-progress?mode=weekly")
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401; body=%s", w.Code, w.Body.String())
	}
}

func TestWereadHandler_GetReadProgress_MissingMode(t *testing.T) {
	svc := &mockWereader{
		fetchReadDetailFn: func(_ context.Context, _, _ string, _ *int) (*dto.ReadDetailSnapshot, error) {
			t.Error("svc should not be called when mode is missing")
			return nil, nil
		},
	}

	w := doWereadGET(newWereadTestRouter(svc), "/v3/weread/read-progress")
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body=%s", w.Code, w.Body.String())
	}
}

// ── GetReadProgress (heatmap) ──────────────────────────────────────

func TestWereadHandler_GetYearlyHeatmap_Success(t *testing.T) {
	var gotYearPtr *int
	svc := &mockWereader{
		fetchHeatmapFn: func(_ context.Context, userID string, year *int) (map[string]int, error) {
			gotYearPtr = year
			if userID != "42" {
				t.Errorf("userID = %q, want 42", userID)
			}
			return map[string]int{"2026-01-01": 1200, "2026-01-02": 600}, nil
		},
	}

	w := doWereadGET(newWereadTestRouter(svc), "/v3/weread/read-progress?mode=monthly&perDay=true")
	if w.Code != 200 {
		t.Fatalf("status = %d, want 200; body=%s", w.Code, w.Body.String())
	}

	resp := decodeWereadResponse(t, w.Body.Bytes())
	if resp.Message != "阅读热力图获取成功" {
		t.Errorf("message = %q, want 阅读热力图获取成功", resp.Message)
	}
	if gotYearPtr != nil {
		t.Errorf("year = %v, want nil (not provided)", *gotYearPtr)
	}

	data, ok := resp.Data.(map[string]any)
	if !ok {
		t.Fatalf("data type = %T, want object", resp.Data)
	}
	readTimes, ok := data["readTimes"].(map[string]any)
	if !ok {
		t.Fatalf("readTimes type = %T, want object", data["readTimes"])
	}
	if len(readTimes) != 2 {
		t.Errorf("readTimes len = %d, want 2", len(readTimes))
	}
}

func TestWereadHandler_GetYearlyHeatmap_WithYear(t *testing.T) {
	wantYear := 2025
	svc := &mockWereader{
		fetchHeatmapFn: func(_ context.Context, _ string, year *int) (map[string]int, error) {
			if year == nil || *year != wantYear {
				t.Errorf("year = %v, want %d", year, wantYear)
			}
			return map[string]int{}, nil
		},
	}

	w := doWereadGET(newWereadTestRouter(svc), "/v3/weread/read-progress?mode=monthly&perDay=true&year=2025")
	if w.Code != 200 {
		t.Fatalf("status = %d, want 200; body=%s", w.Code, w.Body.String())
	}
}

func TestWereadHandler_GetYearlyHeatmap_InvalidYear(t *testing.T) {
	svc := &mockWereader{
		fetchHeatmapFn: func(_ context.Context, _ string, _ *int) (map[string]int, error) {
			t.Error("svc should not be called with invalid year")
			return nil, nil
		},
	}

	w := doWereadGET(newWereadTestRouter(svc), "/v3/weread/read-progress?mode=monthly&perDay=true&year=notanumber")
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body=%s", w.Code, w.Body.String())
	}
}

// ── GetBooksRecommend ──────────────────────────────────────────────

func TestWereadHandler_GetBooksRecommend_Success(t *testing.T) {
	var gotCount, gotMaxIdx string
	svc := &mockWereader{
		fetchRecommendFn: func(_ context.Context, userID string, count, maxIdx int) ([]dto.BookRecommendItem, error) {
			gotCount = strconv.Itoa(count)
			gotMaxIdx = strconv.Itoa(maxIdx)
			if userID != "42" {
				t.Errorf("userID = %q, want 42", userID)
			}
			return []dto.BookRecommendItem{
				{BookId: "b1", Title: "三体", Author: "刘慈欣", Reason: "推荐", ReadingCount: 10, SearchIdx: 0, NewRating: 90},
			}, nil
		},
	}

	w := doWereadGET(newWereadTestRouter(svc), "/v3/weread/books-recommend")
	if w.Code != 200 {
		t.Fatalf("status = %d, want 200; body=%s", w.Code, w.Body.String())
	}

	resp := decodeWereadResponse(t, w.Body.Bytes())
	if resp.Message != "推荐书籍获取成功" {
		t.Errorf("message = %q, want 推荐书籍获取成功", resp.Message)
	}
	if gotCount != "12" {
		t.Errorf("count = %q, want 12 (default)", gotCount)
	}
	if gotMaxIdx != "0" {
		t.Errorf("maxIdx = %q, want 0 (default)", gotMaxIdx)
	}

	data, ok := resp.Data.([]any)
	if !ok {
		t.Fatalf("data type = %T, want array", resp.Data)
	}
	if len(data) != 1 {
		t.Fatalf("data len = %d, want 1", len(data))
	}
	book := data[0].(map[string]any)
	if book["bookId"] != "b1" || book["title"] != "三体" {
		t.Errorf("book = %v", book)
	}
}

func TestWereadHandler_GetBooksRecommend_WithParams(t *testing.T) {
	svc := &mockWereader{
		fetchRecommendFn: func(_ context.Context, _ string, count, maxIdx int) ([]dto.BookRecommendItem, error) {
			if count != 5 {
				t.Errorf("count = %d, want 5", count)
			}
			if maxIdx != 3 {
				t.Errorf("maxIdx = %d, want 3", maxIdx)
			}
			return []dto.BookRecommendItem{}, nil
		},
	}

	w := doWereadGET(newWereadTestRouter(svc), "/v3/weread/books-recommend?count=5&maxIdx=3")
	if w.Code != 200 {
		t.Fatalf("status = %d, want 200; body=%s", w.Code, w.Body.String())
	}
}

func TestWereadHandler_GetBooksRecommend_Unauthorized(t *testing.T) {
	svc := &mockWereader{
		fetchRecommendFn: func(_ context.Context, _ string, _, _ int) ([]dto.BookRecommendItem, error) {
			return nil, weread.ErrUnauthorized
		},
	}

	w := doWereadGET(newWereadTestRouter(svc), "/v3/weread/books-recommend")
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401; body=%s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "微信读书授权已过期") {
		t.Errorf("body = %s", w.Body.String())
	}
}

func TestWereadHandler_GetBooksRecommend_RequiresAuth(t *testing.T) {
	h := NewWereadHandler(&mockWereader{})
	r := gin.New()
	g := r.Group("/v3")
	// 不注入 authMW → 没有 user_id
	g.GET("/weread/books-recommend", h.GetBooksRecommend)

	w := doWereadGET(r, "/v3/weread/books-recommend")
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401; body=%s", w.Code, w.Body.String())
	}
}
