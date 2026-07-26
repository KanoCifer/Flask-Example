# Packages are deep modules

Only **feature packages** (`features/<name>/`) are deep modules: a lot of
behaviour behind a small interface. A feature's **public surface is its entry
points** — the files at the feature root. Everything in its subfolders
(`api/`, `components/`, `composables/`, `stores/`, `lib/`, ...) is private.

```
src/
  features/
    blog/           ← a deep module (package)
      index.ts      ← entry point (public). Import this from outside.
      routes.ts     ← route definitions (public)
      views.ts      ← view components (public)
      api/          ← implementation: hidden from outside.
      components/   ← implementation: hidden.
      __tests__/    ← co-located tests: hidden, exercise code through entry points.
    books/          ← another deep module
  components/       ← shared UI (NOT a package — freely importable)
    icons/
    shared/
    ui/
  stores/           ← global stores (NOT a package — freely importable)
  lib/              ← infrastructure layer (framework-agnostic core)
    request.ts      ← axios 客户端 + 拦截器
    auth.ts         ← access-JWT 内存单例
    dayjs.ts        ← 日期/时长/相对时间格式化
    websocket.ts    ← WebSocketManager 类（无 Vue 依赖）
  shared/           ← shared infrastructure (NOT a package — freely importable)
    components/
    composables/
    stores/
    api/
  utils/            ← shared infrastructure (re-exports lib/ through its barrels)
  layouts/          ← shared infrastructure
  router/           ← shared infrastructure (aggregates feature routes)
```

`components/`, `stores/`, `shared/`, `utils/`, `layouts/`, `router/` are
**shared infrastructure**: flat utility libraries that any feature may import
freely. They are NOT subject to boundary rules. This mirrors the model in
`react-app/.dependency-cruiser.cjs`.

`lib/` is the infrastructure layer: framework-agnostic core (request, auth,
dayjs, websocket) that `utils/` re-exports through its barrel files. Features
import from `lib/` entry points, not from `utils/` internals.

## Feature structure

Every feature follows the same internal layout — 5 standard subdirectories
plus 3 root entry points:

```
features/<name>/
  api/                  ← API gateways / services
  components/           ← feature-private UI
  composables/          ← feature-private composables (Vue; hooks/ in React)
  types/                ← feature types
  lib/                  ← feature-private helpers
  routes.ts             ← route definitions (public)
  views.ts              ← view components (public)
  index.ts              ← barrel export (public)
```

Framework-specific directories (`layouts/`, `styles/`, `composables/` vs
`hooks/`) are kept per-platform and not forced into alignment.

## Store ownership

Stores are placed by **consumption scope**:

- **Global** — consumed by 2+ features → top-level `stores/`
  (`background`, `notification`, `theme`).
- **Feature-private** — consumed by a single feature →
  `features/<name>/stores/` (e.g. `auth/stores/`, `fishing/stores/`,
  `books/stores/`, `todos/stores/`, `visitor/stores/`, `moments/stores/`,
  `entry/stores/`).

## Route autonomy

Each feature owns its route definitions (`routes.ts`) and view components
(`views.ts`). The top-level `router/index.ts` is a thin aggregator that pulls
in each feature's routes — it does not define routes itself.

## The rules

1. **Entry-point boundary** — code outside a feature (shared infra, layouts,
   other features) may import only that feature's root files (its entry points),
   never anything in its subfolders.
2. **Features don't import each other** — if a component/composable is used by 2+
   features, move it to `shared/` instead of cross-importing.
3. **Intra-package freedom** — a feature's own files import each other freely.
4. **Tests through the entry points** — `__tests__/` files import only entry
   points (any feature's) and their own fixtures, never any feature's internals
   — not even their own.
5. **No cycles** — no dependency cycles. Don't re-export page components from
   feature barrels (it creates cycles).

## Layout

- **Entry points** live at the feature root. A feature may expose several small
  entry points — prefer that over one giant barrel `index.ts`.
- **Implementation** goes in subfolders. Any subfolder is private.
- **Tests** live in `__tests__/` (repo convention), co-located and private.
- **Shared components** used by 2+ features live in `components/shared/`
  (or `shared/components/`).

## Discourage barrel files

Don't re-export a whole subtree through one `index.ts`. Don't re-export page
components (e.g. `AnalyticsView`) from feature barrels — routes import them
directly. Keep barrels small and cycle-free.

## How to check

```bash
pnpm run lint:boundaries
```

This runs [dependency-cruiser](https://github.com/sverweij/dependency-cruiser)
with `.dependency-cruiser.cjs`.
