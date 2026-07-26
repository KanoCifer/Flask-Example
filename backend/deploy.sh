#!/bin/bash
set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NO_COLOR='\033[0m'

FEISHU_WEBHOOK="https://open.feishu.cn/open-apis/bot/v2/hook/1c9dcf4b-98d6-4b35-8eb6-0c9630b80268"

notify_feishu() {
  local status="$1"  # SUCCESS or FAILED
  local template="$2"
  local summary="$3"
  local host
  host=$(hostname -s 2>/dev/null || echo "kano")
  local branch
  branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
  local commit
  commit=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

  curl -s -X POST "$FEISHU_WEBHOOK" \
    -H "Content-Type: application/json" \
    -d "$(cat <<EOF
{
  "msg_type": "interactive",
  "card": {
    "header": {
      "title": { "tag": "plain_text", "content": "${status} — ${summary}" },
      "template": "${template}"
    },
    "elements": [
      { "tag": "markdown", "content": "**Host:** ${host}\n**Branch:** ${branch}\n**Commit:** ${commit}\n**Time:** $(date '+%Y-%m-%d %H:%M:%S')" }
    ]
  }
}
EOF
  )" > /dev/null 2>&1 || true
}

FAILED_STEP=""

# 任意命令失败时记录当前步骤并推送 webhook；由调用方在关键步骤前设置
# FAILED_STEP，这样 webhook 能区分是哪一步挂掉。
fail() {
  local reason="${1:-$FAILED_STEP}"
  notify_feishu "❌ FAILED" "red" "${reason:-Deploy failed}"
  exit 1
}

trap 'fail' ERR

step() {
  echo -e "\n${BLUE}▶ $1${NO_COLOR}"
}

ok() {
  echo -e "${GREEN}  ✓ $1${NO_COLOR}"
}

warn() {
  echo -e "${YELLOW}  ⚠ $1${NO_COLOR}"
}

echo ""
echo "========================================"
echo "  🚀 Deployment Started"
echo "  📅 $(date)"
echo "========================================"

export CI=true

step "Setting up Node.js environment"
source ~/.nvm/nvm.sh
nvm use 26
ok "Node.js $(node -v)"

step "Pulling latest code"
cd /home/kano/blog || exit 1
OLD_HEAD=$(git rev-parse HEAD)
git checkout . || true
FAILED_STEP="Git pull 失败 (网络/冲突)" && git pull
NEW_HEAD=$(git rev-parse HEAD)
ok "Git pull completed"

BACKEND_CHANGED=false
GO_BACKEND_CHANGED=false
FRONTEND_CHANGED=false
REACT_APP_CHANGED=false
if [ "$OLD_HEAD" != "$NEW_HEAD" ]; then
  if [ -n "$(git diff --name-only "$OLD_HEAD" "$NEW_HEAD" -- backend/)" ]; then
    BACKEND_CHANGED=true
  fi
  if [ -n "$(git diff --name-only "$OLD_HEAD" "$NEW_HEAD" -- go-backend/)" ]; then
    GO_BACKEND_CHANGED=true
  fi
  if [ -n "$(git diff --name-only "$OLD_HEAD" "$NEW_HEAD" -- frontend/apps/vue-app/)" ]; then
    FRONTEND_CHANGED=true
  fi
  if [ -n "$(git diff --name-only "$OLD_HEAD" "$NEW_HEAD" -- frontend/apps/react-app/)" ]; then
    REACT_APP_CHANGED=true
  fi
fi

if [ "$BACKEND_CHANGED" = true ]; then
  step "Updating backend dependencies"
  cd /home/kano/blog/backend || exit 1
  FAILED_STEP="Python 依赖安装失败 (uv sync: lockfile 冲突/网络)" && /home/kano/.local/bin/uv sync
  ok "Dependencies synced"

  step "Running database migrations"
  FAILED_STEP="数据库迁移失败 (alembic: schema 冲突/DB 连接)" && /home/kano/.local/bin/uv run alembic upgrade head
  FAILED_STEP="insert_changelog.py 执行失败" && /home/kano/.local/bin/uv run python scripts/insert_changelog.py
  ok "Migrations applied"
else
  warn "No backend changes detected — skipping deps sync and migrations"
fi

if [ "$GO_BACKEND_CHANGED" = true ]; then
  step "Building Go backend"
  cd /home/kano/blog/go-backend || exit 1
  FAILED_STEP="Go mod tidy 失败 (模块下载/网络)" && /usr/bin/go mod tidy
  FAILED_STEP="Go 编译失败 (语法错误/依赖缺失)" && /usr/bin/go build -o /home/kano/blog/go-backend/server ./cmd/server
  ok "Go binary built at /home/kano/blog/go-backend/server"
else
  warn "No Go backend changes detected — skipping build"
fi

if [ "$FRONTEND_CHANGED" = false ] && [ "$REACT_APP_CHANGED" = false ]; then
  warn "No frontend changes detected — skipping all builds"
else
  step "Building frontends (parallel)"

  PID_FRONTEND=""
  PID_REACT=""

  if [ "$FRONTEND_CHANGED" = true ]; then
    ( cd /home/kano/blog/frontend/apps/vue-app || exit 1; pnpm i && pnpm run build ) &
    PID_FRONTEND=$!
  else
    warn "No frontend changes detected — skipping build"
  fi

  if [ "$REACT_APP_CHANGED" = true ]; then
    ( cd /home/kano/blog/frontend/apps/react-app || exit 1; pnpm i && pnpm run build ) &
    PID_REACT=$!
  else
    warn "No react-app changes detected — skipping build"
  fi

  FRONTEND_OK=true
  REACT_OK=true
  if [ -n "$PID_FRONTEND" ]; then
    if ! wait "$PID_FRONTEND"; then
      FRONTEND_OK=false
      warn "Frontend build failed"
    else
      ok "Frontend built"
    fi
  fi
  if [ -n "$PID_REACT" ]; then
    if ! wait "$PID_REACT"; then
      REACT_OK=false
      warn "React app build failed"
    else
      ok "React app built"
    fi
  fi

  if [ "$FRONTEND_OK" = false ] || [ "$REACT_OK" = false ]; then
    [ "$FRONTEND_OK" = false ] && FAILED_STEP="Vue 前端构建失败 (frontend: 依赖/构建错误)"
    [ "$REACT_OK" = false ] && FAILED_STEP="React 前端构建失败 (react-app: 依赖/构建错误)"
    exit 1
  fi
fi

step "Restarting services"
if [ "$BACKEND_CHANGED" = true ] || [ "$GO_BACKEND_CHANGED" = true ]; then
  FAILED_STEP="supervisorctl reload 失败 (进程配置/权限)" && sudo supervisorctl reload || true
  FAILED_STEP="gobackend 服务重启失败 (systemctl: 单元/启动错误)" && /usr/bin/systemctl --user restart gobackend
  ok "Backend restarted"
else
  warn "No backend changes — skipping service restart"
fi

notify_feishu "✅ SUCCESS" "green" "Deploy completed"

echo ""
echo "========================================"
echo "  ✅ Deployment Completed Successfully"
echo "  📅 $(date)"
echo "========================================"
echo ""
