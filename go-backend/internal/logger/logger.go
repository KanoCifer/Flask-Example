package logger

import (
	"context"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"

	"github.com/KanoCifer/kuroome-blog/internal/config"
	"gopkg.in/natefinch/lumberjack.v2"
)

const ginSource = "gin"

// Init 初始化全局 slog logger。需在 config.Load() 之后、其他日志调用之前调用。
//
// 路由规则（对齐 Python 端双文件）：
//   - app.log：INFO <= level < ERROR
//   - app_error.log：level >= ERROR
//
// trace_id 由 Context 注入（见 WithTraceID），handler 自动带到输出。
func Init(cfg *config.Config) {
	level := parseLevel(cfg.Server.LogLevel)

	opts := &slog.HandlerOptions{Level: slog.LevelDebug}
	var appHandler, errHandler slog.Handler
	if cfg.Server.ENV == "prod" {
		appWriter := io.MultiWriter(os.Stdout, newLumberjackWriter("logs/app.log"))
		errWriter := io.MultiWriter(os.Stderr, newLumberjackWriter("logs/app_error.log"))

		appHandler = slog.NewJSONHandler(appWriter, opts)
		errHandler = slog.NewJSONHandler(errWriter, opts)
	} else {
		appWriter := io.MultiWriter(os.Stdout, os.Stderr)
		appHandler = slog.NewTextHandler(appWriter, opts)
	}

	router := &routerHandler{appHandler: appHandler, errHandler: errHandler, minLevel: level}
	slog.SetDefault(slog.New(router))
}

func newLumberjackWriter(path string) *lumberjack.Logger {
	_ = os.MkdirAll(filepath.Dir(path), 0o755)
	return &lumberjack.Logger{
		Filename:   path,
		MaxSize:    1,
		MaxBackups: 5,
		MaxAge:     30,
		Compress:   true,
	}
}

func parseLevel(s string) slog.Level {
	switch strings.ToUpper(s) {
	case "DEBUG":
		return slog.LevelDebug
	case "WARN", "WARNING":
		return slog.LevelWarn
	case "ERROR":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

// ── level 路由器 ───────────────────────────────────────────────────────────

// routerHandler 按 level 把记录分发到 app.log / app_error.log，并从 Context 注入 trace_id。
type routerHandler struct {
	// 日志路由器
	appHandler slog.Handler
	errHandler slog.Handler
	minLevel   slog.Leveler
}

func (r *routerHandler) Enabled(ctx context.Context, level slog.Level) bool {
	return level >= r.minLevel.Level()
}

func (r *routerHandler) Handle(ctx context.Context, rec slog.Record) error {
	if id, ok := traceIDFromContext(ctx); ok && id != "" {
		rec.AddAttrs(slog.String("trace_id", id))
	}
	if rec.Level >= slog.LevelError {
		return r.errHandler.Handle(ctx, rec)
	}
	return r.appHandler.Handle(ctx, rec)
}

func (r *routerHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return &routerHandler{
		appHandler: r.appHandler.WithAttrs(attrs),
		errHandler: r.errHandler.WithAttrs(attrs),
		minLevel:   r.minLevel,
	}
}

func (r *routerHandler) WithGroup(name string) slog.Handler {
	return &routerHandler{
		appHandler: r.appHandler.WithGroup(name),
		errHandler: r.errHandler.WithGroup(name),
		minLevel:   r.minLevel,
	}
}

// ── trace_id 上下文 ─────────────────────────────────────────────────────────

type traceIDKey struct{}

// WithTraceID 把 trace_id 写入 context，供 routerHandler 读取。中间件使用。
func WithTraceID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, traceIDKey{}, id)
}

func traceIDFromContext(ctx context.Context) (string, bool) {
	v := ctx.Value(traceIDKey{})
	if v == nil {
		return "", false
	}
	s, ok := v.(string)
	return s, ok
}

// TraceIDFromContext 从 ctx 读取 trace_id。供基础设施层（如 httpclient）
// 在发出出站请求时传播 trace_id 使用。不存在时返回 ("", false)。
func TraceIDFromContext(ctx context.Context) (string, bool) {
	return traceIDFromContext(ctx)
}

// GinLogWriter 适配 io.Writer，把 gin 内部输出桥接为 slog 记录。
// 全仓日志走同一套 JSON / Text handler，不再输出 uvicorn 风格的独立行。
//
// 用法：在 main 中赋值给 gin.DefaultWriter / gin.DefaultErrorWriter。
type GinLogWriter struct{}

func (GinLogWriter) Write(p []byte) (int, error) {
	msg := strings.TrimSpace(string(p))
	if msg != "" {
		slog.Default().Info(msg, "source", ginSource)
	}
	return len(p), nil
}

// ── 测试辅助 ─────────────────────────────────────────────────────────────

// NewTestHandler 构造一个与 Init 行为等价的 slog.Handler：JSON 渲染 +
// trace_id 从 ctx 提取。不写文件、不依赖 Config。供 service / handler
// 单测断言 trace_id 串联时使用，配 slog.SetDefault(slog.New(...))。
func NewTestHandler(w io.Writer, level slog.Level) *slog.Logger {
	opts := &slog.HandlerOptions{Level: level}
	inner := slog.NewJSONHandler(w, opts)
	return slog.New(&routerHandler{
		appHandler: inner,
		errHandler: inner,
		minLevel:   level,
	})
}
