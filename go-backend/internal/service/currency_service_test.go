package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"

	"github.com/KanoCifer/kuroome-blog/internal/infra/httpclient"
)

// ── shared fixtures ─────────────────────────────────────────────────

// newTestCurrencyClient 构造一个指向 srvURL 的 CurrencyClient（redis 可 nil）。
func newTestCurrencyClient(t *testing.T, srvURL string, rdb *redis.Client) *CurrencyClient {
	t.Helper()
	return NewCurrencyClient(httpclient.New(), rdb, WithBaseURL(srvURL))
}

func newMiniredis(t *testing.T) (*redis.Client, *miniredis.Miniredis) {
	t.Helper()
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("miniredis.Run: %v", err)
	}
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { mr.Close() })
	return rdb, mr
}

// currencyStatusServer 返回一个固定状态码的测试服务端。
func currencyStatusServer(t *testing.T, status int) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(status)
	}))
	t.Cleanup(srv.Close)
	return srv
}

const currencySample = `{"timestamp":1700000000,"base":"USD","rates":{"CNY":7.2}}`

// ── CurrencyService.GetExchange（缓存 + 反序列化）────────────────────

func TestCurrencyService_GetExchange_CacheHit_NoUpstream(t *testing.T) {
	rdb, mr := newMiniredis(t)
	srvHits := atomic.Int32{}
	srv := newCapturingServer(t, &srvHits, currencySample)

	cli := newTestCurrencyClient(t, srv.URL, rdb)
	svc := &CurrencyService{cli: cli}

	// 预置缓存：key 为 currency:{base}:{YYYY/MM/DD}
	if err := mr.Set("currency:USD:2026/08/07", currencySample); err != nil {
		t.Fatalf("miniredis.Set: %v", err)
	}

	res, err := svc.GetExchange(context.Background(), "USD")
	if err != nil {
		t.Fatalf("GetExchange: %v", err)
	}
	if res.Base != "USD" || res.Rates["CNY"] != 7.2 {
		t.Errorf("res = %+v, want base=USD rates.CNY=7.2", res)
	}
	if srvHits.Load() != 0 {
		t.Errorf("expected 0 upstream calls, got %d", srvHits.Load())
	}
}

func TestCurrencyService_GetExchange_CacheMiss_FetchesAndWritesBack(t *testing.T) {
	rdb, mr := newMiniredis(t)
	srvHits := atomic.Int32{}
	srv := newCapturingServer(t, &srvHits, currencySample)

	cli := newTestCurrencyClient(t, srv.URL, rdb)
	svc := &CurrencyService{cli: cli}

	res, err := svc.GetExchange(context.Background(), "USD")
	if err != nil {
		t.Fatalf("GetExchange: %v", err)
	}
	if res.Base != "USD" || res.Rates["CNY"] != 7.2 {
		t.Errorf("res = %+v, want base=USD rates.CNY=7.2", res)
	}
	if srvHits.Load() != 1 {
		t.Errorf("expected 1 upstream call, got %d", srvHits.Load())
	}

	// 异步写回缓存：轮询等待落盘
	waitForCache(t, mr, "currency:USD:2026/08/07", currencySample)
}

func TestCurrencyService_GetExchange_InvalidJSON(t *testing.T) {
	rdb, _ := newMiniredis(t)
	srvHits := atomic.Int32{}
	srv := newCapturingServer(t, &srvHits, `not-json`)

	cli := newTestCurrencyClient(t, srv.URL, rdb)
	svc := &CurrencyService{cli: cli}

	_, err := svc.GetExchange(context.Background(), "USD")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !strings.Contains(err.Error(), "json unmarshal failed") {
		t.Errorf("err = %v, want unmarshal wrapping", err)
	}
}

// ── CurrencyClient.GetExchange（HTTP 层）─────────────────────────────

func TestCurrencyClient_GetExchange_CacheHit_NoUpstream(t *testing.T) {
	rdb, mr := newMiniredis(t)
	srvHits := atomic.Int32{}
	srv := newCapturingServer(t, &srvHits, currencySample)

	cli := newTestCurrencyClient(t, srv.URL, rdb)
	if err := mr.Set("currency:USD:2026/08/07", currencySample); err != nil {
		t.Fatalf("miniredis.Set: %v", err)
	}

	raw, err := cli.GetExchange(context.Background(), "USD", "currency:USD:2026/08/07", time.Hour)
	if err != nil {
		t.Fatalf("GetExchange: %v", err)
	}
	if string(raw) != currencySample {
		t.Errorf("raw = %q, want %q", raw, currencySample)
	}
	if srvHits.Load() != 0 {
		t.Errorf("expected 0 upstream calls, got %d", srvHits.Load())
	}
}

func TestCurrencyClient_GetExchange_UpstreamError(t *testing.T) {
	rdb, _ := newMiniredis(t)
	srv := currencyStatusServer(t, 404)

	cli := newTestCurrencyClient(t, srv.URL, rdb)

	_, err := cli.GetExchange(context.Background(), "USD", "currency:USD:2026/08/07", time.Hour)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !strings.Contains(err.Error(), "status=404") {
		t.Errorf("err = %v, want status=404", err)
	}
}

func TestCurrencyClient_GetExchange_NoRedis_SkipsCache(t *testing.T) {
	srvHits := atomic.Int32{}
	srv := newCapturingServer(t, &srvHits, currencySample)

	cli := newTestCurrencyClient(t, srv.URL, nil)

	raw, err := cli.GetExchange(context.Background(), "USD", "currency:USD:2026/08/07", time.Hour)
	if err != nil {
		t.Fatalf("GetExchange: %v", err)
	}
	if string(raw) != currencySample {
		t.Errorf("raw = %q, want %q", raw, currencySample)
	}
	if srvHits.Load() != 1 {
		t.Errorf("expected 1 upstream call, got %d", srvHits.Load())
	}
}
