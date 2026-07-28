"""Taskiq broker factory + worker lifecycle events.

The broker is a module-level singleton (required by @broker.task import-time
decoration). Callers drive its lifecycle directly from the FastAPI lifespan
through ``broker.startup()`` / ``broker.shutdown()``, guarded by
``broker.is_worker_process`` so the web process connects to RabbitMQ (enabling
``.kiq()``) while the worker process — which manages its own broker startup —
does not double-start.
"""

from __future__ import annotations

from beanie import init_beanie
from pymongo import AsyncMongoClient
from redis.asyncio import ConnectionPool
from redis.asyncio import Redis as AsyncRedis
from taskiq import TaskiqEvents, TaskiqState
from taskiq.middlewares import SmartRetryMiddleware
from taskiq_aio_pika import AioPikaBroker
from taskiq_redis import RedisAsyncResultBackend

from app.core.config import get_settings
from app.core.logger import logger
from app.plugins.task.middlewares import TraceMiddleware

# ---------------------------------------------------------------------------
# Module-level broker — must exist at import time for @broker.task decorators
# ---------------------------------------------------------------------------

_connection_pool = ConnectionPool.from_url(
    get_settings().REDIS_URL,
    decode_responses=True,
    max_connections=get_settings().REDIS_MAX_CONNECTIONS,
)

_result_backend = RedisAsyncResultBackend(
    redis_url=get_settings().REDIS_URL,
    result_ex_time=86400,
)

broker: AioPikaBroker = (
    AioPikaBroker(
        get_settings().RABBITMQ_URL,
        heartbeat=120,
        connection_name="taskiq-worker",
    )
    .with_result_backend(_result_backend)
    .with_middlewares(
        SmartRetryMiddleware(
            default_retry_count=3,
            default_delay=2,
            use_jitter=True,
            use_delay_exponent=True,
            max_delay_exponent=6,
        ),
        TraceMiddleware(),
    )
)

logger.bind(component="taskiq").info("broker initialized")


# ---------------------------------------------------------------------------
# Worker lifecycle events
# ---------------------------------------------------------------------------


@broker.on_event(TaskiqEvents.WORKER_STARTUP)
async def _on_worker_startup(state: TaskiqState) -> None:
    """Initialize Redis, MongoDB, Beanie, and AppState per worker process."""
    state.redis = AsyncRedis(connection_pool=_connection_pool)

    state.mongo_client = AsyncMongoClient(get_settings().MONGO_URI)
    mongo_db = state.mongo_client["readinglist"]

    from app.models.rss import RssArticle, RssFeed
    from app.models.subscription import SubscriptionLog

    await init_beanie(
        database=mongo_db,
        document_models=[
            RssArticle,
            RssFeed,
            SubscriptionLog,
        ],
    )
    state.mongo = mongo_db

    # 构造 AppState 单例并挂载到 app.state.services，对齐 web 进程
    # initialize_resources()（main.py:62）。scheduled task 通过
    # container.get_rss_service() 访问 service，后者读取 app.state.services，
    # 若此处未挂载则报 AttributeError。
    from app.appstate import new_app_state
    from app.main import app

    app.state.services = new_app_state(state.redis)


@broker.on_event(TaskiqEvents.WORKER_SHUTDOWN)
async def _on_worker_shutdown(state: TaskiqState) -> None:
    await state.redis.aclose()
    await state.mongo_client.close()
