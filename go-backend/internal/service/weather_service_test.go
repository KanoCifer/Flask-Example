package service

import (
	"context"
	"crypto/ed25519"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"

	"github.com/KanoCifer/kuroome-blog/internal/config"
	"github.com/KanoCifer/kuroome-blog/internal/dto"
	"github.com/KanoCifer/kuroome-blog/internal/infra/httpclient"
	"github.com/KanoCifer/kuroome-blog/pkg/qweather"
)

// ── shared fixtures ─────────────────────────────────────────────────

func newTestWeatherService(t *testing.T, srvURL string) (*WeatherService, *miniredis.Miniredis) {
	t.Helper()

	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("miniredis: %v", err)
	}
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})

	_, priv, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatalf("GenerateKey: %v", err)
	}
	pkcs8, err := x509.MarshalPKCS8PrivateKey(priv)
	if err != nil {
		t.Fatalf("MarshalPKCS8PrivateKey: %v", err)
	}
	pemStr := string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: pkcs8}))
	signer, err := qweather.NewSigner(pemStr)
	if err != nil {
		t.Fatalf("NewSigner: %v", err)
	}

	svc := NewWeatherService(
		httpclient.New(),
		rdb,
		config.WeatherConfig{QweatherBaseURL: srvURL},
		signer,
	)
	// 固定时钟便于断言 JWT iat/exp
	svc.qw.now = func() time.Time { return time.Unix(1_700_000_000, 0) }

	return svc, mr
}

func newCapturingServer(t *testing.T, hits *atomic.Int32, body string) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(srv.Close)
	return srv
}

// waitForCache 轮询等待异步写回的缓存落盘（miniredis），超时则 t.Fatal。
// 生产代码以 goroutine 写回缓存，响应返回时写回未必完成，直接断言会竞态。
func waitForCache(t *testing.T, mr *miniredis.Miniredis, key, want string) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for {
		if cached, err := mr.Get(key); err == nil && cached == want {
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("cache key %q not written back to %q within 2s", key, want)
		}
		time.Sleep(10 * time.Millisecond)
	}
}

// ── GetTide ─────────────────────────────────────────────────────────

func TestWeatherService_GetTide_CacheHit(t *testing.T) {
	var hits atomic.Int32
	srv := newCapturingServer(t, &hits, `{"code":"200"}`)
	svc, mr := newTestWeatherService(t, srv.URL)
	t.Cleanup(func() { mr.Close() })

	cacheKey := "qweather:tide:P2352:20260115"
	if err := mr.Set(cacheKey, `{"cached":true}`); err != nil {
		t.Fatalf("miniredis.Set: %v", err)
	}

	data, hit, err := svc.GetTide(context.Background(), "P2352", "20260115")
	if err != nil {
		t.Fatalf("GetTide: %v", err)
	}
	if !hit {
		t.Error("expected hit=true on cache hit")
	}
	if string(data) != `{"cached":true}` {
		t.Errorf("data = %q, want %q", data, `{"cached":true}`)
	}
	if hits.Load() != 0 {
		t.Errorf("expected 0 upstream calls, got %d", hits.Load())
	}
}

func TestWeatherService_GetTide_CacheMiss_FetchesUpstream(t *testing.T) {
	hits := atomic.Int32{}
	srv := newCapturingServer(t, &hits, `{"code":"200","data":[1,2,3]}`)
	svc, mr := newTestWeatherService(t, srv.URL)
	t.Cleanup(func() { mr.Close() })

	data, hit, err := svc.GetTide(context.Background(), "P2352", "20260115")
	if err != nil {
		t.Fatalf("GetTide: %v", err)
	}
	if hit {
		t.Error("expected hit=false on cache miss")
	}
	if string(data) != `{"code":"200","data":[1,2,3]}` {
		t.Errorf("unexpected data: %s", data)
	}
	if hits.Load() != 1 {
		t.Errorf("expected 1 upstream call, got %d", hits.Load())
	}

	// 缓存写回（异步 goroutine，轮询等待落盘）
	waitForCache(t, mr, "qweather:tide:P2352:20260115", `{"code":"200","data":[1,2,3]}`)
}

