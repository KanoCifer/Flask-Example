from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime

from beanie import init_beanie
from fastapi import FastAPI

from app.api.des import (
    close_db_connections,
    close_mongo_client,
    close_redis,
    init_mongo,
    init_redis,
    limiter,
)
from app.appstate import new_app_state
from app.core import get_settings, register_exception_handlers
from app.core import logger as app_logger
from app.core.logger import drain_log_queue, start_log_worker
from app.middleware import register_middleware
from app.models.changelog import Changelog
from app.models.fishing import FishingModelMeta, FishingRecord
from app.models.friendlink import FriendLinks
from app.models.rss import RssArticle
from app.models.subscription import SubscriptionLog
from app.plugins.cache import close_cache_redis
from app.plugins.notification import Message, NotificationContext, notify
from app.plugins.task import broker
from app.router import register_router
from app.services.event_service import record_event


async def initialize_resources(app: FastAPI):
    """初始化所有资源连接：MongoDB、Beanie、Redis、Taskiq"""
    await init_mongo(app)
    await init_beanie(
        database=app.state.mongo,
        document_models=[
            RssArticle,
            SubscriptionLog,
            FishingRecord,
            FishingModelMeta,
            FriendLinks,
            Changelog,
        ],
    )
    app.state.redis = await init_redis()

    # 构造 service 单例，挂载到 app.state.services（Go 端 app.NewAppState 对齐）。
    app.state.services = new_app_state(app.state.redis)

    # Web 进程启动 broker 以便 .kiq() 入队；worker 进程自管 broker，跳过避免重复启动。
    if not broker.is_worker_process:
        try:
            await broker.startup()
            app_logger.info("Taskiq broker started successfully")
        except Exception as e:
            app_logger.warning(f"Taskiq broker failed to start: {e!s}")

    # 启动日志入库 worker（logger.WARNING+ 经 asyncio.Queue 异步落库）
    app.state.log_worker = start_log_worker()

    app_logger.debug(f"Settings:{get_settings().model_dump()}")
    app_logger.info("FastAPI started successfully.")

    if app.state.redis is not None and get_settings().SEND_BOOT_EMAIL:
        try:
            now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            # 分布式锁：多 worker 并发启动时，只有第一个抢到锁的进程发送启动通知，
            # 其余进程跳过，避免重复发送。锁带 TTL 兜底异常退出未释放的情况。
            acquired = await app.state.redis.set(
                "notify:boot:lock", now, nx=True, ex=60
            )
            if not acquired:
                app_logger.info("启动通知已由其它 worker 发送，跳过")
            else:
                await record_event(
                    "startup", f"API服务启动｜时间：{now}", source="boot"
                )
                await notify(
                    channels=["feishu"],
                    message=Message(
                        title="Kuroome Blog API 启动通知",
                        body=f"Kuroome Blog API 已成功启动！当前时间：{now}",
                    ),
                    ctx=NotificationContext(
                        feishu_webhook_url=get_settings().FEISHU_WEBHOOK_URL
                    ),
                )
        except Exception:
            await record_event("notify_failure", "发送启动通知失败", source="boot")


async def cleanup_resources(app: FastAPI):
    """关闭所有资源连接：Redis、MongoDB、PostgreSQL、Taskiq"""
    # 先排空日志 queue，再关 DB —— 保证落库的日志不因 session 关闭而丢失
    if hasattr(app.state, "log_worker"):
        await drain_log_queue()
        app.state.log_worker.cancel()

    await close_redis(app)
    await close_cache_redis()
    await app.state.client.close()
    await close_mongo_client(app)
    await close_db_connections()

    if not broker.is_worker_process:
        try:
            await broker.shutdown()
            app_logger.info("Taskiq broker shutdown successfully")
        except Exception as e:
            app_logger.warning(f"Taskiq broker shutdown failed: {e!s}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    await initialize_resources(app)
    yield
    await cleanup_resources(app=app)


# 实例化 FastAPI 应用
app = FastAPI(
    title=get_settings().API_TITLE,
    description=get_settings().API_DESCRIPTION,
    version=get_settings().API_VERSION,
    lifespan=lifespan,
)

# Attach slowapi limiter to app state
app.state.limiter = limiter

register_middleware(app=app)
register_exception_handlers(app=app)
register_router(app=app)
