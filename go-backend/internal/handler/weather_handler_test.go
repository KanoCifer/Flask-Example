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
	"github.com/KanoCifer/kuroome-blog/internal/service"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// ── mock Weatherer ──────────────────────────────────────────────────

type mockWeatherService struct {
	getTideFn func(ctx context.Context, harbor, date string) (json.RawMessage, bool, error)
	fullFn    func(ctx context.Context, location string) (*dto.FullWeatherData, error)
	// 其余方法本任务不测；保留占位以便编译期接口断言通过
	_ func(ctx context.Context, location, locationID *string) (json.RawMessage, error)
}

var _ Weatherer = (*mockWeatherService)(nil)

func (m *mockWeatherService) GetTide(ctx context.Context, harbor, date string) (json.RawMessage, bool, error) {
	if m.getTideFn != nil {
		return m.getTideFn(ctx, harbor, date)
	}
	return nil, false, nil
}
func (m *mockWeatherService) GetCurrent(ctx context.Context, location, locationID *string) (json.RawMessage, error) {
	return nil, nil
}
func (m *mockWeatherService) GetHourly(ctx context.Context, hours int, location, locationID *string) (json.RawMessage, error) {
	return nil, nil
}
func (m *mockWeatherService) GetForecast(ctx context.Context, days int, location, locationID *string) (json.RawMessage, error) {
	return nil, nil
}
func (m *mockWeatherService) GetIndices(ctx context.Context, location, locationID *string) (json.RawMessage, error) {
	return nil, nil
}
func (m *mockWeatherService) GetPOI(ctx context.Context, location string) (json.RawMessage, error) {
	return nil, nil
}
func (m *mockWeatherService) GetNearbyTSTA(ctx context.Context, location string) (map[string]string, error) {
	return nil, nil
}
func (m *mockWeatherService) GetFullWeatherData(ctx context.Context, location string) (*dto.FullWeatherData, error) {
	if m.fullFn != nil {
		return m.fullFn(ctx, location)
	}
	return nil, nil
}

// ── helpers ─────────────────────────────────────────────────────────

// newWeatherRouter 构造一个独立的 gin 引擎并挂载 weather 路由，
// 便于 httptest 直接发请求而无需经过 middleware / Trace。
func newWeatherRouter(svc Weatherer) *gin.Engine {
	h := NewWeatherHandler(svc)
	r := gin.New()
	g := r.Group("/v3")
	h.RegisterRoutes(g)
	return r
}

func decodeResponse(t *testing.T, body []byte) response.Response {
	t.Helper()
	var r response.Response
	if err := json.Unmarshal(body, &r); err != nil {
		t.Fatalf("decode response: %v\nbody=%s", err, body)
	}
	return r
}

