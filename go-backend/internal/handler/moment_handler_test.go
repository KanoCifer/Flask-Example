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

	"github.com/KanoCifer/kuroome-blog/internal/dto"
	"github.com/KanoCifer/kuroome-blog/internal/domain/moment/errs"
	"github.com/KanoCifer/kuroome-blog/internal/service"
)

// ---------- mock Momenter ----------

// mockMomentService 严格匹配 service.Momenter 接口签名 —— Go 要求 context.Context
// 精确类型匹配，不能用 interface{} 替代。
type mockMomentService struct {
	createFn       func(ctx context.Context, userID int, req dto.MomentRequest) (*dto.MomentResponse, error)
	getByIDFn      func(ctx context.Context, id string) (*dto.MomentResponse, error)
	getByIDAdminFn func(ctx context.Context, id string) (*dto.MomentResponse, error)
	listPublicFn   func(ctx context.Context, filter dto.MomentFilter, page, pageSize int) (*dto.MomentListResponse, error)
	listAdminFn    func(ctx context.Context, filter dto.MomentFilter, page, pageSize int) (*dto.MomentListResponse, error)
	updateFn       func(ctx context.Context, id string, req dto.MomentUpdate) error
	softDelFn      func(ctx context.Context, id string) error
	hardDelFn      func(ctx context.Context, id string) error
}

var _ service.Momenter = (*mockMomentService)(nil)

func (m *mockMomentService) Create(ctx context.Context, userID int, req dto.MomentRequest) (*dto.MomentResponse, error) {
	if m.createFn != nil {
		return m.createFn(ctx, userID, req)
	}
	return nil, nil
}

func (m *mockMomentService) GetByID(ctx context.Context, id string) (*dto.MomentResponse, error) {
	if m.getByIDFn != nil {
		return m.getByIDFn(ctx, id)
	}
	return nil, nil
}

func (m *mockMomentService) GetByIDAdmin(ctx context.Context, id string) (*dto.MomentResponse, error) {
	if m.getByIDAdminFn != nil {
		return m.getByIDAdminFn(ctx, id)
	}
	return nil, nil
}

func (m *mockMomentService) ListPublic(ctx context.Context, filter dto.MomentFilter, page, pageSize int) (*dto.MomentListResponse, error) {
	if m.listPublicFn != nil {
		return m.listPublicFn(ctx, filter, page, pageSize)
	}
	return nil, nil
}

func (m *mockMomentService) ListAdmin(ctx context.Context, filter dto.MomentFilter, page, pageSize int) (*dto.MomentListResponse, error) {
	if m.listAdminFn != nil {
		return m.listAdminFn(ctx, filter, page, pageSize)
	}
	return nil, nil
}

func (m *mockMomentService) Update(ctx context.Context, id string, req dto.MomentUpdate) error {
	if m.updateFn != nil {
		return m.updateFn(ctx, id, req)
	}
	return nil
}

func (m *mockMomentService) SoftDelete(ctx context.Context, id string) error {
	if m.softDelFn != nil {
		return m.softDelFn(ctx, id)
	}
	return nil
}

func (m *mockMomentService) HardDelete(ctx context.Context, id string) error {
	if m.hardDelFn != nil {
		return m.hardDelFn(ctx, id)
	}
	return nil
}

// ---------- helpers ----------

// newMomentHandler 组装测试用的 gin 引擎。
// authMW 在 noopAuth 下把 user_id=1 注入 context；adminMW noop。
func newMomentHandler(svc *mockMomentService) *gin.Engine {
	h := NewMomentHandler(svc)
	r := gin.New()
	g := r.Group("/v3")
	noopAuth := func(c *gin.Context) { c.Set("user_id", 1); c.Next() }
	noopAdmin := func(c *gin.Context) { c.Next() }
	h.RegisterRoutes(g, noopAuth, noopAdmin)
	return r
}

