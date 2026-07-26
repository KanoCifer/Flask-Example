package handler

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/KanoCifer/kuroome-blog/internal/config"
	"github.com/KanoCifer/kuroome-blog/internal/dto"
	"github.com/KanoCifer/kuroome-blog/internal/service"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// ---------- mock MonitorService ----------

type mockMonitorService struct {
	overviewFn        func(ctx context.Context, days int) (dto.OverviewResponse, error)
	visitorsFn        func(ctx context.Context, days, page, pageSize int) (dto.VisitorListResponse, error)
	userLoginsFn      func(ctx context.Context, days, page, pageSize int) (dto.UserLoginsResponse, error)
	serverStatusFn    func() (dto.ServerStatusResponse, error)
	trackVisitorFn    func(ctx context.Context, data dto.VisitorTrackRequest) error
	getStatusDetailFn func(ctx context.Context) (dto.StatusDetailResponse, error)
}

func (m *mockMonitorService) GetOverview(ctx context.Context, days int) (dto.OverviewResponse, error) {
	return m.overviewFn(ctx, days)
}

func (m *mockMonitorService) GetVisitors(ctx context.Context, days, page, pageSize int) (dto.VisitorListResponse, error) {
	return m.visitorsFn(ctx, days, page, pageSize)
}

func (m *mockMonitorService) GetUserLogins(ctx context.Context, days, page, pageSize int) (dto.UserLoginsResponse, error) {
	return m.userLoginsFn(ctx, days, page, pageSize)
}

func (m *mockMonitorService) GetServerStatus() (dto.ServerStatusResponse, error) {
	if m.serverStatusFn != nil {
		return m.serverStatusFn()
	}
	return dto.ServerStatusResponse{}, nil
}

func (m *mockMonitorService) GetStatusDetail(ctx context.Context) (dto.StatusDetailResponse, error) {
	if m.getStatusDetailFn != nil {
		return m.getStatusDetailFn(ctx)
	}
	return dto.StatusDetailResponse{}, nil
}

func (m *mockMonitorService) TrackVisitor(ctx context.Context, data dto.VisitorTrackRequest) error {
	if m.trackVisitorFn != nil {
		return m.trackVisitorFn(ctx, data)
	}
	return nil
}

func (m *mockMonitorService) StreamServerStatus(ctx context.Context) (<-chan dto.ServerStatusResponse, error) {
	ch := make(chan dto.ServerStatusResponse, 1)
	if m.serverStatusFn != nil {
		if s, err := m.serverStatusFn(); err == nil {
			ch <- s
		}
	}
	close(ch)
	return ch, nil
}

// ---------- helpers ----------

func setupMonitor(svc service.Monitorer, adminMW gin.HandlerFunc) *gin.Engine {
	h := NewMonitorHandler(svc, config.Cfg)
	r := gin.New()
	g := r.Group("/v3")
	noopAuth := func(c *gin.Context) { c.Set("user_id", 1); c.Next() }
	h.RegisterRoutes(g, noopAuth, adminMW)
	return r
}

func requestGet(t *testing.T, r *gin.Engine, path string) *httptest.ResponseRecorder {
	t.Helper()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, path, nil)
	r.ServeHTTP(w, req)
	return w
}

// ---------- overview ----------

func TestGetOverview_ReturnsData(t *testing.T) {
	svc := &mockMonitorService{
		overviewFn: func(ctx context.Context, days int) (dto.OverviewResponse, error) {
			return dto.OverviewResponse{TotalVisits: 10, UniqueVisitors: 5, PeriodDays: days}, nil
		},
	}
	adminAllow := func(c *gin.Context) { c.Next() }
	r := setupMonitor(svc, adminAllow)

	w := requestGet(t, r, "/v3/status/overview?days=7")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"total_visits":10`) {
		t.Fatalf("unexpected body: %s", w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"message":"Visitor overview data retrieved successfully"`) {
		t.Fatalf("unexpected message: %s", w.Body.String())
	}
}

func TestGetOverview_DefaultsDaysTo7(t *testing.T) {
	svc := &mockMonitorService{
		overviewFn: func(ctx context.Context, days int) (dto.OverviewResponse, error) {
			return dto.OverviewResponse{PeriodDays: days}, nil
		},
	}
	adminAllow := func(c *gin.Context) { c.Next() }
	r := setupMonitor(svc, adminAllow)

	w := requestGet(t, r, "/v3/status/overview")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), `"period_days":7`) {
		t.Fatalf("expected default days=7, got: %s", w.Body.String())
	}
}

