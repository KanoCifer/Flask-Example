package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/KanoCifer/kuroome-blog/internal/dto"
	"github.com/KanoCifer/kuroome-blog/internal/mongo/document"
	"github.com/KanoCifer/kuroome-blog/internal/service"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// ---------- mock Fisher ----------
// 字段签名与 service.Fisher 接口严格一致 —— Go 要求参数类型精确匹配，
// 不能用 interface{} 替代 context.Context。

type mockFishService struct {
	listFn    func(ctx context.Context) ([]*dto.FishingSpotResponse, error)
	getByIDFn func(ctx context.Context, id string) (*dto.FishingSpotResponse, error)
	createFn  func(ctx context.Context, spot *dto.FishingSpotRequest) error
	updateFn  func(ctx context.Context, id string, spot *dto.FishingSpotUpdate) error
	deleteFn  func(ctx context.Context, id string, hard ...bool) error
}

var _ service.Fisher = (*mockFishService)(nil)

func (m *mockFishService) GetFishingSpots(ctx context.Context) ([]*dto.FishingSpotResponse, error) {
	if m.listFn != nil {
		return m.listFn(ctx)
	}
	return nil, nil
}

func (m *mockFishService) GetFishingSpotByID(ctx context.Context, id string) (*dto.FishingSpotResponse, error) {
	if m.getByIDFn != nil {
		return m.getByIDFn(ctx, id)
	}
	return nil, nil
}

func (m *mockFishService) CreateFishingSpot(ctx context.Context, spot *dto.FishingSpotRequest) error {
	if m.createFn != nil {
		return m.createFn(ctx, spot)
	}
	return nil
}

func (m *mockFishService) UpdateFishingSpot(ctx context.Context, id string, spot *dto.FishingSpotUpdate) error {
	if m.updateFn != nil {
		return m.updateFn(ctx, id, spot)
	}
	return nil
}

func (m *mockFishService) Delete(ctx context.Context, id string, hard ...bool) error {
	if m.deleteFn != nil {
		return m.deleteFn(ctx, id, hard...)
	}
	return nil
}

// ---------- helpers ----------

func newFishHandler(svc *mockFishService) (*FishHandler, *gin.Engine) {
	h := NewFishHandler(svc)
	r := gin.New()
	g := r.Group("/v3")
	noopAdmin := func(c *gin.Context) { c.Next() }
	h.RegisterRoutes(g, noopAdmin, noopAdmin)
	return h, r
}

// fishDoRequest 发起一次 HTTP 请求并返回 recorder。
// 每个方法一个 helper 会更冗长 —— 这里内联，借助 gin 的 httptest 模式完成。
func fishDo(t *testing.T, r *gin.Engine, method, path string, body any) *httptest.ResponseRecorder {
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

type fishResp struct {
	Data    any    `json:"data"`
	Message string `json:"message"`
}

func fishDecode(t *testing.T, w *httptest.ResponseRecorder) fishResp {
	t.Helper()
	var r fishResp
	_ = json.Unmarshal(w.Body.Bytes(), &r)
	return r
}

// ---------- List ----------

func TestFishHandler_GetFishingSpotsList_Success(t *testing.T) {
	svc := &mockFishService{
		listFn: func(ctx context.Context) ([]*dto.FishingSpotResponse, error) {
			return []*dto.FishingSpotResponse{
				{ID: "abc", Name: "钓点 A"},
				{ID: "def", Name: "钓点 B"},
			}, nil
		},
	}
	_, r := newFishHandler(svc)

	w := fishDo(t, r, http.MethodGet, "/v3/fish/spots", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", w.Code, w.Body.String())
	}
	resp := fishDecode(t, w)
	data, ok := resp.Data.([]interface{})
	if !ok {
		t.Fatalf("data is not array: %T", resp.Data)
	}
	if len(data) != 2 {
		t.Errorf("len(data) = %d, want 2", len(data))
	}
}

func TestFishHandler_GetFishingSpotsList_Error(t *testing.T) {
	svc := &mockFishService{
		listFn: func(ctx context.Context) ([]*dto.FishingSpotResponse, error) {
			return nil, errors.New("mongo down")
		},
	}
	_, r := newFishHandler(svc)

	w := fishDo(t, r, http.MethodGet, "/v3/fish/spots", nil)
	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400; body=%s", w.Code, w.Body.String())
	}
}