// momentJSON 把 body 序列化为带 Content-Type 的请求。
func momentJSON(t *testing.T, body any) (*http.Request, *httptest.ResponseRecorder) {
	t.Helper()
	b, _ := json.Marshal(body)
	req, _ := http.NewRequest(http.MethodPost, "/", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	return req, w
}

func momentDo(t *testing.T, r *gin.Engine, method, path string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var req *http.Request
	if body != nil {
		b, _ := json.Marshal(body)
		req, _ = http.NewRequest(method, path, bytes.NewReader(b))
		req.Header.Set("Content-Type", "application/json")
	} else {
		req, _ = http.NewRequest(method, path, nil)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

type momentResp struct {
	Data    map[string]any `json:"data"`
	Message string         `json:"message"`
}

func momentDecode(t *testing.T, w *httptest.ResponseRecorder) momentResp {
	t.Helper()
	var r momentResp
	_ = json.Unmarshal(w.Body.Bytes(), &r)
	return r
}

// ---------- ListPublicMoments ----------

func TestMoment_ListPublicMoments_DefaultPagination(t *testing.T) {
	svc := &mockMomentService{
		listPublicFn: func(_ context.Context, _ dto.MomentFilter, page, pageSize int) (*dto.MomentListResponse, error) {
			if page != 1 || pageSize != 10 {
				t.Errorf("page=%d pageSize=%d, want (1,10)", page, pageSize)
			}
			return &dto.MomentListResponse{
				Moments:  []dto.MomentResponse{},
				Total:    0,
				Page:     1,
				PageSize: 10,
			}, nil
		},
	}
	r := newMomentHandler(svc)

	w := momentDo(t, r, http.MethodGet, "/v3/moments", nil)
	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want 200; body=%s", w.Code, w.Body.String())
	}
}

func TestMoment_ListPublicMoments_TagFilter(t *testing.T) {
	svc := &mockMomentService{
		listPublicFn: func(_ context.Context, filter dto.MomentFilter, _, _ int) (*dto.MomentListResponse, error) {
			if filter.Tag != "读书" {
				t.Errorf("filter.Tag = %q, want 读书", filter.Tag)
			}
			return &dto.MomentListResponse{Total: 0, Moments: []dto.MomentResponse{}}, nil
		},
	}
	r := newMomentHandler(svc)

	w := momentDo(t, r, http.MethodGet, "/v3/moments?tag=读书", nil)
	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", w.Code)
	}
}

func TestMoment_ListPublicMoments_CustomPagination(t *testing.T) {
	svc := &mockMomentService{
		listPublicFn: func(_ context.Context, _ dto.MomentFilter, page, pageSize int) (*dto.MomentListResponse, error) {
			if page != 3 || pageSize != 5 {
				t.Errorf("page=%d pageSize=%d, want (3,5)", page, pageSize)
			}
			return &dto.MomentListResponse{Page: 3, PageSize: 5, Total: 11, Moments: []dto.MomentResponse{}}, nil
		},
	}
	r := newMomentHandler(svc)

	w := momentDo(t, r, http.MethodGet, "/v3/moments?page=3&page_size=5", nil)
	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", w.Code)
	}
}

func TestMoment_ListPublicMoments_ServiceError(t *testing.T) {
	svc := &mockMomentService{
		listPublicFn: func(_ context.Context, _ dto.MomentFilter, _, _ int) (*dto.MomentListResponse, error) {
			return nil, errors.New("mongo down")
		},
	}
	r := newMomentHandler(svc)

	w := momentDo(t, r, http.MethodGet, "/v3/moments", nil)
	if w.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want 500", w.Code)
	}
}

// ---------- GetPublicMoment ----------

func TestMoment_GetPublicMoment_Success(t *testing.T) {
	svc := &mockMomentService{
		getByIDFn: func(_ context.Context, id string) (*dto.MomentResponse, error) {
			return &dto.MomentResponse{ID: id, Content: "hello"}, nil
		},
	}
	r := newMomentHandler(svc)

	w := momentDo(t, r, http.MethodGet, "/v3/moments/507f1f77bcf86cd799439011", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", w.Code, w.Body.String())
	}
	resp := momentDecode(t, w)
	if resp.Data["id"] != "507f1f77bcf86cd799439011" {
		t.Errorf("id = %v, want 507f1f77bcf86cd799439011", resp.Data["id"])
	}
}