func doGET(r *gin.Engine, path string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

// ── GetTide ─────────────────────────────────────────────────────────

func TestWeatherHandler_GetTide_HappyPath_CacheMiss(t *testing.T) {
	svc := &mockWeatherService{
		getTideFn: func(_ context.Context, harbor, date string) (json.RawMessage, bool, error) {
			if harbor != "P2352" || date != "20260115" {
				t.Errorf("unexpected args: harbor=%q date=%q", harbor, date)
			}
			return json.RawMessage(`{"tide":[]}`), false, nil
		},
	}

	w := doGET(newWeatherRouter(svc), "/v3/weather/tide?date=20260115")

	if w.Code != 200 {
		t.Fatalf("status = %d, want 200; body=%s", w.Code, w.Body.String())
	}
	resp := decodeResponse(t, w.Body.Bytes())
	if resp.Message != "Tide information retrieved successfully" {
		t.Errorf("message = %q", resp.Message)
	}

	data, ok := resp.Data.(map[string]any)
	if !ok {
		t.Fatalf("data type = %T, want object", resp.Data)
	}
	fromCache, _ := data["fromCache"].(bool)
	if fromCache {
		t.Error("fromCache should be false on cache miss")
	}
	if _, ok := data["data"]; !ok {
		t.Error("data.data missing")
	}
}

func TestWeatherHandler_GetTide_HappyPath_CacheHit(t *testing.T) {
	svc := &mockWeatherService{
		getTideFn: func(_ context.Context, _, _ string) (json.RawMessage, bool, error) {
			return json.RawMessage(`{"tide":[]}`), true, nil
		},
	}

	w := doGET(newWeatherRouter(svc), "/v3/weather/tide?date=20260115")
	if w.Code != 200 {
		t.Fatalf("status = %d", w.Code)
	}
	resp := decodeResponse(t, w.Body.Bytes())
	if resp.Message != "Tide information retrieved from cache" {
		t.Errorf("message = %q, want 'from cache'", resp.Message)
	}
	data, _ := resp.Data.(map[string]any)
	if fromCache, _ := data["fromCache"].(bool); !fromCache {
		t.Error("fromCache should be true on cache hit")
	}
}

func TestWeatherHandler_GetTide_DefaultHarbor(t *testing.T) {
	var gotHarbor string
	svc := &mockWeatherService{
		getTideFn: func(_ context.Context, harbor, _ string) (json.RawMessage, bool, error) {
			gotHarbor = harbor
			return json.RawMessage(`{}`), false, nil
		},
	}

	w := doGET(newWeatherRouter(svc), "/v3/weather/tide?date=20260115")
	if w.Code != 200 {
		t.Fatalf("status = %d, body=%s", w.Code, w.Body.String())
	}
	if gotHarbor != "P2352" {
		t.Errorf("default harbor = %q, want P2352", gotHarbor)
	}
}

func TestWeatherHandler_GetTide_MissingDate(t *testing.T) {
	w := doGET(newWeatherRouter(&mockWeatherService{}), "/v3/weather/tide")
	if w.Code != 400 {
		t.Fatalf("status = %d, want 400", w.Code)
	}
	if !strings.Contains(w.Body.String(), "date is required") {
		t.Errorf("body = %s", w.Body.String())
	}
}

// ── GetFullWeather ──────────────────────────────────────────────────

func TestWeatherHandler_GetFullWeather_HappyPath(t *testing.T) {
	svc := &mockWeatherService{
		fullFn: func(_ context.Context, location string) (*dto.FullWeatherData, error) {
			if location != "116.40,39.90" {
				t.Errorf("location = %q", location)
			}
			return &dto.FullWeatherData{
				Current:      json.RawMessage(`{"now":{"temp":"25"}}`),
				LocationName: "港口A",
				POIID:        "P2352",
			}, nil
		},
	}

	w := doGET(newWeatherRouter(svc), "/v3/weather/full?location=116.40,39.90")
	if w.Code != 200 {
		t.Fatalf("status = %d, body=%s", w.Code, w.Body.String())
	}
	resp := decodeResponse(t, w.Body.Bytes())
	if resp.Message != "Full weather data retrieved successfully" {
		t.Errorf("message = %q", resp.Message)
	}
	data, ok := resp.Data.(map[string]any)
	if !ok {
		t.Fatalf("data type = %T", resp.Data)
	}
	if data["locationName"] != "港口A" {
		t.Errorf("locationName = %v", data["locationName"])
	}
	if data["poiId"] != "P2352" {
		t.Errorf("poiId = %v", data["poiId"])
	}
	if _, ok := data["current"]; !ok {
		t.Error("current field missing")
	}
}

func TestWeatherHandler_GetFullWeather_MissingLocation(t *testing.T) {
	w := doGET(newWeatherRouter(&mockWeatherService{}), "/v3/weather/full")
	if w.Code != 400 {
		t.Fatalf("status = %d, want 400", w.Code)
	}
	if !strings.Contains(w.Body.String(), "location is required") {
		t.Errorf("body = %s", w.Body.String())
	}
}

func TestWeatherHandler_GetFullWeather_ErrInvalidLocation_400(t *testing.T) {
	svc := &mockWeatherService{
		fullFn: func(_ context.Context, _ string) (*dto.FullWeatherData, error) {
			return nil, service.ErrInvalidLocation
		},
	}
	w := doGET(newWeatherRouter(svc), "/v3/weather/full?location=0,0")
	if w.Code != 400 {
		t.Fatalf("status = %d, want 400", w.Code)
	}
	if !strings.Contains(w.Body.String(), "missing location") {
		t.Errorf("body = %s", w.Body.String())
	}
}

func TestWeatherHandler_GetFullWeather_ErrUpstream_502(t *testing.T) {
	svc := &mockWeatherService{
		fullFn: func(_ context.Context, _ string) (*dto.FullWeatherData, error) {
			return nil, service.ErrUpstream
		},
	}
	w := doGET(newWeatherRouter(svc), "/v3/weather/full?location=0,0")
	if w.Code != 502 {
		t.Fatalf("status = %d, want 502", w.Code)
	}
	if !strings.Contains(w.Body.String(), "qweather upstream error") {
		t.Errorf("body = %s", w.Body.String())
	}
}

func TestWeatherHandler_GetFullWeather_ErrUnavailable_503(t *testing.T) {
	svc := &mockWeatherService{
		fullFn: func(_ context.Context, _ string) (*dto.FullWeatherData, error) {
			return nil, service.ErrUnavailable
		},
	}
	w := doGET(newWeatherRouter(svc), "/v3/weather/full?location=0,0")
	if w.Code != 503 {
		t.Fatalf("status = %d, want 503", w.Code)
	}
	if !strings.Contains(w.Body.String(), "qweather unavailable") {
		t.Errorf("body = %s", w.Body.String())
	}
}

func TestWeatherHandler_GetFullWeather_GenericError_500(t *testing.T) {
	svc := &mockWeatherService{
		fullFn: func(_ context.Context, _ string) (*dto.FullWeatherData, error) {
			return nil, errors.New("boom")
		},
	}
	w := doGET(newWeatherRouter(svc), "/v3/weather/full?location=0,0")
	if w.Code != 500 {
		t.Fatalf("status = %d, want 500", w.Code)
	}
	if !strings.Contains(w.Body.String(), "internal error") {
		t.Errorf("body = %s", w.Body.String())
	}
}

// ── RegisterRoutes ──────────────────────────────────────────────────

func TestWeatherHandler_RegisterRoutes_Reachable(t *testing.T) {
	r := newWeatherRouter(&mockWeatherService{
		fullFn: func(_ context.Context, _ string) (*dto.FullWeatherData, error) {
			return &dto.FullWeatherData{}, nil
		},
	})

	for _, path := range []string{
		"/v3/weather/tide?date=20260115",
		"/v3/weather/full?location=0,0",
	} {
		w := doGET(r, path)
		// mock 的 fullFn / getTideFn 返回零值 + nil error，所以是 200
		if w.Code != 200 {
			t.Errorf("%s: status = %d, want 200; body=%s", path, w.Code, w.Body.String())
		}
	}

	// 未注册路径应 404
	w := doGET(r, "/v3/weather/unknown")
	if w.Code != 404 {
		t.Errorf("unknown path: status = %d, want 404", w.Code)
	}
}
