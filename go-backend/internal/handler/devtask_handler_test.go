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
	"github.com/KanoCifer/kuroome-blog/internal/dto"
	"github.com/KanoCifer/kuroome-blog/internal/domain/devtask/errs"
	"github.com/KanoCifer/kuroome-blog/internal/mongo/document"
	"github.com/KanoCifer/kuroome-blog/internal/service"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// ---------- mock DevTaskService ----------

type mockDevTaskService struct {
	createFn       func(ctx context.Context, userID int, req dto.DevTaskCreate) (*dto.DevTaskResponse, error)
	getBySlugFn    func(ctx context.Context, slug string, withParent bool) (*dto.DevTaskResponse, error)
	listFn         func(ctx context.Context, filter dto.DevTaskFilter, page, perPage int) (*dto.DevTaskListResponse, error)
	updateFn       func(ctx context.Context, slug string, req dto.DevTaskUpdate) error
	softDelFn      func(ctx context.Context, slug string) error
	hardDelFn      func(ctx context.Context, slug string) error
	findFrontierFn func(ctx context.Context, limit int) ([]dto.DevTaskResponse, error)
	batchStatusFn  func(ctx context.Context, slugs []string, status document.DevTaskStatus) (*service.BatchStatusResult, error)
}

func (m *mockDevTaskService) Create(ctx context.Context, userID int, req dto.DevTaskCreate) (*dto.DevTaskResponse, error) {
	return m.createFn(ctx, userID, req)
}

func (m *mockDevTaskService) GetBySlug(ctx context.Context, slug string, withParent bool) (*dto.DevTaskResponse, error) {
	if m.getBySlugFn != nil {
		return m.getBySlugFn(ctx, slug, withParent)
	}
	return nil, nil
}

func (m *mockDevTaskService) List(ctx context.Context, filter dto.DevTaskFilter, page, perPage int) (*dto.DevTaskListResponse, error) {
	return m.listFn(ctx, filter, page, perPage)
}

func (m *mockDevTaskService) Update(ctx context.Context, slug string, req dto.DevTaskUpdate) error {
	return m.updateFn(ctx, slug, req)
}

func (m *mockDevTaskService) SoftDelete(ctx context.Context, slug string) error {
	return m.softDelFn(ctx, slug)
}

func (m *mockDevTaskService) HardDelete(ctx context.Context, slug string) error {
	return m.hardDelFn(ctx, slug)
}

func (m *mockDevTaskService) FindFrontier(ctx context.Context, limit int) ([]dto.DevTaskResponse, error) {
	if m.findFrontierFn != nil {
		return m.findFrontierFn(ctx, limit)
	}
	return nil, nil
}

func (m *mockDevTaskService) BatchUpdateStatus(
	ctx context.Context,
	slugs []string,
	status document.DevTaskStatus,
) (*service.BatchStatusResult, error) {
	if m.batchStatusFn != nil {
		return m.batchStatusFn(ctx, slugs, status)
	}
	return nil, nil
}

// ---------- helpers ----------

func newDevTaskHandler(svc *mockDevTaskService) *gin.Engine {
	h := NewDevTaskHandler(svc, &config.Config{Security: config.SecurityConfig{DevTaskSecret: "test-devtask-secret"}})
	r := gin.New()
	g := r.Group("/v3")
	noopAuth := func(c *gin.Context) { c.Next() }
	noopAdmin := func(c *gin.Context) { c.Next() }
	h.RegisterRoutes(g, noopAuth, noopAuth, noopAdmin)
	return r
}

func taskJSONBody(t *testing.T, body any) *bytes.Reader {
	t.Helper()
	b, _ := json.Marshal(body)
	return bytes.NewReader(b)
}

func decodeResp(t *testing.T, body []byte) (data map[string]any, message string) {
	t.Helper()
	var resp struct {
		Data    map[string]any `json:"data"`
		Message string         `json:"message"`
	}
	_ = json.Unmarshal(body, &resp)
	return resp.Data, resp.Message
}

// ---------- CreateTask ----------

func TestDevTask_CreateTask_Success(t *testing.T) {
	svc := &mockDevTaskService{
		createFn: func(ctx context.Context, userID int, req dto.DevTaskCreate) (*dto.DevTaskResponse, error) {
			return &dto.DevTaskResponse{Slug: "task-1", Title: req.Title}, nil
		},
	}
	r := newDevTaskHandler(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v3/dev-tasks", taskJSONBody(t, dto.DevTaskCreate{
		Title:    "test task",
		Type:     document.TaskTypeFeature,
		Priority: document.PriorityP2,
		Scope:    document.ScopeGeneral,
	}))
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d; body=%s", w.Code, http.StatusOK, w.Body.String())
	}
	data, _ := decodeResp(t, w.Body.Bytes())
	if data["slug"] != "task-1" {
		t.Errorf("slug = %v, want task-1", data["slug"])
	}
}

