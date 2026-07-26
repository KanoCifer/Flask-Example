# ADR 0006: Logging Orchestration

- **Status**: Accepted
- **Date**: 2026-07-26
- **Author**: Kuroome

## Context

项目中日志系统面临几个关键决策点：

1. **框架选择**：Python 标准库 `logging` vs `structlog`
2. **文件分片策略**：按模块分 vs 按噪音级别分
3. **入库策略**：全部入库 vs 级别门控
4. **日志分层**：谁负责打什么级别的日志
5. **串联手段**：trace_id 注入

## Decision

### 1. 框架：structlog + stdlib forwarding

使用 `structlog` 作为业务日志的统一入口，经由 `ProcessorFormatter` 转交给 stdlib `logging` 的处理器链。这样既获得 structlog 的 chain-of-processors 灵活性，又能复用 stdlib 的成熟 sink 生态（文件轮转、DB handler 等）。

### 2. 文件：按噪音级别分，不按模块分

| 文件 | 级别 | 来源 |
|------|------|------|
| `app_info.log` | INFO+ | service / task |
| `app_error.log` | ERROR+ | 任何层 |

不按 user / article / rss 等模块分文件。理由：跨域调用（rss → cache → notify）的日志切不干净，分文件只会让一次排查散落多文件。排查时靠 trace_id grep 串联。

### 3. 入库：WARNING+ 纯级别门控

- DB 入库仅持久化 WARNING+（warning / error / critical），INFO 不入库
- 关键业务事件（startup、deploy、notify_failure）改走独立的 `event` 表，通过 `record_event()` API 写入，不经过 logger
- 去掉旧设计的 `persist=True` 标记——WARNING+ 靠级别自然门控，关键事件靠独立 channel

### 4. 分层：service 记 INFO，handler 记 ERROR

| 层 | 该记 | 不该记 |
|----|------|--------|
| **service** | 业务动作完成（INFO）+ 内部降级（WARN） | repo 错误的 ERROR——上抛给 handler |
| **handler** | 4xx（WARN）+ 5xx（ERROR） | 业务 INFO——成功动作在 service 记 |
| **repo** | 重试/兜底留痕（WARN）| 常规数据操作日志 |

### 5. 串联：trace_id 通过 contextvar 注入

FastAPI middleware + Taskiq `TraceMiddleware` 注入 trace_id 到 `contextvar`，structlog processor 自动附带。排查时 `grep <trace_id>` 一次出齐整条链。

### 6. 日志 message 规范

- message 纯英文、无 emoji、无前缀（前缀改用 `bind` 字段）
- 结构化数据（duration、count）用 `logger.bind(key=val)` 传入，不手拼字符串
- emoji 仅保留在发送给用户的富文本通知里（飞书、Bark、邮件）

## Consequences

Positive:
- 排查体验好：trace_id 串联完整链路，WARNING+ 入库可查
- 无噪音：INFO 不入库不污染 DB，关键事件走独立 event 表
- 分层清晰：谁该打什么级别一目了然

Negative:
- INFO 不入库意味着某些历史轨迹无法从 DB 回溯（只能查看日志文件）
- 双文件（info + error）在跨层排查时仍需 grep 串联
- 对 Go 端不适用 — Go 使用独立的 `log/slog` + lumberjack

## Alternatives Considered

**单文件 + 按模块 filter**：运维上简单，但在跨模块排查时需要过滤大量不相关日志。**拒绝**。

**全部入库**：INFO 量太大导致 DB 写压力，且 99% 的 INFO 从未被查询。**拒绝**。

**持久化标记 persist=True**：旧设计允许业务代码通过此标记将特定 INFO 落库。但使用不统一、选择性可视、检查不完备。**改为级别门控 + 独立 event 表**。
