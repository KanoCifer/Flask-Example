package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/KanoCifer/kuroome-blog/internal/config"
	"github.com/KanoCifer/kuroome-blog/internal/domain/blog/errs"
	"github.com/KanoCifer/kuroome-blog/internal/dto"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// ---------- mock AdminService ----------

type mockAdminService struct {
	addPostFn       func(ctx context.Context, post dto.PostRequest) (string, error)
	updatePostFn    func(ctx context.Context, id string, post dto.PostUpdate) error
	deletePostFn    func(ctx context.Context, id string) error
	listViewsDataFn func(ctx context.Context) ([]dto.PostViewResponse, error)
}

func (m *mockAdminService) AddPost(ctx context.Context, post dto.PostRequest) (string, error) {
	return m.addPostFn(ctx, post)
}

func (m *mockAdminService) UpdatePost(ctx context.Context, id string, post dto.PostUpdate) error {
	return m.updatePostFn(ctx, id, post)
}

func (m *mockAdminService) DeletePost(ctx context.Context, id string) error {
	return m.deletePostFn(ctx, id)
}

func (m *mockAdminService) ListPostViewsData(ctx context.Context) ([]dto.PostViewResponse, error) {
	return m.listViewsDataFn(ctx)
}

// ---------- helpers ----------

func newAdminHandler(svc AdminServiceer) (*AdminHandler, *gin.Engine) {
	h := NewAdminHandler(svc, config.Cfg)
	r := gin.New()
	g := r.Group("/v3")
	noopAuth := func(c *gin.Context) { c.Set("user_id", 1); c.Next() }
	noopAdmin := func(c *gin.Context) { c.Next() }
	h.RegisterRoutes(g, noopAuth, noopAdmin)
	return h, r
}

func postJSON(t *testing.T, path string, body any) (*httptest.ResponseRecorder, *http.Request) {
	t.Helper()
	b, _ := json.Marshal(body)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, path, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	return w, req
}

func putJSON(t *testing.T, path string, body any) (*httptest.ResponseRecorder, *http.Request) {
	t.Helper()
	b, _ := json.Marshal(body)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPut, path, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	return w, req
}

// ptr 返回值变量的指针，用于构造指针字段 DTO 字面量。
func ptr[T any](v T) *T { return &v }

// postUpdate 是 handler 测试用的 PostUpdate 构造辅助 —— 只填 Title / Body / ID 即可，
// 避免每个测试都写一堆 `Title: ptr("t")`。
func postUpdate(id, title, body string) dto.PostUpdate {
	return dto.PostUpdate{
		Title: ptr(title),
		Body:  ptr(body),
		ID:    id,
	}
}

// ---------- AddPost ----------

func TestAdmin_AddPost_Success(t *testing.T) {
	svc := &mockAdminService{
		addPostFn: func(ctx context.Context, post dto.PostRequest) (string, error) {
			return "507f1f77bcf86cd799439011", nil
		},
	}
	_, r := newAdminHandler(svc)
	w, req := postJSON(t, "/v3/post/add", dto.PostRequest{Title: "t", Body: "b", Tags: []string{"go"}})
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
	var resp struct {
		Data    map[string]any `json:"data"`
		Message string         `json:"message"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Data["_id"] != "507f1f77bcf86cd799439011" {
		t.Errorf("data._id = %v, want 507f1f77bcf86cd799439011", resp.Data["_id"])
	}
	if resp.Message != "Blog post added successfully" {
		t.Errorf("message = %q", resp.Message)
	}
}

func TestAdmin_AddPost_Error(t *testing.T) {
	svc := &mockAdminService{
		addPostFn: func(ctx context.Context, post dto.PostRequest) (string, error) {
			return "", errors.New("db down")
		},
	}
	_, r := newAdminHandler(svc)
	w, req := postJSON(t, "/v3/post/add", dto.PostRequest{Title: "t", Body: "b"})
	r.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want %d", w.Code, http.StatusInternalServerError)
	}
}

func TestAdmin_AddPost_InvalidBody(t *testing.T) {
	svc := &mockAdminService{addPostFn: func(context.Context, dto.PostRequest) (string, error) { return "", nil }}
	_, r := newAdminHandler(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v3/post/add", bytes.NewReader([]byte("not json")))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// ---------- UpdatePost ----------

func TestAdmin_UpdatePost_InvalidID(t *testing.T) {
	svc := &mockAdminService{
		updatePostFn: func(ctx context.Context, id string, post dto.PostUpdate) error { return blogerrs.ErrInvalidPostID },
	}
	_, r := newAdminHandler(svc)
	w, req := putJSON(t, "/v3/post/update", postUpdate("bad-id", "t", "b"))
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d (invalid id)", w.Code, http.StatusBadRequest)
	}
}

func TestAdmin_UpdatePost_NotFound(t *testing.T) {
	svc := &mockAdminService{
		updatePostFn: func(ctx context.Context, id string, post dto.PostUpdate) error {
			return blogerrs.ErrPostNotFound
		},
	}
	_, r := newAdminHandler(svc)
	w, req := putJSON(t, "/v3/post/update", postUpdate("507f1f77bcf86cd799439011", "t", "b"))
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("status = %d, want %d", w.Code, http.StatusNotFound)
	}
}

func TestAdmin_UpdatePost_MissingID(t *testing.T) {
	svc := &mockAdminService{
		updatePostFn: func(ctx context.Context, id string, post dto.PostUpdate) error { return nil },
	}
	_, r := newAdminHandler(svc)
	// _id 缺失 → binding 失败
	w, req := putJSON(t, "/v3/post/update", dto.PostUpdate{
		Title: ptr("t"),
		Body:  ptr("b"),
	})
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d (missing _id)", w.Code, http.StatusBadRequest)
	}
}

func TestAdmin_UpdatePost_ServerError(t *testing.T) {
	svc := &mockAdminService{
		updatePostFn: func(ctx context.Context, id string, post dto.PostUpdate) error {
			return errors.New("boom")
		},
	}
	_, r := newAdminHandler(svc)
	w, req := putJSON(t, "/v3/post/update", postUpdate("507f1f77bcf86cd799439011", "t", "b"))
	r.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want %d", w.Code, http.StatusInternalServerError)
	}
}

// ---------- DeletePost ----------

func TestAdmin_DeletePost_InvalidID(t *testing.T) {
	svc := &mockAdminService{deletePostFn: func(ctx context.Context, id string) error { return blogerrs.ErrInvalidPostID }}
	_, r := newAdminHandler(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodDelete, "/v3/post/bad-id/delete", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d (invalid id)", w.Code, http.StatusBadRequest)
	}
}

func TestAdmin_DeletePost_NotFound(t *testing.T) {
	svc := &mockAdminService{deletePostFn: func(ctx context.Context, id string) error { return blogerrs.ErrPostNotFound }}
	_, r := newAdminHandler(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodDelete, "/v3/post/507f1f77bcf86cd799439011/delete", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("status = %d, want %d", w.Code, http.StatusNotFound)
	}
}

func TestAdmin_DeletePost_Success(t *testing.T) {
	svc := &mockAdminService{deletePostFn: func(ctx context.Context, id string) error { return nil }}
	_, r := newAdminHandler(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodDelete, "/v3/post/507f1f77bcf86cd799439011/delete", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
}
