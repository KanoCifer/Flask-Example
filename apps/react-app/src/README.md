# Packages (Deep Modules)

Each top-level directory under `src/` is a **deep module**: a lot of behaviour
behind a small interface. A package's **public surface is its root files**.
Anything in a subfolder is private. A package may expose several small entry
points instead of funnelling through one giant barrel.

```
src/<package>/
  index.ts              ← entry point (public). Import this from outside.
  routes.ts             ← route definitions (public, features only)
  views.ts              ← view components (public, features only)
  lib/                  ← implementation: hidden from outside.
  api/                  ← implementation: hidden (features only)
  components/           ← implementation: hidden (features only)
  hooks/                ← implementation: hidden (features only)
  types/                ← implementation: hidden (features only)
  tests/                ← co-located tests + fixtures (private).
```

## Layout

- **Entry points** live at the package root. A package may expose several small
  entry points — prefer that over one giant barrel.
- **Implementation** goes in subfolders. Any subfolder is private.
- **Tests** live in `__tests__/` or `tests/` (co-located and private).

## Feature structure

Every feature follows the same internal layout — 5 standard subdirectories
plus 3 root entry points:

```
features/<name>/
  api/                  ← API gateways / services
  components/           ← feature-private UI
  hooks/                ← feature-private hooks (React; composables/ in Vue)
  types/                ← feature types
  lib/                  ← feature-private helpers
  routes.ts             ← route definitions (public)
  views.ts              ← view components (public)
  index.ts              ← barrel export (public)
```

## Store ownership

Stores are placed by **consumption scope**:

- **Global** — consumed by 2+ features → top-level `stores/`
  (`deviceState`, `notificationState`, `routeMapStore`, `themeState`).
- **Feature-private** — consumed by a single feature →
  `features/<name>/stores/` (e.g. `auth/stores/`, `fishing/stores/`,
  `books/stores/`, `todo/stores/`, `visitor/stores/`, `moments/stores/`).

## Route autonomy

Each feature owns its route definitions (`routes.ts`) and view components
(`views.ts`). The router pulls in each feature's routes — the top-level router
is a thin aggregator that does not define routes itself.

## Shared infrastructure

These `src/` directories are **not** packages — freely importable, not subject
to boundary rules: `assets/`, `test/`, `constants/`, `types/`, `data/`.

## Tool layer

The tool layer lives in `lib/` (path imports, e.g. `@/lib/formatdate`,
`@/lib/markdown`). `lib/` also hosts framework-agnostic core
(`llm/`, `tokenService`). Features and infrastructure import `lib/` entry
points directly.

## The four rules

1. **Entry-point boundary** — import a package only through its root files,
   never anything in its subfolders.
2. **Intra-package freedom** — a package's own files import each other freely.
3. **Tests through the entry points** — tests import any package's entry points
   and their own `tests/` fixtures, never internals (not even their own).
4. **No cycles**.

## Adding a package

Add a root file as the entry point. Implementation goes in a subfolder.
No barrel files that re-export a whole subtree — keep entry points small.
