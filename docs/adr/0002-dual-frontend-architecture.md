# ADR 0002: Dual-Frontend Architecture

- **Status**: Accepted
- **Date**: 2026-07-26
- **Author**: Kuroome

## Context

kanocifer.chat 需要同时覆盖两个终端场景：

1. **Desktop** — 主站全功能体验，复杂交互（博客编辑、图库管理、订阅看板）
2. **Mobile** — 移动端浏览，PWA / 类 App 体验，轻量操作

### 备选方案

| 方案                     | 描述                                         |
| ------------------------ | -------------------------------------------- |
| Responsive SPA           | 一套前端响应式适配桌面和移动                 |
| 双前端                   | Vue 3 (desktop) + React 19 (mobile) 独立构建 |
| 一套框架 + 两套路由/组件 | 如 Nuxt 的 `desktop/` `mobile/` 布局分离     |

### 选型约束

- 桌面端在 Vue 生态下已有大量成熟代码和自定义组件
- 移动端需要独立路由、独立构建优化（懒加载、打包尺寸）
- 两端交互模式差异显著：桌面更接近 CMS / Dashboard，移动端更接近信息流
- 团队需要同时保持对 Vue 和 React 生态的掌控力（技术标杆 / 招聘吸引力）

## Decision

维护两套独立前端：**Vue 3.5** (`frontend/apps/vue-app/`) 用于桌面，**React 19** (`frontend/apps/react-app/`) 用于移动。

两端的架构原则：

- **共享后端**：所有 API 走同一套 Go/FastAPI 后端，不引入 BFF 层
- **独立状态**：各自使用独立 Store（Pinia vs Zustand），不共享前端状态
- **共享主题**：品牌 tokens（颜色、间距、排版）通过 `packages/brand/` 的 CSS 变量共享
- **独立构建**：各自使用 Vite 8 独立构建，独立部署

## Consequences

Positive:

- 桌面和移动各自最优体验，不互相妥协
- 两端独立迭代，互不阻塞
- 保持对两大前端生态的掌控

Negative:

- 两套前端代码维护成本 ×2（修复同一个 bug 需要在两个代码库改）
- 新特性如果两端都需要，需要协调发布节奏
- 共享逻辑（类型定义、工具函数）无法简单地代码共享（需通过 `packages/` 提取）

## Alternatives Considered

**单一响应式 SPA**：移动端体验受限于桌面布局，大量 CSS 覆盖导致 `@media` 膨胀，性能与维护成本在后期反超两套独立前端。**拒绝**。

**Nuxt 布局分离**：Vue 生态下可行的方案，但 React 移动端生态（React Native Web / 移动端组件库）成熟度更高。**拒绝**。