// ── GetCurrent ──────────────────────────────────────────────────────

func TestWeatherService_GetCurrent_PathAndParams(t *testing.T) {
	var gotPath atomic.Value
	var gotQuery atomic.Value
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath.Store(r.URL.Path)
		gotQuery.Store(r.URL.RawQuery)
		w.Write([]byte(`{"now":{"temp":"25"}}`))
	}))
	defer srv.Close()

	svc, mr := newTestWeatherService(t, srv.URL)
	defer mr.Close()

	loc := "116.40,39.90"
	data, err := svc.GetCurrent(context.Background(), &loc, nil)
	if err != nil {
		t.Fatalf("GetCurrent: %v", err)
	}
	if !strings.Contains(string(data), `"temp":"25"`) {
		t.Errorf("unexpected data: %s", data)
	}
	if p, _ := gotPath.Load().(string); p != "/v7/weather/now" {
		t.Errorf("path = %q, want /v7/weather/now", p)
	}
	if q, _ := gotQuery.Load().(string); !strings.Contains(q, "location=116.40%2C39.90") {
		t.Errorf("query missing location: %q", q)
	}
}

// ── GetHourly ───────────────────────────────────────────────────────

func TestWeatherService_GetHourly_PathIncludesHours(t *testing.T) {
	var gotPath atomic.Value
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath.Store(r.URL.Path)
		w.Write([]byte(`{"hourly":[]}`))
	}))
	defer srv.Close()

	svc, mr := newTestWeatherService(t, srv.URL)
	defer mr.Close()

	loc := "116.40,39.90"
	if _, err := svc.GetHourly(context.Background(), 24, &loc, nil); err != nil {
		t.Fatalf("GetHourly: %v", err)
	}
	if p, _ := gotPath.Load().(string); p != "/v7/weather/24h" {
		t.Errorf("path = %q, want /v7/weather/24h", p)
	}
}

// ── GetForecast ─────────────────────────────────────────────────────

func TestWeatherService_GetForecast_PathAndCacheKey(t *testing.T) {
	var gotPath atomic.Value
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath.Store(r.URL.Path)
		w.Write([]byte(`{"daily":[]}`))
	}))
	defer srv.Close()

	svc, mr := newTestWeatherService(t, srv.URL)
	defer mr.Close()

	id := "P2352"
	if _, err := svc.GetForecast(context.Background(), 3, nil, &id); err != nil {
		t.Fatalf("GetForecast: %v", err)
	}
	if p, _ := gotPath.Load().(string); p != "/v7/weather/3d" {
		t.Errorf("path = %q, want /v7/weather/3d", p)
	}
	// 缓存 key 必须包含 days 后缀（避免 3d / 7d 命中同一 key）；
	// 写回是异步 goroutine，轮询等待落盘。
	waitForCache(t, mr, "qweather:forecast:P2352:3d", `{"daily":[]}`)
}

// ── GetIndices ──────────────────────────────────────────────────────

func TestWeatherService_GetIndices_TypeAdded(t *testing.T) {
	var gotQuery atomic.Value
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotQuery.Store(r.URL.RawQuery)
		w.Write([]byte(`{"daily":[]}`))
	}))
	defer srv.Close()

	svc, mr := newTestWeatherService(t, srv.URL)
	defer mr.Close()

	loc := "116.40,39.90"
	if _, err := svc.GetIndices(context.Background(), &loc, nil); err != nil {
		t.Fatalf("GetIndices: %v", err)
	}
	q, _ := gotQuery.Load().(string)
	if !strings.Contains(q, "type=4") {
		t.Errorf("query missing type=4: %q", q)
	}
	if !strings.Contains(q, "location=116.40%2C39.90") {
		t.Errorf("query missing location: %q", q)
	}
}

// ── GetNearbyTSTA ───────────────────────────────────────────────────

