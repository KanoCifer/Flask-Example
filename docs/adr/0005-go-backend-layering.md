# ADR 0005: Go Backend Layering

- **Status**: Accepted
- **Date**: 2026-07-26
- **Author**: Kuroome
- **Supersedes**: ADR 0005 (2026-07-09)

## Context

Go 后端 (`go-backend/`) 是对 Python FastAPI 后端 (`backend/`) 的核心功能重构。初始原型采用了 flat 命名和简单的文件组织，随着业务域增长暴露出问题：

1. **Handler-Service 耦合**：handler 直接持有 service 具体 struct，无法 mock 测试
2. **Repository 散落**：Mongo 访问代码散落在 service 中，未按存储分类
3. **组合混乱**：main.go 直接构造所有 service，没有组合根
4. **Context 传递不一致**：部分方法不接收 `context.Context`，trace_id 串联断裂
5. **配置读取散乱**：部分 service 直接读全局 `config.Cfg`

## Decision

### 分层架构

```
handler (internal/handler/)   →   解析输入、HTTP 响应、错误→状态码映射
service (internal/service/)   →   业务编排、多 repository 协调、事务边界
repository                    →   单数据源访问
  ├── internal/repository/mongodb/   — MongoDB 操作
  └── internal/repository/postgres/  — PostgreSQL 操作

document (internal/mongo/document/)  — Mongo document struct 定义
dto (internal/dto/)                  — 入参/出参传输体
domain (internal/domain/)            — 领域错误（《域》/errs/）
pkg/                                 — 可复用工具（jwt, notification）
```

### 1. 双层接口（Xxxer 命名）

每个域有两级接口，命名统一为 **`Xxxer`** 后缀：

- **Service 接口**（供 handler 依赖）- 在 `internal/service/` 的域文件中定义
- **Repository 接口**（供 service 依赖）- 在同一 service 文件中定义，后缀 `XxxRepositoryer`

```go
// service/devtask_service.go
type DevTasker interface {
    Create(ctx context.Context, userID int, req dto.DevTaskCreate) (*dto.DevTaskResponse, error)
    GetBySlug(ctx context.Context, slug string, withParent bool) (*dto.DevTaskResponse, error)
    List(ctx context.Context, filter dto.DevTaskFilter, page, perPage int) (*dto.DevTaskListResponse, error)
    Update(ctx context.Context, slug string, req dto.DevTaskUpdate) error
    SoftDelete(ctx context.Context, slug string) error
    HardDelete(ctx context.Context, slug string) error
    FindFrontier(ctx context.Context, limit int) ([]dto.DevTaskResponse, error)
    // ...
}

type DevTaskRepositoryer interface {
    Create(ctx context.Context, task *document.DevTask) error
    GetBySlug(ctx context.Context, slug string) (*document.DevTask, error)
    List(ctx context.Context, filter mongodb.ListFilter, page, perPage int) ([]document.DevTask, int64, error)
    // ...
}

// handler/devtask_handler.go
type DevTasker interface { // handler 拥有，复制签名实现解耦
    // ...（同上）
}
type DevTaskHandler struct { svc service.DevTasker }
```

Service 接口命名对照：

| Service 域  | 接口名           | Repository 接口名         |
|-------------|------------------|---------------------------|
| User        | `Userer`         | —                         |
| Admin       | `Adminer`        | —                         |
| Blog        | `Bloger`         | —                         |
| DevTask     | `DevTasker`      | `DevTaskRepositoryer`     |
| Moment      | `Momenter`       | `MomentRepositoryer`      |
| Passkey     | `Passkeyer`      | —                         |
| GitHub OAuth| `GitHubOAuther`  | —                         |
| Monitor     | `Monitorer`      | —                         |
| System      | `Systemer`       | —                         |
| WebSocket   | `WSer`           | —                         |
| Fish        | `Fisher`         | —                         |
| Upload      | `Uploader`       | —                         |

### 2. 领域错误

每个域拥有独立的错误包，位于 `internal/domain/<domain>/errs/`：

```
internal/domain/
  devtask/errs/
    errors.go — var ErrTaskNotFound, ErrInvalidSlug
  moment/errs/
    errors.go — var ErrMomentNotFound, ErrInvalidObjectID
  blog/errs/
    errors.go — var ErrInvalidPostID, ErrPostNotFound
```

Handler 通过 `errors.Is` 区分错误种类映射 HTTP 状态码：

```go
switch {
case errors.Is(err, devtaskerrs.ErrTaskNotFound):
    response.APIError(c, err.Error(), http.StatusNotFound)
default:
    // 500
}
```

### 3. ctx 强制线程化

所有 repository 和 service 方法的第一个参数为 `ctx context.Context`。GORM 通过 `.WithContext(ctx)` 传递。禁止 `context.Background()`（仅 main/db 初始化层可例外）。

trace_id 通过 middleware 注入 `context`，由 `internal/logger` 的 `routerHandler` 在 Handle 时自动附带到日志记录。详见 [ADR 0006](0006-logging-orchestration.md)。

### 4. 单一组合根

`internal/app/appstate.go` 的 `NewAppState` 是唯一的 service 组合根：

```go
func NewAppState(
    cfg *config.Config,
    db *gorm.DB,
    mongoDB *mongo.Database,
    redis *redis.Client,
    wa *webauthn.WebAuthn,
) *AppState
```

main.go 只构造基础依赖（db/mongo/redis/webauthn）并传入，不构造业务 service。

AppState 通过 Getter 方法暴露 service 给 handler：

