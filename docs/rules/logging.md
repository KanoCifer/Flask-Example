# Logging Rules

日志系统的编排规约（Python 后端）。配套完整英文方案见 [docs/rules/logging-plan.md](logging-plan.md)。

> **Go 端**：Go 后端使用独立日志包 `internal/logger/`（Go 标准库 `log/slog`，双文件路由 + trace_id + lumberjack 轮转），不经过 structlog。本规约第 1–9 节仅适用于 Python `backend/`。

## 1. 单一来源

- 全仓库日志统一走 `structlog`（`from app.core.logger import logger`），输出 JSON。
- structlog 经 `wrap_for_formatter` 把事件交回 stdlib `logging`，由 `ProcessorFormatter` 统一渲染：业务日志与 uvicorn / taskiq / sqlalchemy 等 foreign 记录走**同一条**处理器链、同一套 JSON 长相。foreign logger（`uvicorn.*` / `taskiq` / `sqlalchemy.engine`）清掉自带 handler、开 `propagate` 透传到 root，**禁止**各框架各自向 stderr 输出第二套格式。
- 终端在 TTY 下用 `ConsoleRenderer`（dev 可读），非 TTY 与文件统一 `JSONRenderer`。
- 禁止 `import logging` 后直接用 stdlib 根 logger 打业务日志；业务日志只用 `structlog` 的 `logger`。
- 日志级别由 `LOG_LEVEL` 环境变量控制（默认 INFO）；DB 入库阈值固定为 `WARNING+`（warning / error / critical），按 level 名字集合判定（`_LEVELS_FOR_DB`），不再暴露为运行时配置——保持输出 schema 四键精简。

## 2. 双文件路由

日志**按噪音来源分文件**，不按模块/领域分。一次操作横跨多模块时，靠 `trace_id` grep 串联，而非开多个文件对时间戳。

| 文件            | 内容       | 级别   | 来源              |
| --------------- | ---------- | ------ | ----------------- |
| `app_info.log`  | 业务主轨迹 | INFO+  | service / task 层 |
| `app_error.log` | 异常与错误 | ERROR+ | 任何层            |

- 不按 `user` / `article` / `rss` 等领域分文件。跨域调用（如 rss → cache → notify）的日志切不干净，分文件只会让一次排查散落多文件。
- 两个文件仅在 `SAVE_LOGS=True` 时启用（受 `LOG_PATH` / `LOG_DIR` 控制路径）；终端（stderr）始终输出。
- `uvicorn.access` 的自带 handler 被清掉后回传播到 root，进入 `app_info.log`——不再单独剥离 access 轨迹。

## 3. 结构化——message 给人，extra 给机器

- `message` 是**纯英文描述**，不含数值、不含前缀、不含 emoji。
- 数值、计数、耗时写进 `logger.bind(...)` 的 extra，**不要手拼字符串**。

```python
# ❌ 禁止：手拼结构化串、带前缀、带 emoji
logger.info("[MigrationJob] ✅ Completed | duration=4.57s | fetched=9 | migrated=9")

# ✅ 推荐
logger.bind(job="migration", duration=4.57, fetched=9, migrated=9).info("migration completed")
```

- 格式模板里会带上 extra 字段，终端能看到、DB 持久化时整列写入 JSON。structlog 下 extra 即 event_dict 的键值，`JSONRenderer` 原样输出。
- 内部日志**清掉 emoji**（✅❌⚠️📈）。level 本身就是信号，不靠图标。emoji 只在「发给人的外部通知文案」（飞书、Bark、邮件正文）里保留——那本来就是富文本。

## 4. 前缀收口成 bind 字段

`[Taskiq]` / `[Feishu]` / `[SubscriptionCheck]` 这类前缀不写进 message，改用 `bind`：

```python
# ❌
logger.warning("[Feishu] FEISHU_WEBHOOK_URL not configured, skip")

# ✅
logger.bind(channel="feishu").warning("webhook url not configured, skip")
```

下游 sink 按 `record["extra"]["channel"]` 等字段路由或过滤。

## 5. Layer——service 记业务事件，handler 记边界失败

业务日志按"语义"分层，不按"数据操作"分层。**INFO/WARN 在 service，WARN/ERROR 在 handler**，repo 默认不打。

| 层                 | 该记                                                                 | 不该记                                       |
| ------------------ | -------------------------------------------------------------------- | -------------------------------------------- |
| **service / task** | 业务动作的**完成**（INFO：user login、post created、passkey registered）+ 软失败/降级（WARN：内部 lookup 失败但不阻塞返回） | 来自 repo 的 ERROR——错误上抛，由 handler 在边界记 |
| **handler**        | 边界决策：**WARN**（4xx：参数错、鉴权失败、资源不存在）+ **ERROR**（5xx：内部错误、repo 错误上抛） | 业务 INFO——成功动作移到 service |
| **repo**           | 容错决策（重试/兜底）、吞异常留痕（warning）                          | INSERT/SELECT 等数据操作、把异常细节重复一遍 |

