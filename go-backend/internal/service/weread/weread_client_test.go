package weread_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"

	"github.com/KanoCifer/kuroome-blog/internal/infra/httpclient"
	"github.com/KanoCifer/kuroome-blog/internal/service/weread"
)

// ── fixtures ─────────────────────────────────────────────────────────

const sampleShelfPayload = `{
	"books": [
		{
			"bookId": "abc123",
			"title": "三体",
			"author": "刘慈欣",
			"cover": "http://example.com/cover.jpg",
			"category": "科幻",
			"readUpdateTime": 1700000000,
			"updateTime": 1700000001,
			"finishReading": true,
			"secret": false,
			"isTop": true
		}
	],
	"archives": [
		{
			"archiveId": "arc1",
			"name": "我的书单",
			"bookIds": ["abc123"],
			"albumIds": []
		}
	]
}`

// mockRepository 实现 weread.Repositoryer，返回固定 token。
type mockRepository struct {
	token     string
	err       error
	createErr error
}

func (m *mockRepository) GetUserToken(_ context.Context, _ string) (string, error) {
	return m.token, m.err
}

func (m *mockRepository) CreateUserToken(_ context.Context, _ string, _ string) error {
	return m.createErr
}

// newTestClient 构造一个指向测试服务器的 Client。
func newTestClient(t *testing.T, repo weread.Repositoryer) (*weread.Client, *miniredis.Miniredis, func()) {
	t.Helper()

	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("miniredis.Run: %v", err)
	}
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(sampleShelfPayload))
	}))

	cli := weread.NewClient(httpclient.New(), rdb, repo, weread.WithBaseURL(srv.URL))

	cleanup := func() {
		srv.Close()
		_ = rdb.Close()
		mr.Close()
	}
	return cli, mr, cleanup
}

// ── BuildPayload ─────────────────────────────────────────────────────

func TestClient_BuildPayload(t *testing.T) {
	cli, _, cleanup := newTestClient(t, &mockRepository{token: "test-token"})
	defer cleanup()

	payload, header := cli.BuildPayload(context.Background(), "user-1", "/shelf/sync",
		map[string]any{"extra": "value"})

	if payload["api_name"] != "/shelf/sync" {
		t.Errorf("api_name = %q, want /shelf/sync", payload["api_name"])
	}
	if payload["skill_version"] != "1.0.3" {
		t.Errorf("skill_version = %q, want 1.0.3", payload["skill_version"])
	}
	if payload["extra"] != "value" {
		t.Errorf("extra = %v, want value", payload["extra"])
	}
	if header["Authorization"] != "Bearer test-token" {
		t.Errorf("Authorization = %q, want Bearer test-token", header["Authorization"])
	}
	if header["Content-Type"] != "application/json" {
		t.Errorf("Content-Type = %q, want application/json", header["Content-Type"])
	}
}

func TestClient_BuildPayload_RepoError(t *testing.T) {
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("miniredis: %v", err)
	}
	defer mr.Close()
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer rdb.Close()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		_, _ = w.Write([]byte(`{}`))
	}))
	defer srv.Close()

	repo := &mockRepository{err: errors.New("db down")}
	cli := weread.NewClient(httpclient.New(), rdb, repo, weread.WithBaseURL(srv.URL))

	// repo 出错时 token 为空字符串，BuildPayload 不返回错误
	_, header := cli.BuildPayload(context.Background(), "user-1", "/shelf/sync")
	if header["Authorization"] != "Bearer " {
		t.Errorf("Authorization = %q, want Bearer (empty token)", header["Authorization"])
	}
}

// ── SendRequest ──────────────────────────────────────────────────────

func TestClient_SendRequest_CacheHit(t *testing.T) {
	cli, mr, cleanup := newTestClient(t, &mockRepository{token: "t"})
	defer cleanup()

	ctx := context.Background()
	cacheKey := "weread:test:hit"
	if err := mr.Set(cacheKey, sampleShelfPayload); err != nil {
		t.Fatalf("miniredis.Set: %v", err)
	}

	// 缓存命中时不会发 HTTP 请求
	got, err := cli.SendRequest(ctx, cacheKey, time.Minute, "user-1", "/shelf/sync")
	if err != nil {
		t.Fatalf("SendRequest: %v", err)
	}
	if string(got) != sampleShelfPayload {
		t.Errorf("got %q, want %q", got, sampleShelfPayload)
	}
}

