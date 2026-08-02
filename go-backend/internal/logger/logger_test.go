package logger

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"testing"
)

// 验证 routerHandler 输出 schema 与 Python 端对齐：trace_id / level / msg / time 四键。
func TestRouterHandlerSchema(t *testing.T) {
	var appBuf, errBuf bytes.Buffer
	appHandler := slog.NewJSONHandler(&appBuf, &slog.HandlerOptions{Level: slog.LevelDebug})
	errHandler := slog.NewJSONHandler(&errBuf, &slog.HandlerOptions{Level: slog.LevelDebug})

	r := &routerHandler{appHandler: appHandler, errHandler: errHandler, minLevel: slog.LevelInfo}
	log := slog.New(r)

	ctx := WithTraceID(context.Background(), "deadbeef")
	log.InfoContext(ctx, "info message", "key", "value")
	log.ErrorContext(ctx, "error message", "key", "value")

	parseLast := func(b *bytes.Buffer) map[string]any {
		lines := bytes.Split(bytes.TrimSpace(b.Bytes()), []byte("\n"))
		var m map[string]any
		if err := json.Unmarshal(lines[len(lines)-1], &m); err != nil {
			t.Fatalf("unmarshal %q: %v", lines[len(lines)-1], err)
		}
		return m
	}

	// app.log 应收到 info，不应收到 error
	app := parseLast(&appBuf)
	if app["trace_id"] != "deadbeef" {
		t.Errorf("app.log trace_id = %v, want deadbeef", app["trace_id"])
	}
	if app["level"] != "INFO" {
		t.Errorf("app.log level = %v, want INFO", app["level"])
	}
	if app["msg"] != "info message" {
		t.Errorf("app.log msg = %v, want 'info message'", app["msg"])
	}
	if _, ok := app["time"]; !ok {
		t.Errorf("app.log missing time key: %v", app)
	}
	if _, ok := app["key"]; !ok {
		t.Errorf("app.log missing bound extra key 'key': %v", app)
	}

	// appBuf 只有一行（error 不路由到这里）
	if len(bytes.Split(bytes.TrimSpace(appBuf.Bytes()), []byte("\n"))) != 1 {
		t.Errorf("app.log should have exactly 1 record, got:\n%s", appBuf.String())
	}

	// errorBuf 应收到 error
	errLine := parseLast(&errBuf)
	if errLine["level"] != "ERROR" {
		t.Errorf("error.log level = %v, want ERROR", errLine["level"])
	}
	if errLine["trace_id"] != "deadbeef" {
		t.Errorf("error.log trace_id = %v, want deadbeef", errLine["trace_id"])
	}
}

// 验证 trace_id 缺省不输出（没有 panic / 空挂）。
func TestRouterNoTraceID(t *testing.T) {
	var buf bytes.Buffer
	h := slog.NewJSONHandler(&buf, nil)
	r := &routerHandler{appHandler: h, errHandler: h, minLevel: slog.LevelInfo}
	slog.New(r).Info("no ctx trace")

	var m map[string]any
	lines := bytes.Split(bytes.TrimSpace(buf.Bytes()), []byte("\n"))
	if err := json.Unmarshal(lines[0], &m); err != nil {
		t.Fatal(err)
	}
	if _, ok := m["trace_id"]; ok {
		t.Errorf("trace_id should be absent when not in context, got %v", m["trace_id"])
	}
}

// 验证 LogDir 优先级：空字符串=默认 ./logs/；自定义值原样返回。
func TestResolveLogDir(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{"empty_uses_default", "", "./logs"},
		{"custom_passthrough", "/var/log/myapp", "/var/log/myapp"},
		{"relative_custom", "out/logs", "out/logs"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := resolveLogDir(c.in); got != c.want {
				t.Errorf("resolveLogDir(%q) = %q, want %q", c.in, got, c.want)
			}
		})
	}
}