- "用户登录成功"由 service 记 INFO（"这是登录业务事件"），"登录校验失败 / repo 报错"由 handler 记 WARN/ERROR（"这是给客户端的边界响应"）。
- service **不记** repo 失败的 ERROR——错误上抛给 handler 在边界统一记。重复记录同一 err 既不增加信息又稀释 trace_id 关联。
- service **可以**记 WARN：场景是 service 自己吞掉了一个内部异常（例如"父任务找不到、仍返回子任务"），handler 看不见这个细节，service 留痕。
- "迁移提交成功"记在 task/service 层（那里才有业务语境：这是"迁移"还是"用户注册" repo 不知道）。
- repo 是实现细节，可换 ORM；日志绑死在 repo 层会跟着 SQL 翻译走，丢失业务语义。
- 异常**记录责任在调用方**：repo 透传数据访问，commit 失败抛出，由 handler 决定记什么（不 re-raise 时由 service 记 WARN）。
- repo **唯一**该打 log 的两种情况：(1) 内部有重试/降级/缓存兜底等容错逻辑；(2) catch 后吞掉异常返回 None——吃了就得留痕，且只记 warning。

## 6. 串联——trace_id

- FastAPI middleware + taskiq `TraceMiddleware` 注入 `trace_id` 到 `contextvar`（见 `logging_context.py`），structlog processor 自动带上。
- 排查时 `grep <trace_id>` 一次操作的整条链（HTTP → service → repo → redis → db）一次出齐。
- 这是跨模块串联的正确手段，取代"分文件"。

## 7. 持久化——纯 level 门控 + event 表

### 7.1 Log 表（WARNING+ 自动入库）

DB 入库**仅**持久化 `WARNING+`（warning / error / critical），INFO 不入库。门控按 level 名字集合判定（`_LEVELS_FOR_DB`），不再暴露为运行时配置，也不再提供 `logger.bind(persist=True)` 显式标记。

实现为 root 上的专用 `_DBHandler`：

```
logger (sync, ProcessorFormatter)
   │
   ▼
_db_enqueue(gate: level ∈ _LEVELS_FOR_DB)   ← 纯 level 门控，不再判 persist
   │
   ▼
asyncio.Queue(maxsize=1000)                  ← 解耦同步 logger 与异步 DB
   │
   ▼
_log_worker()  [background task]             ← 单 consumer，async session 直写 Log 表
```

- 每条记录只入队一次（`_db_enqueue` 仅作为 `_DBHandler` 的终端处理器运行，不在 `shared_processors` 里）。
- worker 在 app startup 时通过 `start_log_worker()` 启动（`asyncio.create_task`），shutdown 时先 `await drain_log_queue()` 排空、再 cancel。
- queue 满时丢弃并留痕 stderr，**绝不**阻塞业务日志流。
- 日志写入 PostgreSQL `log` 表（SQLAlchemy `Log` 模型），供排查时直接查库；**不**再通过 HTTP 端点分页查询。

### 7.2 Event 表（关键服务事件）

`INFO + persist=True` 在旧设计里意为"这条 INFO 尽管级别低、仍希望落库供查询"。新版去掉 persist 门控后，启动/部署/通知失败这类关键业务事件改由 **`event` 表**承载——给人看的业务事件，区别于 `log` 表的机器噪音。

- 通过 `record_event(type, title, message="", source="", extra=None)` 独立 async 写入（`app/services/event_service.py`），**不经 logger**。
- 预置 `type`：`startup`（服务启动）、`deploy`（后端升级）、`notify_failure`（通知发送失败）；可扩展自定义类型。
- 前端以"系统事件"列表展示，通过 `/api/v2/system/events` 分页查询（参数 `type` / `start` / `end` / `page` / `per_page`）。
- 调用点：`main.py`（startup / notify_failure）、`admin.py`（deploy）。

## 8. 中文 / 英文

- 日志 `message` 统一**英文**。
- 例外：发给人的外部通知正文（飞书 / Bark / 邮件 body）可中文，那是产品文案，不是日志。
- 编码统一 `utf-8`，确保中文能正确落盘（logger sink 已设）。

## 9. 禁止事项

- 禁止 `import logging` 后用 stdlib 根 logger 打业务日志。
- 禁止手拼 `duration=.. | fetched=..` 这类结构化串进 message。
- 禁止 message 里带 emoji（内部日志）。
- 禁止按领域/模块分日志文件（违背单一轨迹原则）。
- 禁止 repo 层打常规数据操作日志。
- 禁止日志里硬编码密钥、token、完整凭据（脱敏后可记标识）。