func TestGetOverview_InvalidDays(t *testing.T) {
	svc := &mockMonitorService{}
	adminAllow := func(c *gin.Context) { c.Next() }
	r := setupMonitor(svc, adminAllow)

	w := requestGet(t, r, "/v3/status/overview?days=0")
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for days=0, got %d", w.Code)
	}

	w = requestGet(t, r, "/v3/status/overview?days=91")
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for days=91, got %d", w.Code)
	}
}

// ---------- visitors ----------

func TestGetVisitors_ReturnsPaginatedList(t *testing.T) {
	svc := &mockMonitorService{
		visitorsFn: func(ctx context.Context, days, page, pageSize int) (dto.VisitorListResponse, error) {
			return dto.VisitorListResponse{
				List:       []dto.VisitorItem{},
				Pagination: dto.Pagination{Page: 1, PerPage: 20, Total: 50, Pages: 3},
			}, nil
		},
	}
	adminAllow := func(c *gin.Context) { c.Next() }
	r := setupMonitor(svc, adminAllow)

	w := requestGet(t, r, "/v3/status/visitors?days=7&page=1&page_size=20")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), `"total":50`) || !strings.Contains(w.Body.String(), `"pages":3`) {
		t.Fatalf("unexpected body: %s", w.Body.String())
	}
}

func TestGetVisitors_InvalidPageSize(t *testing.T) {
	svc := &mockMonitorService{}
	adminAllow := func(c *gin.Context) { c.Next() }
	r := setupMonitor(svc, adminAllow)

	w := requestGet(t, r, "/v3/status/visitors?page_size=101")
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for page_size=101, got %d", w.Code)
	}
}

// ---------- user-logins ----------

func TestGetUserLogins_ReturnsList(t *testing.T) {
	svc := &mockMonitorService{
		userLoginsFn: func(ctx context.Context, days, page, pageSize int) (dto.UserLoginsResponse, error) {
			return dto.UserLoginsResponse{
				List:       []dto.UserLoginItem{{UserID: 1, Username: "u"}},
				Pagination: dto.Pagination{Total: 2, Page: 1, PerPage: 20, Pages: 1},
			}, nil
		},
	}
	adminAllow := func(c *gin.Context) { c.Next() }
	r := setupMonitor(svc, adminAllow)

	w := requestGet(t, r, "/v3/status/user-logins?days=7&page=1&page_size=20")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), `"total":2`) {
		t.Fatalf("unexpected body: %s", w.Body.String())
	}
}

// ---------- admin enforcement ----------

func TestMonitorEndpoints_RequireAdmin(t *testing.T) {
	svc := &mockMonitorService{}
	// adminMW that rejects (simulates non-admin user)
	adminReject := func(c *gin.Context) { c.AbortWithStatusJSON(403, gin.H{"error": "Admin access required"}) }
	r := setupMonitor(svc, adminReject)

	paths := []string{
		"/v3/status/overview",
		"/v3/status/visitors",
		"/v3/status/user-logins",
	}
	for _, p := range paths {
		w := requestGet(t, r, p)
		if w.Code != http.StatusForbidden {
			t.Fatalf("%s: expected 403 for non-admin, got %d", p, w.Code)
		}
	}
}

// ---------- error propagation ----------

func TestGetOverview_ServiceError(t *testing.T) {
	svc := &mockMonitorService{
		overviewFn: func(ctx context.Context, days int) (dto.OverviewResponse, error) {
			return dto.OverviewResponse{}, errors.New("db boom")
		},
	}
	adminAllow := func(c *gin.Context) { c.Next() }
	r := setupMonitor(svc, adminAllow)

	w := requestGet(t, r, "/v3/status/overview")
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 on service error, got %d", w.Code)
	}
}

// ---------- server/status ----------