func TestMoment_GetPublicMoment_NotFound(t *testing.T) {
	svc := &mockMomentService{
		getByIDFn: func(_ context.Context, _ string) (*dto.MomentResponse, error) {
			return nil, momenterrs.ErrMomentNotFound
		},
	}
	r := newMomentHandler(svc)

	w := momentDo(t, r, http.MethodGet, "/v3/moments/missing", nil)
	if w.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", w.Code)
	}
}

func TestMoment_GetPublicMoment_InvalidID(t *testing.T) {
	svc := &mockMomentService{
		getByIDFn: func(_ context.Context, _ string) (*dto.MomentResponse, error) {
			return nil, momenterrs.ErrInvalidObjectID
		},
	}
	r := newMomentHandler(svc)

	w := momentDo(t, r, http.MethodGet, "/v3/moments/not-an-objectid", nil)
	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", w.Code)
	}
}

func TestMoment_GetPublicMoment_ServerError(t *testing.T) {
	svc := &mockMomentService{
		getByIDFn: func(_ context.Context, _ string) (*dto.MomentResponse, error) {
			return nil, errors.New("boom")
		},
	}
	r := newMomentHandler(svc)

	w := momentDo(t, r, http.MethodGet, "/v3/moments/507f1f77bcf86cd799439011", nil)
	if w.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want 500", w.Code)
	}
}

// ---------- CreateMoment ----------

func TestMoment_CreateMoment_Success(t *testing.T) {
	var capturedUID int
	var captured dto.MomentRequest
	svc := &mockMomentService{
		createFn: func(_ context.Context, userID int, req dto.MomentRequest) (*dto.MomentResponse, error) {
			capturedUID = userID
			captured = req
			return &dto.MomentResponse{ID: "new-id", Content: req.Content}, nil
		},
	}
	r := newMomentHandler(svc)

	w := momentDo(t, r, http.MethodPost, "/v3/moments", dto.MomentRequest{
		Content:    "今天天气真好",
		Visibility: dto.MomentPublic,
		Status:     dto.MomentPublished,
	})
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", w.Code, w.Body.String())
	}
	if capturedUID != 1 {
		t.Errorf("userID = %d, want 1 (from authMW)", capturedUID)
	}
	if captured.Content != "今天天气真好" {
		t.Errorf("content = %q, want 今天天气真好", captured.Content)
	}
}

func TestMoment_CreateMoment_InvalidJSON(t *testing.T) {
	svc := &mockMomentService{}
	r := newMomentHandler(svc)

	req, _ := http.NewRequest(http.MethodPost, "/v3/moments", bytes.NewReader([]byte("not json")))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", w.Code)
	}
}

func TestMoment_CreateMoment_ServiceError(t *testing.T) {
	svc := &mockMomentService{
		createFn: func(_ context.Context, _ int, _ dto.MomentRequest) (*dto.MomentResponse, error) {
			return nil, errors.New("create failed")
		},
	}
	r := newMomentHandler(svc)

	w := momentDo(t, r, http.MethodPost, "/v3/moments", dto.MomentRequest{Content: "x"})
	if w.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want 500", w.Code)
	}
}

// ---------- UpdateMoment ----------

func TestMoment_UpdateMoment_Success(t *testing.T) {
	var captured dto.MomentUpdate
	svc := &mockMomentService{
		updateFn: func(_ context.Context, id string, req dto.MomentUpdate) error {
			if id != "507f1f77bcf86cd799439011" {
				t.Errorf("id = %q, want 507f1f77bcf86cd799439011", id)
			}
			captured = req
			return nil
		},
	}
	r := newMomentHandler(svc)

	w := momentDo(t, r, http.MethodPatch, "/v3/moments/507f1f77bcf86cd799439011",
		dto.MomentUpdate{Content: ptr("updated"), IsPinned: ptr(true)})
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", w.Code, w.Body.String())
	}
	if captured.Content == nil || *captured.Content != "updated" {
		t.Errorf("content = %+v, want pointer to 'updated'", captured.Content)
	}
	if captured.IsPinned == nil || !*captured.IsPinned {
		t.Errorf("IsPinned = %+v, want pointer to true", captured.IsPinned)
	}
}

