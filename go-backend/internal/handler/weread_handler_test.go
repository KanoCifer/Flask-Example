package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
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
	fetchFn  func(ctx context.Context, userID string) (*dto.WereadShelfResponse, error)
	createFn func(ctx context.Context, userID string, token string) error
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
	books, ok := data["books"].([]any)
	if !ok || len(books) != 1 {
		t.Fatalf("books = %v, want list of 1", data["books"])
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