func TestGetServerStatus_ReturnsPayload(t *testing.T) {
	svc := &mockMonitorService{
		serverStatusFn: func() (dto.ServerStatusResponse, error) {
			return dto.ServerStatusResponse{CPUPercent: 23.5, CPUCores: 8, MemTotal: 16384}, nil
		},
	}
	adminAllow := func(c *gin.Context) { c.Next() }
	r := setupMonitor(svc, adminAllow)

	w := requestGet(t, r, "/v3/status/server/status")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"cpu_percent":23.5`) {
		t.Fatalf("unexpected body: %s", w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"cpu_cores":8`) {
		t.Fatalf("unexpected body: %s", w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"message":"Server status retrieved successfully"`) {
		t.Fatalf("unexpected message: %s", w.Body.String())
	}
}

func TestServerStatusStream_ReturnsSSEFrames(t *testing.T) {
	svc := &mockMonitorService{
		serverStatusFn: func() (dto.ServerStatusResponse, error) {
			return dto.ServerStatusResponse{CPUPercent: 12.3, CPUCores: 4}, nil
		},
	}
	adminAllow := func(c *gin.Context) { c.Next() }
	r := setupMonitor(svc, adminAllow)

	// c.Stream 需要真实 ResponseWriter（httptest.NewRecorder 未实现
	// http.CloseNotifier 会 panic），所以用 httptest.NewServer + 真实客户端。
	srv := httptest.NewServer(r)
	defer srv.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, srv.URL+"/v3/status/server/status/stream", nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	if ct := resp.Header.Get("Content-Type"); !strings.Contains(ct, "text/event-stream") {
		t.Fatalf("expected text/event-stream, got %q", ct)
	}
	// 读一个 SSE 帧后取消 ctx，驱动服务端 goroutine 退出。
	buf := make([]byte, 4096)
	n, _ := resp.Body.Read(buf)
	body := string(buf[:n])
	if !strings.Contains(body, `"cpu_percent":12.3`) {
		t.Fatalf("SSE body missing payload: %q", body)
	}
	if !strings.Contains(body, "data:") {
		t.Fatalf("expected SSE data: frame, got: %q", body)
	}
}

func TestServerStatus_RequiresAdmin(t *testing.T) {
	svc := &mockMonitorService{}
	adminReject := func(c *gin.Context) { c.AbortWithStatusJSON(403, gin.H{"error": "Admin access required"}) }
	r := setupMonitor(svc, adminReject)

	w := requestGet(t, r, "/v3/status/server/status")
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for non-admin, got %d", w.Code)
	}
}

// ---------- TrackVisitor ----------

func TestTrackVisitor_Disabled(t *testing.T) {
	config.Cfg = &config.Config{Admin: config.AdminConfig{EnableTracking: false}}
	svc := &mockMonitorService{}
	r := setupMonitor(svc, func(c *gin.Context) { c.Next() })
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v3/status/track",
		strings.NewReader(`{"visitor_id":"v","page_path":"/","page_url":"u"}`))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNoContent {
		t.Errorf("status = %d, want %d (tracking disabled)", w.Code, http.StatusNoContent)
	}
}

func TestTrackVisitor_Success(t *testing.T) {
	config.Cfg = &config.Config{Admin: config.AdminConfig{EnableTracking: true}}
	svc := &mockMonitorService{
		trackVisitorFn: func(ctx context.Context, data dto.VisitorTrackRequest) error { return nil },
	}
	r := setupMonitor(svc, func(c *gin.Context) { c.Next() })
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v3/status/track",
		strings.NewReader(`{"visitor_id":"v","page_path":"/","page_url":"u"}`))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNoContent {
		t.Errorf("status = %d, want %d", w.Code, http.StatusNoContent)
	}
}

func TestOldTrackRedirect(t *testing.T) {
	config.Cfg = &config.Config{Admin: config.AdminConfig{EnableTracking: true}}
	svc := &mockMonitorService{
		trackVisitorFn: func(ctx context.Context, data dto.VisitorTrackRequest) error { return nil },
	}
	h := NewMonitorHandler(svc, config.Cfg)
	r := gin.New()
	g := r.Group("/v3")
	h.RegisterRoutes(g, func(c *gin.Context) { c.Set("user_id", 1); c.Next() }, func(c *gin.Context) { c.Next() })
	// 旧路由 POST /track（对齐 router.go 中的 v3.POST）
	g.POST("/track", h.TrackVisitor)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v3/track",
		strings.NewReader(`{"visitor_id":"v","page_path":"/","page_url":"u"}`))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNoContent {
		t.Errorf("old /track: status = %d, want %d", w.Code, http.StatusNoContent)
	}
}

// ---------- status detail ----------

func TestGetStatusDetail_ReturnsPayload(t *testing.T) {
	svc := &mockMonitorService{
		getStatusDetailFn: func(ctx context.Context) (dto.StatusDetailResponse, error) {
			return dto.StatusDetailResponse{
				Version: dto.VersionInfoResponse{RepoURL: "https://github.com/KanoCifer/kuroome-blog", CurrentVersion: "4.0.0"},
				Service: dto.ServiceInfoResponse{Runtime: "go1.26", DbOk: true, ApiOk: true},
				System:  dto.SystemInfoResponse{OsName: "darwin", CpuCountLogical: 8},
			}, nil
		},
	}
	r := setupMonitor(svc, func(c *gin.Context) { c.Next() })

	w := requestGet(t, r, "/v3/status/detail")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"repo_url"`) {
		t.Fatalf("expected version.repo_url in body: %s", w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"db_ok":true`) {
		t.Fatalf("expected db_ok:true in body: %s", w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"os_name":"darwin"`) {
		t.Fatalf("expected os_name in body: %s", w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"message":"Status detail retrieved successfully"`) {
		t.Fatalf("unexpected message: %s", w.Body.String())
	}
}