```go
func (a *AppState) DevTaskSvc() service.DevTasker { return a.devTaskSvc }
func (a *AppState) MomentSvc() service.Momenter   { return a.momentSvc }
// ...
```

### 5. Handler 自注册路由

每个 handler 实现 `RegisterRoutes` 方法挂载路由：

```go
func (h *BlogHandler) RegisterRoutes(r *gin.RouterGroup)
func (h *MomentHandler) RegisterRoutes(r *gin.RouterGroup, authMW, adminMW gin.HandlerFunc)
func (h *DevTaskHandler) RegisterRoutes(r *gin.RouterGroup, devTaskMW, authMW, adminMW gin.HandlerFunc)
func (h *WSHandler) RegisterRoutes(r *gin.RouterGroup)
```

- 公开接口（blog、ws）：无需额外 middleware
- 登录写（moment CRUD）：需要 `authMW`
- 管理员接口（moment admin）：需要 `authMW + adminMW`
- 服务间鉴权（devtask）：使用独立 `devTaskMW`（service-JWT），`authMW + adminMW` 仅用于 `/dev-task/token` 端点

### 6. Repository 按存储归属

| package | 内容 | 对应存储 |
|---------|------|----------|
| `internal/repository/mongodb/` | 所有 MongoDB repository（`DevTaskRepository`, `MomentRepo` 等） | MongoDB |
| `internal/repository/postgres/` | 所有 PostgreSQL repository（`UserRepo`, `VisitorRepo` 等） | PostgreSQL |

注意 Repository 注入有两种模式，并存：

- **外部注入**（推荐）：repo 在 `NewAppState` 中构造，通过构造函数传入 service：
  ```go
  userRepo := postgres.NewUserRepo(db)
  userSvc := service.NewUserService(userRepo, redis, cfg.Admin.UserIDs)
  ```
- **内部构造**（Mongo 域采用）：service 构造函数直接收 `*mongo.Database`，内部调用 `mongodb.NewXxxRepo(db)`：
  ```go
  devTaskSvc: service.NewDevTaskService(mongoDB),  // repo 在 service 内创建
  momentSvc:  service.NewMomentService(mongoDB),   // 同上
  ```

两种模式都可接受。外部注入更便于 mock，内部构造减少 appstate boilerplate。**不强制统一**，但代码审查时注意内部构造的 service 应在其构造函数中有明确的 repo 创建调用。

### 7. 文件命名与包布局

```
internal/
  app/appstate.go              — 单一组合根
  config/config.go             — Viper 配置
  dto/                         — DTO 定义（全平铺）
  domain/<domain>/errs/        — 领域错误
  handler/<domain>_handler.go  — handler（全平铺，snake_case）
  logger/logger.go             — slog 初始化 + 路由 + trace_id
  middleware/                  — Gin 中间件（auth, ratelimit, cors, trace 等）
  mongo/document/              — MongoDB document struct（全平铺）
  repository/
    mongodb/<domain>.go        — MongoDB repo
    postgres/<domain>.go       — PostgreSQL repo
  response/                    — 统一响应信封（Success/APIError）
  router/router.go             — Gin 路由总成
  service/<domain>_service.go  — service（全平铺，snake_case）

pkg/
  jwt/                         — JWT 工具（HS256, GenerateServiceToken）
  notification/                — 通知通道（Bark/Feishu/Email）
```

要求：
- 所有 handler/service 文件名用全小写 snake_case，禁止 flat 命名
- 禁止 `internal` 内嵌子领域包（如 `service/devtask/`）—— 所有 service 平铺在 `internal/service/` 下

### 8. DevTask 特有模式

DevTask 域在标准分层之上引入了几项附加模式：

**Slug 标识**：所有外部引用使用 `task-N` 格式的 slug（`task-1`, `task-2`...），而非 Mongo ObjectID。slug 通过 MongoDB `counters` 集合原子自增生成。

**Kind / ParentSlug**：支持 spec-subtask 层次。`kind=spec` 的父任务可被 `devtask-plan` 拆解为多个 `kind=subtask + parent_slug=<spec-slug>` 的子任务。

**FindFrontier**：Agent 任务认领端点，查询 `for_agent=true + status=待排期 + blocked_by=空 + is_deleted=false`。

**双鉴权**：CRUD 端点使用独立 service-JWT（`Authorization: Bearer <service-jwt>`），`/dev-task/token` 端点使用用户 JWT + admin 白名单。

### 9. 响应体

统一使用 `internal/response` 包：

```go
response.Success(c, data, "Task created successfully")
response.APIError(c, err.Error())                // 默认 400
response.APIError(c, err.Error(), http.StatusNotFound) // 自定义
```

## Consequences

Positive:
- 双层接口使 handler 可独立 mock 测试，service 可独立 mock 测试
- 领域错误包 + `errors.Is` 翻译使 handler 的错误→HTTP 映射集中可控
- 自注册路由使 handler 的路由挂载与业务代码同文件，不散落 `router.go`
- AppState 单一组合根让新人一目了然看到全局依赖图
- trace_id 通过 context 传递 + 自动注入，全链排查不需要手拼参数

Negative:
- 接口定义重复（service 和 handler 各定义一份 `Xxxer interface`），修改需同步
- 简单 CRUD 域仍需完整的接口定义 + 领域错误包，boilerplate 较多
- Mongo repo 内部构造（`NewDevTaskService(mongoDB)`）削弱了 repo 层的可 mock 性
- 全平铺的 `internal/service/` + `internal/handler/` 在域数量增长后可能膨胀到数十文件
- service-JWT 和用户 JWT 两套鉴权机制增加理解成本