func TestMoment_UpdateMoment_NotFound(t *testing.T) {
	svc := &mockMomentService{
		updateFn: func(_ context.Context, _ string, _ dto.MomentUpdate) error {
			return momenterrs.ErrMomentNotFound
		},
	}
	r := newMomentHandler(svc)

	w := momentDo(t, r, http.MethodPatch, "/v3/moments/missing",
		dto.MomentUpdate{Content: ptr("x")})
	if w.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", w.Code)
	}
}

func TestMoment_UpdateMoment_InvalidID(t *testing.T) {
	svc := &mockMomentService{
		updateFn: func(_ context.Context, _ string, _ dto.MomentUpdate) error {
			return momenterrs.ErrInvalidObjectID
		},
	}
	r := newMomentHandler(svc)

	w := momentDo(t, r, http.MethodPatch, "/v3/moments/not-an-objectid",
		dto.MomentUpdate{Content: ptr("x")})
	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", w.Code)
	}
}

func TestMoment_UpdateMoment_InvalidJSON(t *testing.T) {
	svc := &mockMomentService{}
	r := newMomentHandler(svc)

	req, _ := http.NewRequest(http.MethodPatch, "/v3/moments/507f1f77bcf86cd799439011", bytes.NewReader([]byte("{bad")))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", w.Code)
	}
}

// ---------- DeleteMoment (soft) ----------

func TestMoment_DeleteMoment_Success(t *testing.T) {
	var capturedID string
	svc := &mockMomentService{
		softDelFn: func(_ context.Context, id string) error {
			capturedID = id
			return nil
		},
	}
	r := newMomentHandler(svc)

	w := momentDo(t, r, http.MethodDelete, "/v3/moments/507f1f77bcf86cd799439011", nil)
	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", w.Code)
	}
	if capturedID != "507f1f77bcf86cd799439011" {
		t.Errorf("capturedID = %q, want 507f1f77bcf86cd799439011", capturedID)
	}
}

func TestMoment_DeleteMoment_NotFound(t *testing.T) {
	svc := &mockMomentService{
		softDelFn: func(_ context.Context, _ string) error {
			return momenterrs.ErrMomentNotFound
		},
	}
	r := newMomentHandler(svc)

	w := momentDo(t, r, http.MethodDelete, "/v3/moments/missing", nil)
	if w.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", w.Code)
	}
}

func TestMoment_DeleteMoment_InvalidID(t *testing.T) {
	svc := &mockMomentService{
		softDelFn: func(_ context.Context, _ string) error {
			return momenterrs.ErrInvalidObjectID
		},
	}
	r := newMomentHandler(svc)

	w := momentDo(t, r, http.MethodDelete, "/v3/moments/bad", nil)
	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", w.Code)
	}
}

// ---------- Admin endpoints ----------

func TestMoment_ListAdminMoments_FilterStatus(t *testing.T) {
	svc := &mockMomentService{
		listAdminFn: func(_ context.Context, filter dto.MomentFilter, page, pageSize int) (*dto.MomentListResponse, error) {
			if filter.Status != "draft" {
				t.Errorf("filter.Status = %q, want draft", filter.Status)
			}
			if filter.IncludeDeleted == nil || *filter.IncludeDeleted {
				t.Errorf("filter.IncludeDeleted = %+v, want pointer to false", filter.IncludeDeleted)
			}
			return &dto.MomentListResponse{Moments: []dto.MomentResponse{}}, nil
		},
	}
	r := newMomentHandler(svc)

	w := momentDo(t, r, http.MethodGet, "/v3/moments/admin?status=draft", nil)
	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want 200; body=%s", w.Code, w.Body.String())
	}
}

