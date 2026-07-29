# Code Style

## Backend FastAPI

- Imports: **absolute imports only**
- Naming: functions/variables `snake_case`, classes `PascalCase`
- Services raise domain errors (`BlogDomainError`, `RssDomainError`, etc.), API layer maps to HTTP via exception handlers
- Async: prefer async/await for all DB and I/O operations
- Logging: use `structlog`'s `logger` (`from app.core.logger import logger`), never stdlib root logger

## Frontend Vue

- Use `<script setup lang="ts">` + Composition API
- Type safety: avoid `any`; use `unknown` + narrowing for external inputs; keep props/emits/store types explicit
- Naming: variables/functions `camelCase`, components/types `PascalCase`, component file `PascalCase.vue`, utility file `camelCase.ts`
- 新增业务域 → `features/<domain>/` 下建域，禁止散落在顶层（顶层 `views/` `auth/` `components/` 等已清空）
- **扁平原则**：`components/`、`composables/`、`api/` 内禁止嵌套子目录；所有 .vue/.ts 平铺在对应目录根部，通过 `index.ts` 桶导出；视图文件放域根（`<View>.vue`），禁止 `views/` 子目录
- 测试文件（`*.test.ts`）与源码就近放置（`__tests__/` 子目录）

## Go Backend

- 错误处理: 显式 `if err != nil`，禁止 panic；下层返回 error，上层包装上下文
- 日志: 使用 `internal/logger` 的 `slog`，禁止 `fmt.Println`
- Handler 通过接口依赖 Service（便于 mock 测试），构造函数注入配置

## Mobile (React + TS)

- Use function components + hooks
- State: Zustand with `useShallow` for object selectors to prevent infinite re-renders; avoid returning new object references in selectors
- Naming: same as Vue — `camelCase` for functions/vars, `PascalCase` for components/types

## Shared Packages (`frontend/packages/`)

- `@readinglist/api` 承载跨端共享的 API 层（apiClient、gateway、SSE 工具）；新增业务 gateway 应放此包，禁止在 `vue-app` / `react-app` 内各自维护
- `@readinglist/utils` 必须保持**框架无关**（零 React/Vue 运行时依赖）；领域纯函数放 `domain/`，UI 工具放根目录
- 两端各自的 gateway 实现已清理，统一从 `@readinglist/api` 导入
