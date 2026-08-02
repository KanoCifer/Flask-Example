"""定时任务：RSS 刷新、待办提醒。

Go 端已接管 visitor_track 直写 PostgreSQL，本模块不再承担数据迁移职责。
"""

from __future__ import annotations

import time
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

import orjson
from taskiq import Context, TaskiqDepends

from app.core.config import get_settings
from app.core.logger import logger
from app.plugins.notification import Message, NotificationContext, notify
from app.plugins.task.task import broker

SHANGHAI_TZ = ZoneInfo("Asia/Shanghai")


def _feishu_ctx() -> NotificationContext:
    """Build NotificationContext for the global Feishu webhook."""
    return NotificationContext(
        feishu_webhook_url=get_settings().FEISHU_WEBHOOK_URL
    )


async def _send_notification(
    title: str,
    body: str,
    *,
    color: str | None = None,
    ctx: NotificationContext | None = None,
) -> None:
    """Send a notification via the plugin as a Feishu interactive card, swallowing errors."""
    try:
        await notify(
            channels=["feishu"],
            message=Message(title=title, body=body, color=color),
            ctx=ctx or _feishu_ctx(),
        )
    except Exception as e:
        logger.error(f"Failed to send notification: {e!r}")


@broker.task(
    schedule=[
        {
            "cron": "0 10 * * *",
            "schedule_id": "rss_refresh",
            "cron_offset": "Asia/Shanghai",
        }
    ]
)
async def refresh_rss_feeds(context: Context = TaskiqDepends()):
    """Daily RSS refresh at 10:00 (Asia/Shanghai) for all users."""
    start_time = time.perf_counter()
    logger.info("[RSSRefreshJob] starting RSS feed refresh job")
    settings = get_settings()

    if not settings.FEISHU_WEBHOOK_URL:
        logger.warning(
            "feishu webhook not configured, RSS refresh result will not notify"
        )

    try:
        # services 来自 TaskiqState.state.services（_on_worker_startup 装配）。
        stats = await context.state.services.rss_svc.refresh_all_feeds()

        duration = time.perf_counter() - start_time
        logger.info(
            f"[RSSRefreshJob] job completed | duration={duration:.2f}s | "
            f"total_feeds={stats['total_feeds']} | success={stats['success']} | "
            f"failed={stats['failed']} | new_articles={stats['new_articles']}"
        )

        if stats["total_feeds"] == 0:
            message = (
                "> 没有配置任何 RSS 源。\n\n请前往设置页面添加 RSS 源。"
            )
        else:
            message = (
                f"**总 RSS 源**: {stats['total_feeds']}\n"
                f"**成功刷新**: {stats['success']}\n"
                f"**失败**: {stats['failed']}\n"
                f"**新增文章**: {stats['new_articles']}\n\n"
                f"> 耗时: {duration:.2f}s"
            )

        await _send_notification(
            title="RSS 刷新完成", body=message, color="green"
        )

        return {
            "status": "success",
            **stats,
            "duration": f"{duration:.2f}s",
        }

    except Exception as e:
        error_msg = str(e)
        duration = time.perf_counter() - start_time
        logger.exception(
            f"[RSSRefreshJob] job failed | duration={duration:.2f}s | error={error_msg}"
        )
        message = f"**错误信息**: `{error_msg}`\n\n> 耗时: {duration:.2f}s"
        await _send_notification(
            title="RSS 刷新失败", body=message, color="red"
        )
        return {
            "status": "failed",
            "error": str(e),
            "duration": f"{duration:.2f}s",
        }