func TestClient_SendRequest_CacheMissFetches(t *testing.T) {
	var hits atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		// 验证鉴权头
		if auth := r.Header.Get("Authorization"); auth != "Bearer test-token" {
			t.Errorf("Authorization = %q, want Bearer test-token", auth)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(sampleShelfPayload))
	}))
	defer srv.Close()

	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("miniredis: %v", err)
	}
	defer mr.Close()
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer rdb.Close()

	cli := weread.NewClient(httpclient.New(), rdb, &mockRepository{token: "test-token"}, weread.WithBaseURL(srv.URL))

	ctx := context.Background()
	got, err := cli.SendRequest(ctx, "weread:test:miss", time.Minute, "user-1", "/shelf/sync")
	if err != nil {
		t.Fatalf("SendRequest: %v", err)
	}
	if string(got) != sampleShelfPayload {
		t.Errorf("payload = %q, want %q", got, sampleShelfPayload)
	}
	if hits.Load() != 1 {
		t.Errorf("expected 1 HTTP hit, got %d", hits.Load())
	}

	// 缓存已被写回（异步写入，等待一小段时间）
	requireCacheWrite(t, mr, "weread:test:miss", sampleShelfPayload)
}

// requireCacheWrite 等待异步缓存写入完成。
func requireCacheWrite(t *testing.T, mr *miniredis.Miniredis, key, want string) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		cached, err := mr.Get(key)
		if err == nil && cached == want {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("cache write not observed for key %q within timeout", key)
}

func TestClient_SendRequest_Unauthorized(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":"unauthorized"}`))
	}))
	defer srv.Close()

	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("miniredis: %v", err)
	}
	defer mr.Close()
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer rdb.Close()

	cli := weread.NewClient(httpclient.New(), rdb, &mockRepository{token: "bad"}, weread.WithBaseURL(srv.URL))

	_, err = cli.SendRequest(context.Background(), "weread:test:401", time.Minute, "user-1", "/shelf/sync")
	if !errors.Is(err, weread.ErrUnauthorized) {
		t.Errorf("expected ErrUnauthorized, got %v", err)
	}
}

func TestClient_SendRequest_UpstreamError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"code":"500"}`))
	}))
	defer srv.Close()

	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("miniredis: %v", err)
	}
	defer mr.Close()
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer rdb.Close()

	cli := weread.NewClient(httpclient.New(), rdb, &mockRepository{token: "t"}, weread.WithBaseURL(srv.URL))

	_, err = cli.SendRequest(context.Background(), "weread:test:500", time.Minute, "user-1", "/shelf/sync")
	if !errors.Is(err, weread.ErrUpstream) {
		t.Errorf("expected ErrUpstream, got %v", err)
	}
}

func TestClient_SendRequest_NetworkError(t *testing.T) {
	// 构造一个立即关闭的服务端 → 客户端拿到连接错误
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

	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("miniredis: %v", err)
	}
	defer mr.Close()
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer rdb.Close()

	cli := weread.NewClient(httpclient.New(), rdb, &mockRepository{token: "t"}, weread.WithBaseURL(srv.URL))

	_, err = cli.SendRequest(context.Background(), "weread:test:net", time.Minute, "user-1", "/shelf/sync")
	if !errors.Is(err, weread.ErrUpstream) {
		t.Errorf("expected ErrUpstream on network error, got %v", err)
	}
}

// ── 错误类型断言 ─────────────────────────────────────────────────────

func TestClient_ErrorsAreSentinels(t *testing.T) {
	if !errors.Is(weread.ErrUpstream, weread.ErrUpstream) {
		t.Error("ErrUpstream identity broken")
	}
	if !errors.Is(weread.ErrUnauthorized, weread.ErrUnauthorized) {
		t.Error("ErrUnauthorized identity broken")
	}
	if errors.Is(weread.ErrUpstream, weread.ErrUnauthorized) {
		t.Error("ErrUpstream should not be ErrUnauthorized")
	}
}

// ── JSON 序列化兼容性 ────────────────────────────────────────────────

func TestClient_ShelfPayloadShape(t *testing.T) {
	var resp struct {
		Books []struct {
			BookId string `json:"bookId"`
			Title  string `json:"title"`
		} `json:"books"`
		Archives []struct {
			ArchiveId string `json:"archiveId"`
			Name      string `json:"name"`
		} `json:"archives"`
	}
	if err := json.Unmarshal([]byte(sampleShelfPayload), &resp); err != nil {
		t.Fatalf("Unmarshal: %v", err)
	}
	if len(resp.Books) != 1 || resp.Books[0].BookId != "abc123" {
		t.Errorf("books parsed incorrectly: %+v", resp.Books)
	}
	if len(resp.Archives) != 1 || resp.Archives[0].Name != "我的书单" {
		t.Errorf("archives parsed incorrectly: %+v", resp.Archives)
	}
}
