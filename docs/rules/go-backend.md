# Go Backend (`go-backend/`)

Python `backend/` 的 Go 重构（核心功能已实现，持续完善中）。路由前缀 `/api/v3/*`，运行于 `127.0.0.1:5555`。

## 运行 & 测试

命令速查见 [commands.md](commands.md)。`go test ./...` 覆盖 handler/service/dto/middleware/jwt（含 admin 端）。

## 框架 & 分层

- **框架**：Gin + SQL 直连(PostgreSQL) + MongoDB driver(v2) + go-redis(v9)；JWT HS256 + bcrypt；配置用 Viper + 环境变量
- **分层**：`handler → service → repository → model`，响应统一包 `internal/response/`（`Success` / `APIError` 封装 `{data, message}` 信封）
- **解耦**：handler 通过接口（`UserService` / `AdminService`）依赖 service，便于 mock 测试
- **包布局**：`internal/{app,config,db,dto,errs,handler,logger,middleware,model,mongo,repository,response,router,service}`；`pkg/jwt`（JWT 工具）；`pkg/notification/`（通知通道）
- **命名对齐**：复用 Python 后端的 `.env`（`DATABASE_URL / SECRET_KEY / REDIS_URL / MONGO_URI / PORT` 等）
- **配置注入**：所有 service/handler 通过构造函数接收配置，禁止直接读取全局 `config.Cfg`
- **日志**：`internal/logger/` 基于 `log/slog`，双文件路由（app_info / app_error）+ trace_id 注入 + lumberjack 轮转

## 分层约定（2026-07 统一后）

> 分层决策背景见 [ADR 0005](../adr/0005-go-backend-layering.md)。

所有 service 域已统一为以下约定（详见 task-13 spec）：

### 双层接口

- **service 文件**：定义 `XRepository interface`（同文件），供 service struct 持有；定义 `XService interface`（供 handler 依赖）
- **handler 文件**：定义 `XService interface`（handler 拥有），持有该接口而非 concrete struct
- 便于独立 mock 测试

```go
// service/user_service.go
type UserRepository interface { ... }   // service 拥有
type UserService interface { ... }      // handler 依赖
type userService struct { repo UserRepository }
func NewUserService(repo UserRepository, ...) *userService { return &userService{repo: repo} }

// handler/user_handler.go
type UserService interface { ... }   // handler 拥有（复用签名，解耦）
type UserHandler struct { svc UserService }
```

### ctx 强制线程化

- 所有 repo + service 方法第一个参数 `ctx context.Context`，GORM 用 `.WithContext(ctx)`
- 禁止 `context.Background()`（只有 main/db 初始化层的 infra 代码可以例外）

### 单一组合根

- `appstate.go` 的 `NewAppState` 是唯一的 service 组合根
- `main.go` 只构造基础依赖（db/mongo/redis/webauthn），不构造任何业务 service
- 业务 service 全部在 `NewAppState` 内构造

### 文件命名

- handler: `*_handler.go`、service: `*_service.go` — 全小写 snake_case
- 无 flat 命名（如旧 `admin.go`、`user.go`）

### 十条判定规则

| #   | 规则                | 判定                                                                                        |
| --- | ------------------- | ------------------------------------------------------------------------------------------- |
| 1   | 双层接口            | `grep "type.*Repository interface" service/*.go` 每个 service 文件都有                      |
| 2   | ctx 强制            | `grep -rn "context.Background()" internal/` → 0（测试除外）                                 |
| 3   | 构造全收回 appstate | main.go 无 `service.NewXxx`                                                                 |
| 4   | 文件命名 snake_case | 无 flat 命名残留                                                                            |
| 5   | repo 外部注入       | service 无 `mongodb.NewXxx(db)` 内嵌                                                        |
| 6   | errors.Is 分流      | handler 用 `errors.Is(err, errs.ErrX)` 分 404/400/500                                       |
| 7   | config 注入         | 无 `config.Cfg` 在 handler/service 非注释代码                                               |
| 8   | DTO 命名统一        | 入参 `XRequest`/出参 `XResponse`（目标态；当前仍残留 `PostIn`/`PostOut`/`XOut` 等，待清理） |
| 9   | 重复代码清除        | 无 `PaginationOut`；cookie helpers 仅 github_handler.go 一份                                |
| 10  | repo 包归属正确     | Mongo repo 在 `package mongodb`                                                             |

## 鉴权

认证统一契约见 **[auth.md](auth.md)**。Go 端要点:

- JWT: `pkg/jwt`, HS256, RegisteredClaims(sub/exp/jti)
- Refresh 白名单: `refresh:{uid}` 于 Redis,单设备轮换
- Admin: `ADMIN_USER_IDS` 白名单;AdminMiddleware 必须在 AuthMiddleware 之后
- 注册校验 Redis `signup_code:{email}`;非法 admin post id 返回 400

## 通知通道

`pkg/notification/` 实现 Bark / Feishu / Email 三种通道，由 `plugin.go` 统一注册。发送走异步队列，失败不阻塞主流程。

## 中间件

- `middleware/auth.go` — JWT 校验（`Authorization: Bearer`）
- `middleware/ratelimit.go` — Redis 滑动窗口限速，key `rl:{scope}:{ip}`，超限返回 429 + `Retry-After`
- `middleware/cors.go` — CORS（白名单由 `AMAP_KEY_ALLOWED_ORIGINS` 等配置控制）
- `middleware/slog.go` — Gin 官方推荐的 slog access log 中间件（`method/path/status/latency/trace_id` 单行结构化输出），替代 gin 默认 plaintext Logger
- `middleware/trace.go` — trace_id 注入，Slog 中间件读取同一值保证 access log 与 handler 日志串联
- `middleware/duration.go` — 请求起始时间，供 response 层写 `X-Process-Time` 头

## GitHub OAuth

`handler/github.go` + `service/github.go` 实现 GitHub 登录/绑定/解绑，需 `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `GITHUB_REDIRECT_URI`。
