# ADR 0003: Data Layer Composition

- **Status**: Accepted
- **Date**: 2026-07-26
- **Author**: Kuroome

## Context

项目需要支持的数据类型多样，单一的数据库无法在所有场景下有最优表现：

| 数据类型                        | 特点                           | 需求                 |
| ------------------------------- | ------------------------------ | -------------------- |
| 用户、订阅、设备、图库          | 结构化、强关联、事务           | ACID、JOIN、迁移能力 |
| 博客文章、碎碎念、RSS文章、日志 | 半结构化、读写频繁、schemaless | 灵活文档模型、高吞吐 |
| 缓存、会话、访客追踪、分布式锁  | KV、TTL、秒级读写              | 极低延迟、自动过期   |
| RSS刷新、邮件、通知、日志入库   | 异步、可延迟、可重试           | 消息队列、worker消费 |

## Decision

采用 **PostgreSQL + MongoDB + Redis + RabbitMQ** 四层数据栈，各有侧重。

### 角色分配

| 存储                     | 用途                                           | 核心选型理由                                       |
| ------------------------ | ---------------------------------------------- | -------------------------------------------------- |
| **PostgreSQL** (asyncpg) | 核心关系数据 — 用户、Profile、订阅、设备、图库 | ACID 事务、Alembic 迁移、与 FastAPI async 原生集成 |
| **MongoDB** (Beanie ODM) | 文档数据 — 文章、动态、RSS、系统日志           | 灵活 schema、无需 migration、JSON 原样存取         |
| **Redis 8**              | 缓存、会话、锁、Rate limit                     | 内存级延迟、TTL 自动淘汰、分布式锁原语             |
| **RabbitMQ** (Taskiq)    | 异步任务队列                                   | 消息确认、死信队列、任务重试                       |

### 集成模式

- 应用层不直接读写多数据源：repository 封装对单一存储的访问，service 跨 repository 编排
- Redis 缓存通过 `@redis_cache` 装饰器透明接入，对业务代码无侵入
- Taskiq 生产消费完全异步，不阻塞 HTTP 请求路径

## Consequences

Positive:

- 每种数据使用最适合的存储，无妥协
- 各存储独立扩缩容
- 数据隔离降低故障爆炸半径

Negative:

- 运维复杂度 ×4（需要维护多个中间件）
- 跨存储的事务无法保证（需应用层补偿或最终一致性）
- 本地开发环境需要 docker-compose 拉起全部服务
- 调试时需要在不同查询工具间切换

## Alternatives Considered

**单一 PostgreSQL**：JSONB 列可替代部分 MongoDB 场景，但在高频写入和灵活查询上性能不如原生文档库。文章全文搜索场景也需额外引入全文索引。**拒绝**。

**单一 MongoDB**：关系数据的事务需求在 MongoDB 4.0+ 得到改善，但多文档事务性能有损耗，且缺乏 schema 迁移工具链。**拒绝**。
