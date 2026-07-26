# config.py

from functools import lru_cache

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
    # WebAuthn / Passkey settings
    WEBAUTHN_RP_ID: str = "kanocifer.chat"
    WEBAUTHN_ORIGIN: str = "https://kanocifer.chat"
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    GITHUB_REDIRECT_URI: str = ""
    FRONTEND_URL: str = "https://kanocifer.chat"
    GITEE_WEBHOOK_SECRET: str | None = None
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
    QWEATHER_BASE_URL: str = ""
    # Go 后端 base URL（v3 天气数据源）。Python 钓鱼指数端点通过它获取天气数据。
    GO_BACKEND_URL: str = "http://127.0.0.1:8001"
    ENABLE_TRACKING: bool = True
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

    MEDIA_PATH: str = ""

    model_config = SettingsConfigDict(
        env_file=get_env_file_path(),
        env_file_encoding="utf-8",
        extra="ignore",
    )


# 实例化并导出
settings = Settings()


@lru_cache
def get_settings() -> Settings:
    return settings
