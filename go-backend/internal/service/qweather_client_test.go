package service

import (
	"context"
	"crypto/ed25519"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"

	"github.com/KanoCifer/kuroome-blog/internal/config"
	"github.com/KanoCifer/kuroome-blog/internal/infra/httpclient"
	"github.com/KanoCifer/kuroome-blog/internal/logger"
	"github.com/KanoCifer/kuroome-blog/pkg/qweather"
)

const testBaseURL = "http://qweather.test"

const samplePayload = `{"code":"200","now":{"temp":"25"}}`

// ── helpers ──────────────────────────────────────────────────────────

func genTestEd25519(t *testing.T) string {
	t.Helper()
	_, priv, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatalf("GenerateKey: %v", err)
	}
	pkcs8, err := x509.MarshalPKCS8PrivateKey(priv)
	if err != nil {
		t.Fatalf("MarshalPKCS8PrivateKey: %v", err)
	}
	return string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: pkcs8}))
}

func weatherConfigForTest(baseURL string) config.WeatherConfig {
	return config.WeatherConfig{QweatherBaseURL: baseURL}
}

func newTestClient(t *testing.T, srvURL string) (*qweatherClient, *miniredis.Miniredis, func()) {
	t.Helper()

	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("miniredis.Run: %v", err)
	}
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})

	pemStr := genTestEd25519(t)
	signer, err := qweather.NewSigner(pemStr)
	if err != nil {
		t.Fatalf("NewSigner: %v", err)
	}

	httpCli := httpclient.New()
	qwc := newQWeatherClient(httpCli, rdb, srvURL, signer)
	// 固定时钟 → JWT iat/exp 可预期
	qwc.now = func() time.Time { return time.Unix(1_700_000_000, 0) }

	cleanup := func() {
		_ = rdb.Close()
		mr.Close()
	}
	return qwc, mr, cleanup
}

// ── Get ──────────────────────────────────────────────────────────────

func TestQWeatherClient_Get_CacheHit(t *testing.T) {
	var hits int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&hits, 1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(samplePayload))
	}))
	defer srv.Close()

	qwc, mr, cleanup := newTestClient(t, srv.URL)
	defer cleanup()

	ctx := logger.WithTraceID(context.Background(), "trace-1")
	// 预填缓存
	if err := mr.Set("qweather:test:hit", samplePayload); err != nil {
		t.Fatalf("miniredis.Set: %v", err)
	}

	got, err := qwc.Get(ctx, "/v7/weather/now",
		map[string]string{"location": "101010100"},
		"qweather:test:hit", time.Minute)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if string(got) != samplePayload {
		t.Errorf("got %q, want %q", got, samplePayload)
	}
	if atomic.LoadInt32(&hits) != 0 {
		t.Errorf("expected 0 HTTP hits on cache hit, got %d", hits)
	}
}

func TestQWeatherClient_Get_CacheMissFetches(t *testing.T) {
	var (
		hits     int32
		gotAuth  atomic.Value
		gotTrace atomic.Value
	)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&hits, 1)
		gotAuth.Store(r.Header.Get("Authorization"))
		gotTrace.Store(r.Header.Get("X-Trace-Id"))
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(samplePayload))
	}))
	defer srv.Close()

	qwc, mr, cleanup := newTestClient(t, srv.URL)
	defer cleanup()

	ctx := logger.WithTraceID(context.Background(), "trace-abc")
	got, err := qwc.Get(ctx, "/v7/weather/now",
		map[string]string{"location": "101010100", "foo": "bar"},
		"qweather:test:miss", time.Minute)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if string(got) != samplePayload {
		t.Errorf("payload = %q, want %q", got, samplePayload)
	}
	if atomic.LoadInt32(&hits) != 1 {
		t.Errorf("expected 1 HTTP hit, got %d", hits)
	}
	auth, _ := gotAuth.Load().(string)
	if auth == "" || auth[:7] != "Bearer " {
		t.Errorf("missing Bearer auth: %q", auth)
	}
	if got, _ := gotTrace.Load().(string); got != "trace-abc" {
		t.Errorf("trace_id = %q, want %q", got, "trace-abc")
	}

	// 缓存已被写回
	cached, err := mr.Get("qweather:test:miss")
	if err != nil {
		t.Fatalf("miniredis.Get: %v", err)
	}
	if cached != samplePayload {
		t.Errorf("cached = %q, want %q", cached, samplePayload)
	}
}

