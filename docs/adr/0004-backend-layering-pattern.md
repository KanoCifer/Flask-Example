# ADR 0004: Backend Layering Pattern

- **Status**: Accepted
- **Date**: 2026-07-26
- **Author**: Kuroome

## Context

FastAPI 后端需要一套清晰的代码组织方式，以应对以下挑战：

- 业务逻辑散落在路由处理函数中，导致 handler 胖、不可测试
- 数据访问代码与业务逻辑耦合，切换 ORM 或存储时影响范围大
- 缺乏清晰的错误边界定义

## Decision

采用 **api (handler) → service → repository** 三层架构。

```
request
  │
  ▼
handler (api)      — 输入解析、响应格式化、HTTP 状态码映射
  │
  ▼
service            — 业务编排、多 repository 协调、事务边界
  │
  ▼
repository         — 单一数据源访问（ORM / 裸 SQL / 外部 API）
```

### 各层职责

| 层             | 职责                                                       | 禁止                                     |
| -------------- | ---------------------------------------------------------- | ---------------------------------------- |
| **handler**    | 参数校验、调用 service、组装 `APIResponse`、异常→HTTP 映射 | 不允许直接访问数据库、不允许包含业务逻辑 |
| **service**    | 业务规则编排、跨 repository 协调、事务管理                 | 不感知 HTTP，不直接返回 response 对象    |
| **repository** | 单数据源的 CRUD、查询封装                                  | 不包含业务规则，不跨数据源调用           |

### 异常流

- service 层抛出领域异常（`BlogDomainError`、`RssDomainError` 等）
- handler 层通过 exception handler 统一映射到 HTTP 状态码（404 / 400 / 500）
- repository 层不吞异常，上抛给调用方处理

## Consequences

Positive:

- 每层可独立测试（handler 可 mock service，service 可 mock repository）
- 切换 ORM / 数据库只需改动 repository 层，业务逻辑不受影响
- 新人上手路径清晰：看 handler 知道 API 签名，看 service 知道业务规则

Negative:

- 简单 CRUD 也需要三层文件，boilerplate 较多
- 层间调用有轻微性能开销（函数调用 + DTO 转换）
- 需要严格执行分层纪律，否则退化为"三层都写 SQL"的反模式

## Alternatives Considered

**胖 handler + 纯 SQL**：Django-style，适合快速原型。但项目规模增长后 handler 不可测试、业务逻辑无法复用。**拒绝**。

**CQRS + Event Sourcing**：对于当前项目规模过度设计。**拒绝**。