func TestFishHandler_GetFishingSpotsList_EmptyNoPanic(t *testing.T) {
	svc := &mockFishService{
		listFn: func(ctx context.Context) ([]*dto.FishingSpotResponse, error) {
			return nil, nil
		},
	}
	_, r := newFishHandler(svc)

	w := fishDo(t, r, http.MethodGet, "/v3/fish/spots", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	resp := fishDecode(t, w)
	if resp.Message != "success" {
		t.Errorf("message = %q, want success", resp.Message)
	}
}

// ---------- GetByID ----------

func TestFishHandler_GetFishingSpot_Success(t *testing.T) {
	svc := &mockFishService{
		getByIDFn: func(ctx context.Context, id string) (*dto.FishingSpotResponse, error) {
			if id != "507f1f77bcf86cd799439011" {
				t.Errorf("unexpected id: %s", id)
			}
			return &dto.FishingSpotResponse{ID: id, Name: "钓点"}, nil
		},
	}
	_, r := newFishHandler(svc)

	w := fishDo(t, r, http.MethodGet, "/v3/fish/spots/507f1f77bcf86cd799439011", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", w.Code, w.Body.String())
	}
	resp := fishDecode(t, w)
	data, ok := resp.Data.(map[string]interface{})
	if !ok {
		t.Fatalf("data is not object: %T", resp.Data)
	}
	if data["name"] != "钓点" {
		t.Errorf("name = %v, want 钓点", data["name"])
	}
}

func TestFishHandler_GetFishingSpot_Error(t *testing.T) {
	svc := &mockFishService{
		getByIDFn: func(ctx context.Context, id string) (*dto.FishingSpotResponse, error) {
			return nil, errors.New("not found")
		},
	}
	_, r := newFishHandler(svc)

	w := fishDo(t, r, http.MethodGet, "/v3/fish/spots/not-found", nil)
	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", w.Code)
	}
}

// ---------- Create ----------

func TestFishHandler_CreateFishingSpot_Success(t *testing.T) {
	var captured *dto.FishingSpotRequest
	svc := &mockFishService{
		createFn: func(ctx context.Context, spot *dto.FishingSpotRequest) error {
			captured = spot
			return nil
		},
	}
	_, r := newFishHandler(svc)

	body := dto.FishingSpotRequest{Name: "新钓点", Location: []float64{120.1, 30.2}, Kind: "lake"}
	w := fishDo(t, r, http.MethodPost, "/v3/fish/spots", body)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", w.Code, w.Body.String())
	}
	if captured == nil || captured.Name != "新钓点" {
		t.Errorf("captured = %+v, want name=新钓点", captured)
	}
}

func TestFishHandler_CreateFishingSpot_InvalidJSON(t *testing.T) {
	svc := &mockFishService{}
	_, r := newFishHandler(svc)

	req, _ := http.NewRequest(http.MethodPost, "/v3/fish/spots", bytes.NewReader([]byte("not json")))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", w.Code)
	}
}

func TestFishHandler_CreateFishingSpot_MissingRequiredFields(t *testing.T) {
	svc := &mockFishService{}
	_, r := newFishHandler(svc)

	// 缺 name / location / kind → binding:"required" 失败。ptr 复用 admin_test.go 的通用 helper。
	body := dto.FishingSpotRequest{}
	w := fishDo(t, r, http.MethodPost, "/v3/fish/spots", body)
	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400 (missing required field)", w.Code)
	}
}

// TestFishHandler_CreateFishingSpot_InvalidKind 验证 binding 的 oneof 拒绝非枚举值，
// 400 + message 含 "invalid_kind" 标记（AC: {"code": "invalid_kind"}）。
func TestFishHandler_CreateFishingSpot_InvalidKind(t *testing.T) {
	svc := &mockFishService{}
	_, r := newFishHandler(svc)

	body := dto.FishingSpotRequest{
		Name:     "t",
		Location: []float64{1, 2},
		Kind:     "marsh", // 非法
	}
	w := fishDo(t, r, http.MethodPost, "/v3/fish/spots", body)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body=%s", w.Code, w.Body.String())
	}
	resp := fishDecode(t, w)
	if !strings.Contains(resp.Message, "invalid_kind") {
		t.Errorf("message = %q, want it to contain invalid_kind", resp.Message)
	}
}

// TestFishHandler_UpdateFishingSpot_InvalidKind 验证 PATCH 同样走 invalid_kind 400。
func TestFishHandler_UpdateFishingSpot_InvalidKind(t *testing.T) {
	svc := &mockFishService{
		updateFn: func(ctx context.Context, id string, spot *dto.FishingSpotUpdate) error {
			// service 层二次校验：若 binding 漏过，service 仍返 ErrInvalidKind
			if spot == nil || spot.Kind == nil || !document.IsValidKind(*spot.Kind) {
				return service.ErrInvalidKind
			}
			return nil
		},
	}
	_, r := newFishHandler(svc)

	kind := "bogus"
	body := dto.FishingSpotUpdate{Kind: &kind}
	w := fishDo(t, r, http.MethodPatch, "/v3/fish/spots/abc", body)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body=%s", w.Code, w.Body.String())
	}
	resp := fishDecode(t, w)
	if !strings.Contains(resp.Message, "invalid_kind") {
		t.Errorf("message = %q, want it to contain invalid_kind", resp.Message)
	}
}

