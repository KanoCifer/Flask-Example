package httpclient

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/KanoCifer/kuroome-blog/internal/logger"
)

// TestClient_PropagatesTraceID 验证 Do 会把 ctx 中的 trace_id 写入
// X-Trace-Id 请求头。
func TestClient_PropagatesTraceID(t *testing.T) {
	var gotTraceID string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotTraceID = r.Header.Get("X-Trace-Id")
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	traceID := "test-trace-abc"
	ctx := logger.WithTraceID(context.Background(), traceID)

	cli := New()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, srv.URL, nil)
	if err != nil {
		t.Fatalf("build request: %v", err)
	}

	resp, err := cli.Do(ctx, req)
	if err != nil {
		t.Fatalf("Do: %v", err)
	}
	defer resp.Body.Close()

	if gotTraceID != traceID {
		t.Errorf("X-Trace-Id = %q, want %q", gotTraceID, traceID)
	}
}

// TestClient_NoTraceID 验证 ctx 中没有 trace_id 时不注入该头。
func TestClient_NoTraceID(t *testing.T) {
	var gotTraceID string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotTraceID = r.Header.Get("X-Trace-Id")
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	cli := New()
	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, srv.URL, nil)
	if err != nil {
		t.Fatalf("build request: %v", err)
	}

	resp, err := cli.Do(context.Background(), req)
	if err != nil {
		t.Fatalf("Do: %v", err)
	}
	defer resp.Body.Close()

	if gotTraceID != "" {
		t.Errorf("X-Trace-Id = %q, want empty", gotTraceID)
	}
}

// TestClient_LogsStatusAndLatency 验证 Do 能正常返回响应并记录状态码。
func TestClient_LogsStatusAndLatency(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
	}))
	defer srv.Close()

	cli := New(WithTimeout(5 * time.Second))
	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, srv.URL, nil)
	if err != nil {
		t.Fatalf("build request: %v", err)
	}

	resp, err := cli.Do(context.Background(), req)
	if err != nil {
		t.Fatalf("Do: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Errorf("status = %d, want %d", resp.StatusCode, http.StatusCreated)
	}
}

// TestClient_ErrorLogsOnFailure 验证请求失败时 Do 返回错误（由调用方处理）。
func TestClient_ErrorLogsOnFailure(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	// 立即关闭，使下一个请求失败。
	srv.Close()

	cli := New(WithTimeout(500 * time.Millisecond))
	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, srv.URL, nil)
	if err != nil {
		t.Fatalf("build request: %v", err)
	}

	resp, err := cli.Do(context.Background(), req)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if resp != nil {
		_, _ = io.ReadAll(resp.Body)
		resp.Body.Close()
	}
}
