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

### 可信代理（FastAPI 与 Go 后端共用）

| Variable         | Description                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| `TRUSTED_PROXIES` | 可信反向代理（逗号分隔 IP 或 CIDR），如 Nginx。仅这些来源的 `X-Forwarded-For` 末段被当作真实客户端 IP。默认 `127.0.0.1,::1`（仅同机反代）；Nginx 在其它网段时需补充其地址。FastAPI 端经 uvicorn `forwarded_allow_ips` 生效（`request.client` 与限流/审计共用），Go 端经 gin `SetTrustedProxies` + `RealClientIPMiddleware` 生效。**生产如用 `uvicorn app.main:app` 命令行（supervisor）而非 `dev.py` 启动，需在环境变量中设 `FORWARDED_ALLOW_IPS`（uvicorn 原生读取）与 `TRUSTED_PROXIES` 保持一致**；dev 场景 `dev.py` 已自动透传。 |

#### 前置 CDN（EdgeOne / Cloudflare）

当 nginx 前面再加 CDN（如腾讯云 EdgeOne）时，拓扑变为 `客户端 → CDN → Nginx → 后端`：

- CDN 回源会把与它建连的前序 IP **追加**进 `X-Forwarded-For`（EdgeOne 官方行为，直接用户即真实客户端）；
- nginx 再用 `$proxy_add_x_forwarded_for` 追加 CDN 节点 IP。

此时后端的"取末段"约定会把 **CDN 节点 IP** 当作客户端，限流/审计/登录 IP 全部塌缩到少数节点 IP。

**必须在 nginx 层用 realip 模块把真实客户端重写到 `$remote_addr`**，后端无需改动：

```nginx
set_real_ip_from <EdgeOne 回源 IP 段>;
real_ip_header X-Forwarded-For;
real_ip_recursive on;
```

之后 nginx `$proxy_add_x_forwarded_for` 追加的就是真实客户端 IP，两端"取末段"逻辑自动恢复正确。

注意事项：

- **回源 IP 段的唯一官方来源是付费版的「源站防护」**（安全防护 → 源站防护 控制台，或 `DescribeOriginACL` API 轮询）。免费版两处来源均已关闭：
  - 公开列表接口 `api.edgeone.ai/ips` 已于 2026-07-31 停止服务、2026-08-31 正式下线（实测已返回 `0.0.0.0/0` 占位）；
  - 免费套餐的「源站防护」功能已于 2025-11-14 下架，需升级个人版/基础版/标准版套餐才有。
- 因此**免费版无法可靠配置防火墙 IP 白名单**（无可用回源段）。若坚持免费版，只能走应用层替代：后端只信 loopback（两端 `TRUSTED_PROXIES=127.0.0.1,::1`，代码已兜底）、确认后端端口不对外、nginx 不采信伪造头，并接受"源站 IP 可被探测"的残余风险。要彻底隐藏源站，需升级套餐开启源站防护后做网络层白名单。
- **`set_real_ip_from 0.0.0.0/0`（信任一切）为高风险配置**：攻击者绕过 CDN 直连 nginx 时，可伪造 `EO-Connecting-IP`/`X-Forwarded-For` 任意冒充 IP，限流/审计/登录 IP 全被绕过。拿不到回源段时**不要**用 `0.0.0.0/0` 采信转发头；应改走下面的应用层兜底。
- 若不做 nginx 侧重写，则须把 CDN 回源段加进两端 `TRUSTED_PROXIES`，并把解析策略改为"从右向左取第一个非可信 IP"（gin/uvicorn 原生逻辑），改动更大且回源段需在两处同步维护。

### Learning 模块 — DeepSeek + Exa 研究

| Variable            | Description                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------- |
| `DEEPSEEK_API_KEY`  | DeepSeek API key（Learning 模块专用，独立于 AntLLM 的 `API_KEY`）。为空时 `create_deepseek_model()` 立即抛 `RuntimeError`，老特性不受影响。 |
| `EXA_API_KEY`       | Exa 研究 API key（Learning 课程 agent 研究工具裁剪）。为空时课程 agent **不挂** Exa/Context7 研究工具（优雅降级，模型自然跳过研究）；配置后才挂 `ExaTools` + Context7 `MCPTools`，由模型自主决定何时调用研究。 |
| `LEARNING_ROOT_DIR` | Learning 课程包根目录（所有学习资源的根，课程按 `<course_id>/` 包一层在其下）。为空时用默认值 `<backend>/tmp/learning`；配置为绝对或相对路径时作为根目录（相对路径相对于进程 CWD）。优先级：构造 `CourseGeneratorService` 注入的 `tmp_dir` > 本变量 > 默认值。 |

- base_url：`https://api.deepseek.com`（`create_deepseek_model` 内置，无需环境变量）。
- 支持的 model id：`deepseek-v4-pro`、`deepseek-v4-flash`（白名单硬编码，传入其他值会抛 `ValueError`）。
- **DeepSeek 仅支持 JSON mode（`json_object`），不支持原生 `json_schema`** —— 必须显式 `use_json_mode=True`，否则 `output_schema` 直传会被 DeepSeek 拒绝。
- Learning 课程生成为**单一课程 agent 一次 run**（agent_driven）：写课 / 写 resource / 出题全部由模型经工具完成，研究（Exa + Context7）作为可选工具由模型自主决定调用，不再有独立的「研究步」。

### Go 端额外变量

| Variable                                                            | Description                               |
| ------------------------------------------------------------------- | ----------------------------------------- |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `GITHUB_REDIRECT_URI` | GitHub OAuth 登录                         |
| `MAIL_USERNAME` / `MAIL_PASSWORD` / `MAIL_SERVER` / `MAIL_PORT`     | SMTP 邮件通知                             |
| `FEISHU_WEBHOOK_URL`                                                | 飞书 Bot webhook                          |
| `ADMIN_USER_IDS`                                                    | 逗号分隔的管理员 user ID 列表（如 `1,2`） |
| `WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGIN`                                | Passkey 认证（默认 `kanocifer.chat`）     |
| `AMAP_SECURITY_CODE` / `AMAP_WEB_KEY`                               | 高德地图天气                              |