func TestFishHandler_CreateFishingSpot_ServiceError(t *testing.T) {
	svc := &mockFishService{
		createFn: func(ctx context.Context, spot *dto.FishingSpotRequest) error {
			return errors.New("create failed")
		},
	}
	_, r := newFishHandler(svc)

	body := dto.FishingSpotRequest{Name: "t", Location: []float64{1, 2}, Kind: "lake"}
	w := fishDo(t, r, http.MethodPost, "/v3/fish/spots", body)
	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", w.Code)
	}
}

// ---------- Update ----------

func TestFishHandler_UpdateFishingSpot_Partial(t *testing.T) {
	var capturedID string
	var capturedSpot *dto.FishingSpotUpdate
	svc := &mockFishService{
		updateFn: func(ctx context.Context, id string, spot *dto.FishingSpotUpdate) error {
			capturedID = id
			capturedSpot = spot
			return nil
		},
	}
	_, r := newFishHandler(svc)

	// 只传 name —— 其余字段不动
	body := dto.FishingSpotUpdate{Name: ptr("新名字")}
	w := fishDo(t, r, http.MethodPatch, "/v3/fish/spots/507f1f77bcf86cd799439011", body)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", w.Code, w.Body.String())
	}
	if capturedID != "507f1f77bcf86cd799439011" {
		t.Errorf("capturedID = %q, want 507f1f77bcf86cd799439011", capturedID)
	}
	if capturedSpot == nil || capturedSpot.Name == nil || *capturedSpot.Name != "新名字" {
		t.Errorf("captured name wrong: %+v", capturedSpot)
	}
	if capturedSpot.Description != nil || capturedSpot.Tags != nil {
		t.Errorf("unsupplied fields should be nil: %+v", capturedSpot)
	}
}

func TestFishHandler_UpdateFishingSpot_ExplicitZeroValue(t *testing.T) {
	var captured *dto.FishingSpotUpdate
	svc := &mockFishService{
		updateFn: func(ctx context.Context, id string, spot *dto.FishingSpotUpdate) error {
			captured = spot
			return nil
		},
	}
	_, r := newFishHandler(svc)

	// 显式传 rating: 0 应该被保留（非 nil → 覆盖）
	body := dto.FishingSpotUpdate{Rating: ptr(0.0)}
	w := fishDo(t, r, http.MethodPatch, "/v3/fish/spots/abc", body)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	if captured == nil || captured.Rating == nil {
		t.Fatalf("rating should be non-nil: %+v", captured)
	}
	if *captured.Rating != 0 {
		t.Errorf("rating = %v, want 0", *captured.Rating)
	}
}

func TestFishHandler_UpdateFishingSpot_InvalidJSON(t *testing.T) {
	svc := &mockFishService{}
	_, r := newFishHandler(svc)

	req, _ := http.NewRequest(http.MethodPatch, "/v3/fish/spots/abc", bytes.NewReader([]byte("{bad")))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", w.Code)
	}
}

func TestFishHandler_UpdateFishingSpot_ServiceError(t *testing.T) {
	svc := &mockFishService{
		updateFn: func(ctx context.Context, id string, spot *dto.FishingSpotUpdate) error {
			return errors.New("update failed")
		},
	}
	_, r := newFishHandler(svc)

	body := dto.FishingSpotUpdate{Name: ptr("x")}
	w := fishDo(t, r, http.MethodPatch, "/v3/fish/spots/abc", body)
	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", w.Code)
	}
}

// ---------- Delete ----------

func TestFishHandler_DeleteFishingSpot_SoftDelete(t *testing.T) {
	var capturedHard []bool
	svc := &mockFishService{
		deleteFn: func(ctx context.Context, id string, hard ...bool) error {
			capturedHard = hard
			return nil
		},
	}
	_, r := newFishHandler(svc)

	w := fishDo(t, r, http.MethodDelete, "/v3/fish/spots/abc", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	if len(capturedHard) > 0 && capturedHard[0] {
		t.Errorf("expected soft delete; hard = %v", capturedHard)
	}
}

func TestFishHandler_DeleteFishingSpot_HardDelete(t *testing.T) {
	var capturedHard bool
	svc := &mockFishService{
		deleteFn: func(ctx context.Context, id string, hard ...bool) error {
			if len(hard) > 0 {
				capturedHard = hard[0]
			}
			return nil
		},
	}
	_, r := newFishHandler(svc)

	w := fishDo(t, r, http.MethodDelete, "/v3/fish/spots/abc?hard=true", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	if !capturedHard {
		t.Error("expected hard delete (?hard=true)")
	}
}

func TestFishHandler_DeleteFishingSpot_Error(t *testing.T) {
	svc := &mockFishService{
		deleteFn: func(ctx context.Context, id string, hard ...bool) error {
			return errors.New("delete failed")
		},
	}
	_, r := newFishHandler(svc)

	w := fishDo(t, r, http.MethodDelete, "/v3/fish/spots/abc", nil)
	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", w.Code)
	}
}