func TestMoment_ListAdminMoments_IncludeDeleted(t *testing.T) {
	svc := &mockMomentService{
		listAdminFn: func(_ context.Context, filter dto.MomentFilter, _, _ int) (*dto.MomentListResponse, error) {
			if filter.IncludeDeleted == nil || !*filter.IncludeDeleted {
				t.Errorf("filter.IncludeDeleted = %+v, want pointer to true", filter.IncludeDeleted)
			}
			return &dto.MomentListResponse{Moments: []dto.MomentResponse{}}, nil
		},
	}
	r := newMomentHandler(svc)

	w := momentDo(t, r, http.MethodGet, "/v3/moments/admin?include_deleted=true", nil)
	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", w.Code)
	}
}

func TestMoment_GetAdminMoment_Success(t *testing.T) {
	svc := &mockMomentService{
		getByIDAdminFn: func(_ context.Context, id string) (*dto.MomentResponse, error) {
			return &dto.MomentResponse{ID: id, Content: "admin view"}, nil
		},
	}
	r := newMomentHandler(svc)

	w := momentDo(t, r, http.MethodGet, "/v3/moments/admin/507f1f77bcf86cd799439011", nil)
	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", w.Code)
	}
}

func TestMoment_GetAdminMoment_NotFound(t *testing.T) {
	svc := &mockMomentService{
		getByIDAdminFn: func(_ context.Context, _ string) (*dto.MomentResponse, error) {
			return nil, momenterrs.ErrMomentNotFound
		},
	}
	r := newMomentHandler(svc)

	w := momentDo(t, r, http.MethodGet, "/v3/moments/admin/missing", nil)
	if w.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", w.Code)
	}
}

func TestMoment_HardDeleteMoment_Success(t *testing.T) {
	var capturedID string
	svc := &mockMomentService{
		hardDelFn: func(_ context.Context, id string) error {
			capturedID = id
			return nil
		},
	}
	r := newMomentHandler(svc)

	w := momentDo(t, r, http.MethodDelete, "/v3/moments/admin/507f1f77bcf86cd799439011/permanent", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", w.Code, w.Body.String())
	}
	if capturedID != "507f1f77bcf86cd799439011" {
		t.Errorf("capturedID = %q, want 507f1f77bcf86cd799439011", capturedID)
	}
}

func TestMoment_HardDeleteMoment_InvalidID(t *testing.T) {
	svc := &mockMomentService{
		hardDelFn: func(_ context.Context, _ string) error {
			return momenterrs.ErrInvalidObjectID
		},
	}
	r := newMomentHandler(svc)

	w := momentDo(t, r, http.MethodDelete, "/v3/moments/admin/bad/permanent", nil)
	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", w.Code)
	}
}

func TestMoment_RouteOrder_AdminBeatsID(t *testing.T) {
	// 静态路由 /moments/admin 必须先于 :id 注册 —— 验证路由树顺序。
	// 没有 /moments/admin 的请求会落到 /moments/:id 而 404；这里走 admin 路径应命中
	// GetAdminMoment 而非 GetPublicMoment。
	svc := &mockMomentService{
		getByIDFn: func(_ context.Context, _ string) (*dto.MomentResponse, error) {
			return &dto.MomentResponse{ID: "public"}, nil
		},
		getByIDAdminFn: func(_ context.Context, id string) (*dto.MomentResponse, error) {
			return &dto.MomentResponse{ID: id, Content: "admin"}, nil
		},
	}
	r := newMomentHandler(svc)

	w := momentDo(t, r, http.MethodGet, "/v3/moments/admin/507f1f77bcf86cd799439011", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	resp := momentDecode(t, w)
	if resp.Data["content"] != "admin" {
		t.Errorf("content = %v, want admin (route should match admin handler)", resp.Data["content"])
	}
}