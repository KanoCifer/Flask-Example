# Environment

- Backend: `backend/` — FastAPI
- Desktop: `frontend/apps/vue-app/`
- Mobile: `frontend/apps/react-app/`
- Shared API layer: `frontend/packages/api/` — `@readinglist/api`（apiClient + 拦截器 + 所有 gateway）
- Shared utils: `frontend/packages/utils/` — `@readinglist/utils`（框架无关纯工具 + 领域纯函数）
- Brand themes: `frontend/packages/brand/themes/` — shared CSS variables (4 schemes: paper / sage / mist / blush)
- Brand prose: `frontend/packages/brand/prose.css` — `.prose` article styles (shared across both frontends)
- Go backend: `go-backend/` — Python 后端的 Go 重构。

## Required Env Vars

| Variable        | Description                                                                         |
| --------------- | ----------------------------------------------------------------------------------- |
| `DATABASE_URL`  | PostgreSQL **async** connection string (app runtime + Alembic 迁移均使用，异步引擎) |
| `SECRET_KEY`    | JWT signing key (`openssl rand -hex 32`)                                            |
| `MONGO_URI`     | MongoDB connection string                                                           |
| `REDIS_URL`     | Redis connection string                                                             |
| `RABBITMQ_URL`  | RabbitMQ connection string (Taskiq broker)                                          |
| `MEDIA_PATH`    | 上传文件存储根目录（绝对路径或相对路径）。                                          |
| `MAX_UPLOAD_MB` | 单文件上传上限（MB），默认 `10`；超出返回 413                                       |

### Learning 模块 — DeepSeek

| Variable            | Description                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------- |
| `DEEPSEEK_API_KEY`  | DeepSeek API key（Learning 模块专用，独立于 AntLLM 的 `API_KEY`）。为空时 `create_deepseek_model()` 立即抛 `RuntimeError`，老特性不受影响。 |

- base_url：`https://api.deepseek.com`（`create_deepseek_model` 内置，无需环境变量）。
- 支持的 model id：`deepseek-v4-pro`、`deepseek-v4-flash`（白名单硬编码，传入其他值会抛 `ValueError`）。
- **DeepSeek 仅支持 JSON mode（`json_object`），不支持原生 `json_schema`** —— 必须显式 `use_json_mode=True`，否则 `output_schema` 直传会被 DeepSeek 拒绝。

### Go 端额外变量

| Variable                                                            | Description                               |
| ------------------------------------------------------------------- | ----------------------------------------- |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `GITHUB_REDIRECT_URI` | GitHub OAuth 登录                         |
| `MAIL_USERNAME` / `MAIL_PASSWORD` / `MAIL_SERVER` / `MAIL_PORT`     | SMTP 邮件通知                             |
| `FEISHU_WEBHOOK_URL`                                                | 飞书 Bot webhook                          |
| `ADMIN_USER_IDS`                                                    | 逗号分隔的管理员 user ID 列表（如 `1,2`） |
| `WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGIN`                                | Passkey 认证（默认 `kanocifer.chat`）     |
| `AMAP_SECURITY_CODE` / `AMAP_WEB_KEY`                               | 高德地图天气                              |
