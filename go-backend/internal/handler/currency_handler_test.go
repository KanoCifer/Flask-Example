package handler

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/KanoCifer/kuroome-blog/internal/dto"
	"github.com/KanoCifer/kuroome-blog/internal/service"
)

// ── mock Currencyer ──────────────────────────────────────────────────

type mockCurrencyService struct {
	getExchangeFn func(ctx context.Context, baseCurrency string) (*dto.ExchangeResponse, error)
}

var _ service.Currencyer = (*mockCurrencyService)(nil)

func (m *mockCurrencyService) GetExchange(ctx context.Context, baseCurrency string) (*dto.ExchangeResponse, error) {
	if m.getExchangeFn != nil {
		return m.getExchangeFn(ctx, baseCurrency)
	}
	return nil, nil
}

// ── helpers ─────────────────────────────────────────────────────────

// newCurrencyRouter 构造一个独立的 gin 引擎并挂载 currency 路由。
func newCurrencyRouter(svc service.Currencyer) *gin.Engine {
	h := NewCurrencyHandler(svc)
	r := gin.New()
	g := r.Group("/v3")
	h.RegisterRoutes(g)
	return r
}

// ── GetExchangeRate ─────────────────────────────────────────────────

func TestCurrencyHandler_GetExchangeRate_HappyPath(t *testing.T) {
	var gotBase string
	svc := &mockCurrencyService{
		getExchangeFn: func(_ context.Context, baseCurrency string) (*dto.ExchangeResponse, error) {
			gotBase = baseCurrency
			return &dto.ExchangeResponse{
				TimeStamp: 1_700_000_000,
				Base:      "USD",
				Rates:     map[string]float64{"CNY": 7.2, "JPY": 150.0},
			}, nil
		},
	}

	w := doGET(newCurrencyRouter(svc), "/v3/currency?base=USD")

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", w.Code, w.Body.String())
	}
	if gotBase != "USD" {
		t.Errorf("base passed to svc = %q, want USD", gotBase)
	}

	resp := decodeResponse(t, w.Body.Bytes())
	if resp.Message != "汇率获取成功" {
		t.Errorf("message = %q, want 汇率获取成功", resp.Message)
	}

	data, ok := resp.Data.(map[string]any)
	if !ok {
		t.Fatalf("data type = %T, want object", resp.Data)
	}
	if data["base"] != "USD" {
		t.Errorf("data.base = %v, want USD", data["base"])
	}
	if data["timestamp"] != float64(1_700_000_000) {
		t.Errorf("data.timestamp = %v, want %d", data["timestamp"], 1_700_000_000)
	}
	rates, ok := data["rates"].(map[string]any)
	if !ok {
		t.Fatalf("data.rates type = %T, want object", data["rates"])
	}
	if rates["CNY"] != float64(7.2) {
		t.Errorf("rates.CNY = %v, want 7.2", rates["CNY"])
	}
}

func TestCurrencyHandler_GetExchangeRate_MissingBase_400(t *testing.T) {
	called := false
	svc := &mockCurrencyService{
		getExchangeFn: func(context.Context, string) (*dto.ExchangeResponse, error) {
			called = true
			return nil, nil
		},
	}

	w := doGET(newCurrencyRouter(svc), "/v3/currency")

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body=%s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "Need Base Currency") {
		t.Errorf("body = %s", w.Body.String())
	}
	if called {
		t.Error("svc.GetExchange should not be called when base is missing")
	}
}

func TestCurrencyHandler_GetExchangeRate_ServiceError_500(t *testing.T) {
	svc := &mockCurrencyService{
		getExchangeFn: func(context.Context, string) (*dto.ExchangeResponse, error) {
			return nil, errors.New("upstream boom")
		},
	}

	w := doGET(newCurrencyRouter(svc), "/v3/currency?base=USD")

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500; body=%s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "upstream boom") {
		t.Errorf("body = %s", w.Body.String())
	}
}

// ── RegisterRoutes ──────────────────────────────────────────────────

func TestCurrencyHandler_RegisterRoutes_Reachable(t *testing.T) {
	r := newCurrencyRouter(&mockCurrencyService{
		getExchangeFn: func(context.Context, string) (*dto.ExchangeResponse, error) {
			return &dto.ExchangeResponse{}, nil
		},
	})

	w := doGET(r, "/v3/currency?base=USD")
	if w.Code != http.StatusOK {
		t.Errorf("currency: status = %d, want 200; body=%s", w.Code, w.Body.String())
	}

	// 未注册路径应 404
	w = doGET(r, "/v3/currency/unknown")
	if w.Code != http.StatusNotFound {
		t.Errorf("unknown path: status = %d, want 404", w.Code)
	}
}
