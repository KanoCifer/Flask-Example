# Environment

- Backend: `backend/` — FastAPI
- Desktop: `apps/vue-app/`
- Mobile: `react-app/`
- Brand themes: `packages/brand/themes/` — shared CSS variables (4 schemes: paper / sage / mist / blush)
- Brand prose: `packages/brand/prose.css` — `.prose` article styles (shared across both frontends)
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

### Go 端额外变量

| Variable                                                            | Description                               |
| ------------------------------------------------------------------- | ----------------------------------------- |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `GITHUB_REDIRECT_URI` | GitHub OAuth 登录                         |
| `MAIL_USERNAME` / `MAIL_PASSWORD` / `MAIL_SERVER` / `MAIL_PORT`     | SMTP 邮件通知                             |
| `FEISHU_WEBHOOK_URL`                                                | 飞书 Bot webhook                          |
| `ADMIN_USER_IDS`                                                    | 逗号分隔的管理员 user ID 列表（如 `1,2`） |
| `WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGIN`                                | Passkey 认证（默认 `kanocifer.chat`）     |
| `AMAP_SECURITY_CODE` / `AMAP_WEB_KEY`                               | 高德地图天气                              |