func TestDevTask_CreateTask_Error(t *testing.T) {
	svc := &mockDevTaskService{
		createFn: func(ctx context.Context, userID int, req dto.DevTaskCreate) (*dto.DevTaskResponse, error) {
			return nil, errors.New("db error")
		},
	}
	r := newDevTaskHandler(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v3/dev-tasks", taskJSONBody(t, dto.DevTaskCreate{
		Title:    "test",
		Type:     document.TaskTypeFeature,
		Priority: document.PriorityP2,
		Scope:    document.ScopeGeneral,
	}))
	r.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want %d", w.Code, http.StatusInternalServerError)
	}
}

func TestDevTask_CreateTask_InvalidBody(t *testing.T) {
	svc := &mockDevTaskService{}
	r := newDevTaskHandler(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v3/dev-tasks", bytes.NewReader([]byte("not json")))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// ---------- ListTasks ----------

func TestDevTask_ListTasks_DefaultPagination(t *testing.T) {
	svc := &mockDevTaskService{
		listFn: func(ctx context.Context, filter dto.DevTaskFilter, page, perPage int) (*dto.DevTaskListResponse, error) {
			if page != 1 || perPage != 10 {
				t.Errorf("page=%d perPage=%d, want (1,10)", page, perPage)
			}
			return &dto.DevTaskListResponse{Tasks: []dto.DevTaskResponse{}, Pagination: dto.Pagination{Total: 0}}, nil
		},
	}
	r := newDevTaskHandler(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v3/dev-tasks", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
}

func TestDevTask_ListTasks_CustomPagination(t *testing.T) {
	svc := &mockDevTaskService{
		listFn: func(ctx context.Context, filter dto.DevTaskFilter, page, perPage int) (*dto.DevTaskListResponse, error) {
			if page != 2 || perPage != 20 {
				t.Errorf("page=%d perPage=%d, want (2,20)", page, perPage)
			}
			return &dto.DevTaskListResponse{Tasks: []dto.DevTaskResponse{}, Pagination: dto.Pagination{Total: 0}}, nil
		},
	}
	r := newDevTaskHandler(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v3/dev-tasks?page=2&per_page=20", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
}

func TestDevTask_ListTasks_Filter(t *testing.T) {
	svc := &mockDevTaskService{
		listFn: func(ctx context.Context, filter dto.DevTaskFilter, page, perPage int) (*dto.DevTaskListResponse, error) {
			if filter.Status != "已完成" {
				t.Errorf("filter.Status = %q, want 已完成", filter.Status)
			}
			if filter.Priority != "P1 高" {
				t.Errorf("filter.Priority = %q, want P1 高", filter.Priority)
			}
			return &dto.DevTaskListResponse{Tasks: []dto.DevTaskResponse{}, Pagination: dto.Pagination{Total: 0}}, nil
		},
	}
	r := newDevTaskHandler(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v3/dev-tasks?status=已完成&priority=P1 高", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
}

func TestDevTask_ListTasks_ServerError(t *testing.T) {
	svc := &mockDevTaskService{
		listFn: func(ctx context.Context, filter dto.DevTaskFilter, page, perPage int) (*dto.DevTaskListResponse, error) {
			return nil, errors.New("boom")
		},
	}
	r := newDevTaskHandler(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v3/dev-tasks", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want %d", w.Code, http.StatusInternalServerError)
	}
}

// ---------- GetTaskBySlug ----------

func TestDevTask_GetTaskBySlug_Success(t *testing.T) {
	svc := &mockDevTaskService{
		getBySlugFn: func(ctx context.Context, slug string, withParent bool) (*dto.DevTaskResponse, error) {
			return &dto.DevTaskResponse{Slug: slug, Title: "test"}, nil
		},
	}
	r := newDevTaskHandler(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v3/dev-tasks/task-1", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
	data, _ := decodeResp(t, w.Body.Bytes())
	if data["slug"] != "task-1" {
		t.Errorf("slug = %v, want task-1", data["slug"])
	}
}

func TestDevTask_GetTaskBySlug_NotFound(t *testing.T) {
	svc := &mockDevTaskService{
		getBySlugFn: func(ctx context.Context, slug string, withParent bool) (*dto.DevTaskResponse, error) {
			return nil, devtaskerrs.ErrTaskNotFound
		},
	}
	r := newDevTaskHandler(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v3/dev-tasks/nonexistent", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("status = %d, want %d", w.Code, http.StatusNotFound)
	}
}

// ---------- UpdateTask ----------

func TestDevTask_UpdateTask_Success(t *testing.T) {
	svc := &mockDevTaskService{
		updateFn: func(ctx context.Context, slug string, req dto.DevTaskUpdate) error { return nil },
	}
	r := newDevTaskHandler(svc)
	w := httptest.NewRecorder()
	body, _ := json.Marshal(dto.DevTaskUpdate{Title: ptr("updated")})
	req, _ := http.NewRequest(http.MethodPatch, "/v3/dev-tasks/task-1", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
}

// ---------- SoftDelete ----------

func TestDevTask_SoftDelete_Success(t *testing.T) {
	svc := &mockDevTaskService{
		softDelFn: func(ctx context.Context, slug string) error { return nil },
	}
	r := newDevTaskHandler(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodDelete, "/v3/dev-tasks/task-1", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
}

// ---------- HardDelete ----------

func TestDevTask_HardDelete_Success(t *testing.T) {
	svc := &mockDevTaskService{
		hardDelFn: func(ctx context.Context, slug string) error { return nil },
	}
	r := newDevTaskHandler(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodDelete, "/v3/dev-tasks/task-1/permanent", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
}

// ---------- FrontierTasks ----------

func TestDevTask_FrontierTasks_Success(t *testing.T) {
	svc := &mockDevTaskService{
		findFrontierFn: func(ctx context.Context, limit int) ([]dto.DevTaskResponse, error) {
			return []dto.DevTaskResponse{{Slug: "frontier-1"}}, nil
		},
	}
	r := newDevTaskHandler(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v3/dev-tasks/frontier?limit=5", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
	// frontier 直接返回数组（无分页 envelope），data 字段即 []any
	body := w.Body.Bytes()
	var resp struct {
		Data    []any  `json:"data"`
		Message string `json:"message"`
	}
	_ = json.Unmarshal(body, &resp)
	if len(resp.Data) != 1 {
		t.Errorf("expected 1 task in data array, got %v", resp.Data)
	}
}

// ---------- BatchStatus ----------

func TestDevTask_BatchStatus_Success(t *testing.T) {
	svc := &mockDevTaskService{
		batchStatusFn: func(ctx context.Context, slugs []string, status document.DevTaskStatus) (*service.BatchStatusResult, error) {
			return &service.BatchStatusResult{
				Succeeded: []string{"task-1", "task-2"},
				Failed:    map[string]string{},
			}, nil
		},
	}
	r := newDevTaskHandler(svc)
	body, _ := json.Marshal(dto.BatchStatusRequest{Slugs: []string{"task-1", "task-2"}, Status: "已完成"})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v3/dev-tasks/batch-status", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d; body=%s", w.Code, http.StatusOK, w.Body.String())
	}
}

// ---------- DevTaskToken ----------

func TestDevTask_DevTaskToken_Success(t *testing.T) {
	svc := &mockDevTaskService{}
	r := newDevTaskHandler(svc)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v3/dev-task/token", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d; body=%s", w.Code, http.StatusOK, w.Body.String())
	}
	var resp struct {
		Data struct {
			Token     string `json:"token"`
			ExpiresAt string `json:"expires_at"`
		} `json:"data"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Data.Token == "" {
		t.Error("expected non-empty token in response")
	}
	if resp.Data.ExpiresAt == "" {
		t.Error("expected expires_at in response")
	}
}

func TestDevTask_DevTaskToken_SecretNotConfigured(t *testing.T) {
	svc := &mockDevTaskService{}
	h := NewDevTaskHandler(svc, &config.Config{Security: config.SecurityConfig{DevTaskSecret: ""}})
	r := gin.New()
	g := r.Group("/v3")
	noopAuth := func(c *gin.Context) { c.Next() }
	h.RegisterRoutes(g, noopAuth, noopAuth, noopAuth)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v3/dev-task/token", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("status = %d, want %d", w.Code, http.StatusServiceUnavailable)
	}
}

func TestDevTask_DevTaskToken_Unauthorized(t *testing.T) {
	svc := &mockDevTaskService{}
	h := NewDevTaskHandler(svc, &config.Config{Security: config.SecurityConfig{DevTaskSecret: "test-secret"}})
	r := gin.New()
	g := r.Group("/v3")
	// realAuth 拒绝未认证请求
	realAuth := func(c *gin.Context) {
		c.AbortWithStatusJSON(401, gin.H{"error": "unauthorized"})
	}
	noopAdmin := func(c *gin.Context) { c.Next() }
	h.RegisterRoutes(g, noopAdmin, realAuth, noopAdmin)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v3/dev-task/token", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d (missing auth)", w.Code, http.StatusUnauthorized)
	}
}
