# CLAUDE.md

## 1) Rules (Highest Priority)

- 使用语义化 Tailwind class，禁止硬编码颜色。
- 用户没有特殊要求，禁止执行 `pnpm build`
- Python 后端使用 `uv` 管理依赖。

## 2) Project Overview

- kanocifer.chat 个人网站（"kuro neko" / 黑猫）。
- **双前端 + 双后端架构**：Vue (`frontend/apps/vue-app/` + Pinia) + React (`frontend/apps/react-app/` + Zustand)，各自独立状态 Store；Python FastAPI (`backend/`, `/v2`) + Go Gin (`go-backend/`, `/v3`)。pnpm monorepo (Tailwind v4，workspace 根在 `frontend/`)，共享包 `frontend/packages/`（`@readinglist/api`·`types`·`utils`·`config`·`brand`）。

## 3) Documentation Index

项目规则（`docs/rules/`）：

- [architecture.md](docs/rules/architecture.md) — 后端分层、数据层、API 约定、双端分流
- [code-style.md](docs/rules/code-style.md) — 后端/ Vue/ React 代码风格
- [commands.md](docs/rules/commands.md) — 常用命令速查
- [domain.md](docs/rules/domain.md) — 领域词汇表
- [environment.md](docs/rules/environment.md) — 环境变量、端口、工具链版本
- [go-backend.md](docs/rules/go-backend.md) — Go 重构的分层、鉴权差异、测试、已知遗留
- [auth.md](docs/rules/auth.md) — **双后端认证统一契约**(JWT/Refresh/Password/Admin)
- [logging.md](docs/rules/logging.md) — 日志编排规约 (structlog + Taskiq 落库)
- [testing.md](docs/rules/testing.md) — 前端测试规范 (Vue + React + Vitest 4)

架构决策记录（`docs/adr/`）— 6 篇不可逆决策：双前端、数据层、后端分层、日志编排。

## devtask 工作流

本项目使用 devtask 看板管理开发任务。MCP server `devtask` 提供 v3 工具，**优先用 skill 而不是直接工具调用**。

### 工作流

需求 → /devtask:devtask-plan（复杂）或 /devtask:devtask-simple（简单）
→ 落库为 spec + 子任务树
→ /devtask:devtask-doit task-N（执行指定任务）
→ /devtask:devtask-review（验收条件 + 代码审查）
→ 标已完成

### 何时使用

| 场景                                 | 技能                           |
| ------------------------------------ | ------------------------------ |
| 预计改动 >5 文件、跨层、需要拆子任务 | `/devtask:devtask-plan`        |
| 预计改动 ≤5 文件、单意图             | `/devtask:devtask-simple`      |
| 执行已落库的任务                     | `/devtask:devtask-doit task-N` |
| 验收已完成任务                       | `/devtask:devtask-review`      |
| 探讨方案选型                         | `/devtask:devtask-grill`       |

### 引用规范

- spec 是规划节点（kind=spec），subtask 是可执行单元（kind=subtask）
- `parent_slug` 承载结构归属，`blocked_by` 承载同层执行顺序依赖
- 状态推进统一走 `update_task(slug, status=...)` 或 `update_task(slugs=[...])`；其它字段修改走 `update_task(slug, detail=...)`
