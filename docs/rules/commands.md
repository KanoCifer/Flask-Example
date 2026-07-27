# Commands

> **代码质量检查已自动化**：per-edit 由 `.claude/settings.json` 的 PostToolUse hook 触发 prettier / oxlint / ruff / gofmt + go vet；commit 时由 `.git/hooks/pre-commit` 闸门跑 type-check / ruff check / go vet / go build。下方命令保留作为手动覆盖 / 调试参考。

## Backend

```bash
cd backend

# run dev server (:5555)
uv run python3 dev.py

# migrations
uv run alembic revision --autogenerate -m "desc"
uv run alembic upgrade head

# format & lint (pre-commit)
ruff format . && ruff check .
ruff check . --fix              # auto-fix

# tests
uv run pytest                                  # all tests
uv run pytest test/test_main.py -v             # single file
uv run pytest test/core/test_config.py::test_config_loading -v  # single test
uv run pytest -k "config" -v                  # filter by keyword
uv run pytest --tb=short                      # short traceback
```

## Go Backend

```bash
cd go-backend

go run ./cmd/server          # 启动 -> 127.0.0.1:5555
go test ./...                # 全量单测（子集/过滤同 Go 标准用法）
gofmt -w .                   # 格式化
go vet ./...                 # 静态检查

# Docker（多阶段构建 golang-alpine → alpine）
docker build -t go-backend -f Dockerfile .
docker run -p 5555:5555 --env-file ../.env go-backend
```

> Go 端架构与分层详见 [go-backend.md](go-backend.md)。

## Desktop (Vue)

```bash
cd frontend/apps/vue-app
pnpm install                        # install deps
pnpm run dev                        # dev server (:5173)
pnpm run build                      # tsc -b && vite build (only if user asks)
pnpm run build-only                 # vite build only
pnpm run type-check                 # vue-tsc --noEmit
pnpm run lint                       # oxlint
pnpm run lint:fix                   # oxlint auto-fix
pnpm run format                     # prettier (auto-sorts tailwind classes)
pnpm run test:unit                  # vitest
pnpm run test:unit -- --run         # single run (not watch mode)
```

## Mobile (React)

```bash
cd frontend/apps/react-app
pnpm install                        # install deps
pnpm run dev                        # dev server (:5174)
pnpm run build                      # tsc -b && vite build (only if user asks)
pnpm run build-only                 # vite build only
pnpm run type-check                 # tsc --noEmit
pnpm run lint                       # oxlint
pnpm run lint:fix                   # oxlint auto-fix
pnpm run format                     # prettier
pnpm run test:unit                  # vitest run
```

## 跨端快捷命令（在 frontend/ 下执行）

```bash
cd frontend
pnpm install                        # 一次性安装所有依赖
pnpm run dev:vue                    # 启动 Vue dev server
pnpm run dev:react                  # 启动 React dev server
pnpm run build                      # 构建两端
pnpm run type-check                 # 类型检查两端
pnpm run test                       # 运行两端单测
pnpm run lint                       # 检查两端 lint
```