func TestWeatherService_GetNearbyTSTA_FirstID(t *testing.T) {
	srv := newCapturingServer(t, &atomic.Int32{}, `{"poi":[{"id":"P9999","name":"X"},{"id":"P8888"}]}`)
	svc, mr := newTestWeatherService(t, srv.URL)
	defer mr.Close()

	info, err := svc.GetNearbyTSTA(context.Background(), "116.40,39.90")
	if err != nil {
		t.Fatalf("GetNearbyTSTA: %v", err)
	}
	if info["id"] != "P9999" {
		t.Errorf("id = %q, want P9999 (first POI)", info["id"])
	}
}

func TestWeatherService_GetNearbyTSTA_EmptyPOI(t *testing.T) {
	srv := newCapturingServer(t, &atomic.Int32{}, `{"poi":[]}`)
	svc, mr := newTestWeatherService(t, srv.URL)
	defer mr.Close()

	info, err := svc.GetNearbyTSTA(context.Background(), "0,0")
	if err != nil {
		t.Fatalf("GetNearbyTSTA: %v", err)
	}
	if len(info) != 0 {
		t.Errorf("expected empty map, got %+v", info)
	}
}

// ── GetFullWeatherData ──────────────────────────────────────────────

// stubUpstream 按 path 分发 mock payload；用于 GetFullWeatherData 的组合测试。
type stubUpstream struct {
	paths map[string]string // path → payload
	hits  map[string]*atomic.Int32
}

func (s *stubUpstream) handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if h, ok := s.hits[r.URL.Path]; ok {
			h.Add(1)
		}
		payload, ok := s.paths[r.URL.Path]
		if !ok {
			http.Error(w, `{"code":"404"}`, http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(payload))
	})
}

func TestWeatherService_GetFullWeatherData_HappyPath(t *testing.T) {
	hits := map[string]*atomic.Int32{
		"/geo/v2/poi/lookup": new(atomic.Int32),
		"/v7/weather/now":    new(atomic.Int32),
		"/v7/weather/24h":    new(atomic.Int32),
		"/v7/weather/3d":     new(atomic.Int32),
		"/v7/ocean/tide":     new(atomic.Int32),
		"/v7/indices/1d":     new(atomic.Int32),
	}
	stub := &stubUpstream{
		paths: map[string]string{
			"/geo/v2/poi/lookup": `{"poi":[{"id":"P2352","name":"港口A"}]}`,
			"/v7/weather/now":    `{"now":{"temp":"25"}}`,
			"/v7/weather/24h":    `{"hourly":[]}`,
			"/v7/weather/3d":     `{"daily":[]}`,
			"/v7/ocean/tide":     `{"tide":[]}`,
			"/v7/indices/1d":     `{"daily":[]}`,
		},
		hits: hits,
	}
	srv := httptest.NewServer(stub.handler())
	defer srv.Close()

	svc, mr := newTestWeatherService(t, srv.URL)
	defer mr.Close()

	out, err := svc.GetFullWeatherData(context.Background(), "116.40,39.90")
	if err != nil {
		t.Fatalf("GetFullWeatherData: %v", err)
	}
	if out == nil {
		t.Fatal("expected non-nil FullWeatherData")
	}
	if out.LocationName != "港口A" {
		t.Errorf("LocationName = %q", out.LocationName)
	}
	if out.POIID != "P2352" {
		t.Errorf("POIID = %q", out.POIID)
	}
	if string(out.Current) != `{"now":{"temp":"25"}}` {
		t.Errorf("Current = %s", out.Current)
	}
	if string(out.Tide) != `{"tide":[]}` {
		t.Errorf("Tide = %s", out.Tide)
	}

	// 5 个 endpoint + 至少一次 POI lookup 都被调用
	// 注意 POI lookup 在 POI 阶段 + 后续 GetNearbyTSTA 阶段会被打两次，
	// 所以单独验证 path 总数 ≥ 5。
	total := int32(0)
	for _, h := range hits {
		total += h.Load()
	}
	if total < 5 {
		t.Errorf("expected ≥5 upstream calls, got %d", total)
	}
}