func TestQWeatherClient_Get_UpstreamError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"code":"500"}`))
	}))
	defer srv.Close()

	qwc, _, cleanup := newTestClient(t, srv.URL)
	defer cleanup()

	_, err := qwc.Get(context.Background(), "/v7/weather/now",
		map[string]string{"location": "1"},
		"qweather:test:500", time.Minute)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !errors.Is(err, ErrUpstream) {
		t.Errorf("expected ErrUpstream, got %v", err)
	}
}

func TestQWeatherClient_Get_NetworkError(t *testing.T) {
	// 构造一个立即关闭的服务端 → 客户端拿到 EOF / 连接错误
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hj, ok := w.(http.Hijacker)
		if !ok {
			t.Fatal("hijacker not supported")
		}
		conn, _, err := hj.Hijack()
		if err != nil {
			t.Fatal(err)
		}
		_ = conn.Close()
	}))
	defer srv.Close()

	qwc, _, cleanup := newTestClient(t, srv.URL)
	defer cleanup()

	_, err := qwc.Get(context.Background(), "/v7/weather/now",
		map[string]string{"location": "1"},
		"qweather:test:net", time.Minute)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !errors.Is(err, ErrUnavailable) {
		t.Errorf("expected ErrUnavailable, got %v", err)
	}
}

func TestQWeatherClient_Get_JWTCached(t *testing.T) {
	var (
		hits int32
		jwts [2]string
	)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		idx := atomic.AddInt32(&hits, 1) - 1
		if idx < 2 {
			jwts[idx] = r.Header.Get("Authorization")
		}
		w.WriteHeader(200)
		_, _ = io.WriteString(w, samplePayload)
	}))
	defer srv.Close()

	qwc, _, cleanup := newTestClient(t, srv.URL)
	defer cleanup()

	ctx := context.Background()
	for i := 0; i < 2; i++ {
		_, err := qwc.Get(ctx, "/v7/weather/now",
			map[string]string{"location": "1"},
			fmt.Sprintf("qweather:test:jwt:%d", i), time.Minute)
		if err != nil {
			t.Fatalf("Get #%d: %v", i, err)
		}
	}

	if atomic.LoadInt32(&hits) != 2 {
		t.Fatalf("expected 2 HTTP hits, got %d", hits)
	}
	// 两次请求应复用同一个 JWT（redis 缓存）
	if jwts[0] == "" || jwts[0] != jwts[1] {
		t.Errorf("JWT not cached across calls: %q vs %q", jwts[0], jwts[1])
	}
}

// ── ResolveLocation ─────────────────────────────────────────────────

func TestQWeatherClient_ResolveLocation(t *testing.T) {
	qwc, _, cleanup := newTestClient(t, testBaseURL)
	defer cleanup()

	t.Run("LocationIDPreferred", func(t *testing.T) {
		loc := "fallback"
		id := "P2352"
		val, params, err := qwc.ResolveLocation(&loc, &id)
		if err != nil {
			t.Fatalf("err: %v", err)
		}
		if val != "P2352" {
			t.Errorf("val = %q, want P2352", val)
		}
		if params["location"] != "P2352" {
			t.Errorf("params.location = %q, want P2352", params["location"])
		}
	})

	t.Run("LocationOnly", func(t *testing.T) {
		loc := "116.40,39.90"
		val, params, err := qwc.ResolveLocation(&loc, nil)
		if err != nil {
			t.Fatalf("err: %v", err)
		}
		if val != "116.40,39.90" {
			t.Errorf("val = %q", val)
		}
		if params["location"] != "116.40,39.90" {
			t.Errorf("params.location = %q", params["location"])
		}
	})

	t.Run("BothNil", func(t *testing.T) {
		_, _, err := qwc.ResolveLocation(nil, nil)
		if !errors.Is(err, ErrInvalidLocation) {
			t.Errorf("expected ErrInvalidLocation, got %v", err)
		}
	})

	t.Run("BothEmpty", func(t *testing.T) {
		empty := ""
		_, _, err := qwc.ResolveLocation(&empty, &empty)
		if !errors.Is(err, ErrInvalidLocation) {
			t.Errorf("expected ErrInvalidLocation, got %v", err)
		}
	})

	t.Run("BothProvided_LocIDWins", func(t *testing.T) {
		loc := "should-be-ignored"
		id := "P9999"
		val, _, err := qwc.ResolveLocation(&loc, &id)
		if err != nil {
			t.Fatalf("err: %v", err)
		}
		if val != "P9999" {
			t.Errorf("locID should win, got val=%q", val)
		}
	})
}

// ── Weatherer integration smoke test ─────────────────────────────────

func TestWeatherService_GetPOI_Roundtrip(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 验证 URL query 含 type=scenic
		if r.URL.Query().Get("type") != "scenic" {
			t.Errorf("expected type=scenic, got %q", r.URL.Query().Get("type"))
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"poi":[{"id":"P2352","name":"测试港"}]}`))
	}))
	defer srv.Close()

	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("miniredis: %v", err)
	}
	defer mr.Close()
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer rdb.Close()

	signer, _ := qweather.NewSigner(genTestEd25519(t))
	svc := NewWeatherService(httpclient.New(), rdb,
		weatherConfigForTest(srv.URL),
		signer)

	data, err := svc.GetPOI(context.Background(), "116.40,39.90")
	if err != nil {
		t.Fatalf("GetPOI: %v", err)
	}

	var got struct {
		POI []struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"poi"`
	}
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("Unmarshal: %v", err)
	}
	if len(got.POI) != 1 || got.POI[0].Name != "测试港" {
		t.Errorf("unexpected payload: %+v", got)
	}
}