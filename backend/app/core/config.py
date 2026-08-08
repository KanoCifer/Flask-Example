# config.py

from pydantic_settings import BaseSettings, SettingsConfigDict


def get_env_file_path() -> str:
    """Get the absolute path to .env file."""
    from pathlib import Path

    env = str(Path(__file__).resolve().parent.parent.parent / ".env")
    return env


class Settings(BaseSettings):
    DATABASE_URL: str = ""
    SECRET_KEY: str = ""
    MONGO_URI: str = ""
    MAIL_USERNAME: str = ""
    MAIL_PASSWORD: str = ""
    API_VERSION: str = "4.0.0"
    API_TITLE: str = "Reading List API"
    API_DESCRIPTION: str = "API文档。Personal reading tracker API built with FastAPI, PostgreSQL, and MongoDB. Manage your reading list, track progress, and get book recommendations."
    API_KEY: str = ""
    # DeepSeek 接入（Learning 模块专用）。为空字符串时 create_deepseek_model()
    # 会立即抛错，便于部署期检查；与 API_KEY（AntLLM）解耦，老特性不受影响。
    DEEPSEEK_API_KEY: str = ""
    # Exa 接入（Learning 课程 agent 研究工具裁剪，task-3553）。为空字符串时
    # CourseAgentRunner.build_course_agent() 不挂研究工具（优雅降级），配置后则给课程 agent 追加
    # ExaTools + Context7 MCPTools；与 API_KEY（AntLLM）/ DEEPSEEK_API_KEY 解耦，
    # 老特性不受影响。
    EXA_API_KEY: str = ""
    LEARNING_DATABASE_URL: str = ""
    # Learning 课程包根目录（所有学习资源的根，courses 包一层在其下）。
    # 为空字符串时用默认值 <backend>/tmp/learning；配置为绝对或相对路径时
    # 作为课程包根目录（相对路径相对于进程 CWD）。
    LEARNING_ROOT_DIR: str = ""
    # Learning pending 生成状态超时（分钟）：POST /courses 先落 pending 再异步生成，
    # 若任务丢失（broker / worker 故障）记录会永久 pending、前端无限轮询。读取路径上
    # 超过该时长的 pending 视为生成失败（LearningProgressService.get_progress_or_expire
    # 置 failed）。默认 15 分钟，远高于前端轮询超时（POLL_TIMEOUT_MS=120s）与正常
    # agent run 耗时，避免误伤慢生成。
    LEARNING_PENDING_TTL_MINUTES: int = 15
    # WebAuthn / Passkey settings
    WEBAUTHN_RP_ID: str = "kanocifer.chat"
    WEBAUTHN_ORIGIN: str = "https://kanocifer.chat"
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    GITHUB_REDIRECT_URI: str = ""
    FRONTEND_URL: str = "https://kanocifer.chat"
    SEND_BOOT_EMAIL: bool = True
    ADMIN_EMAIL: str = ""
    FEISHU_WEBHOOK_URL: str = ""
    VITE_JS_API_TOKEN: str = ""
    AMAP_SECURITY_CODE: str = ""
    AMAP_WEB_KEY: str = ""
    # 允许获取高德安全密钥的前端来源
    AMAP_KEY_ALLOWED_ORIGINS: str = (
        "http://localhost:5173,http://localhost:5174,"
        "http://127.0.0.1:5173,http://127.0.0.1:5174,"
        "https://kanocifer.chat,https://m.kanocifer.chat"
    )
    JWT_PRIVATE_KEY: str = ""
    # Cookie 跨域配置
    COOKIE_DOMAIN: str = ""
    # Redis 配置
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_MAX_CONNECTIONS: int = 50
    RABBITMQ_URL: str = "amqp://guest:guest@localhost:5672/"
    # Go 后端 base URL（v3 天气数据源）。Python 钓鱼指数端点通过它获取天气数据。
    GO_BACKEND_URL: str = "http://127.0.0.1:8001"
    ADMIN_USER_IDS: list[int] = [1, 2]
    # Refresh token 强制 Redis 校验开关。开启后,refresh 必须在 Redis 中有对应
    # 白名单条目,否则拒绝。关闭时保持向后兼容(无条目即放行,不检查)。
    # 建议:部署稳定后置 True。
    ENFORCE_REDIS_REFRESH: bool = False
    SAVE_LOGS: bool = True
    # 终端/文件日志级别（规约见 docs/rules/logging.md）
    LOG_LEVEL: str = "INFO"
    # DB 持久化阈值：仅 ≥ 此级别入库，避免 Log 表随业务量膨胀（默认 WARNING）
    DB_LOG_LEVEL: str = "WARNING"
    # 日志目录。空字符串=用默认 backend/logs/；_info/__error 后缀由 logger 自动追加。
    LOG_DIR: str = ""

    # 可信反向代理（逗号分隔 IP 或 CIDR），如 Nginx：仅这些来源的
    # X-Forwarded-For 末段被当作真实客户端 IP（uvicorn forwarded_allow_ips）。
    # 默认仅信任同机反代（loopback）；nginx 在其它网段/容器时需显式补充其地址。
    # 注意：若 nginx 前还有 CDN（EdgeOne 等），须在 nginx 用 realip 模块把真实
    # 客户端重写到 $remote_addr（见 docs/rules/environment.md），否则末段是 CDN
    # 节点 IP。不要在此把 CDN 回源段加为可信——CDN 的 XFF 是追加语义。
    TRUSTED_PROXIES: str = "127.0.0.1,::1"

    MEDIA_PATH: str = ""

    model_config = SettingsConfigDict(
        env_file=get_env_file_path(),
        env_file_encoding="utf-8",
        extra="ignore",
    )


# 实例化并导出
settings = Settings()


def get_settings() -> Settings:
    return settings