func TestWeatherService_GetFullWeatherData_NoPOI_ErrUpstream(t *testing.T) {
	stub := &stubUpstream{
		paths: map[string]string{
			"/geo/v2/poi/lookup": `{"poi":[]}`,
		},
		hits: map[string]*atomic.Int32{"/geo/v2/poi/lookup": new(atomic.Int32)},
	}
	srv := httptest.NewServer(stub.handler())
	defer srv.Close()

	svc, mr := newTestWeatherService(t, srv.URL)
	defer mr.Close()

	_, err := svc.GetFullWeatherData(context.Background(), "0,0")
	if !errors.Is(err, ErrUpstream) {
		t.Errorf("expected ErrUpstream, got %v", err)
	}
}

func TestWeatherService_GetFullWeatherData_TSTAFailure_FallsBackToP2352(t *testing.T) {
	hits := map[string]*atomic.Int32{
		"/geo/v2/poi/lookup": new(atomic.Int32),
		"/v7/weather/now":    new(atomic.Int32),
		"/v7/weather/24h":    new(atomic.Int32),
		"/v7/weather/3d":     new(atomic.Int32),
		"/v7/ocean/tide":     new(atomic.Int32),
		"/v7/indices/1d":     new(atomic.Int32),
	}
	stub := &stubUpstream{
		paths: map[string]string{
			// 第一次调用（POI scenic）：返回有效 POI
			// 第二次调用（TSTA 查找）：返回 404 → GetNearbyTSTA 抛 ErrUpstream，
			// GetFullWeatherData 走 fallback → 用 P2352 取潮汐
			"/geo/v2/poi/lookup": ``, // 仅用 hits 计数；handler 内分别处理
			"/v7/weather/now":    `{"now":{}}`,
			"/v7/weather/24h":    `{"hourly":[]}`,
			"/v7/weather/3d":     `{"daily":[]}`,
			"/v7/ocean/tide":     `{"tide":[]}`,
			"/v7/indices/1d":     `{"daily":[]}`,
		},
		hits: hits,
	}
	// 区分两次 POI 调用：第一次 scenic 成功，第二次 TSTA 失败
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits[r.URL.Path].Add(1)
		q := r.URL.Query()
		switch r.URL.Path {
		case "/geo/v2/poi/lookup":
			if q.Get("type") == "TSTA" {
				http.Error(w, `{"code":"404"}`, http.StatusNotFound)
				return
			}
			// scenic 走默认 stub
			if stub.paths[r.URL.Path] != "" {
				w.Write([]byte(stub.paths[r.URL.Path]))
				return
			}
			w.Write([]byte(`{"poi":[{"id":"P7777","name":"主港"}]}`))
		default:
			w.Write([]byte(stub.paths[r.URL.Path]))
		}
	}))
	defer srv.Close()

	svc, mr := newTestWeatherService(t, srv.URL)
	defer mr.Close()

	out, err := svc.GetFullWeatherData(context.Background(), "116.40,39.90")
	if err != nil {
		t.Fatalf("GetFullWeatherData should not fail when TSTA fails: %v", err)
	}
	if out.POIID != "P7777" {
		t.Errorf("POIID = %q, want P7777 (from scenic POI)", out.POIID)
	}
	// 潮汐必须仍被取到（fallback harbor P2352）
	if len(out.Tide) == 0 {
		t.Error("expected tide data via P2352 fallback")
	}
}

// ── FullWeatherData JSON shape ──────────────────────────────────────

func TestFullWeatherData_JSONShape(t *testing.T) {
	out := dto.FullWeatherData{
		Current:      json.RawMessage(`{"now":{}}`),
		Hourly:       json.RawMessage(`{"hourly":[]}`),
		Daily:        json.RawMessage(`{"daily":[]}`),
		Tide:         json.RawMessage(`{"tide":[]}`),
		Indices:      json.RawMessage(`{"daily":[]}`),
		LocationName: "港口A",
		POIID:        "P2352",
	}
	b, err := json.Marshal(out)
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}
	for _, key := range []string{`"current":`, `"hourly":`, `"daily":`, `"tide":`,
		`"indices":`, `"locationName":"港口A"`, `"poiId":"P2352"`} {
		if !strings.Contains(string(b), key) {
			t.Errorf("JSON missing %s: %s", key, b)
		}
	}
}
