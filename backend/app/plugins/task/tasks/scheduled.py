"""定时任务：RSS 刷新、每日统计、待办提醒。

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


def _build_daily_summary_message(
    *,
    total_visits: int,
    unique_visitors: int,
    unique_ips: int,
    top_pages: list[dict[str, int | str]],
    browser_stats: list[dict[str, int | str | None]],
    os_stats: list[dict[str, int | str | None]],
    device_stats: list[dict[str, int | str | None]],
) -> str:
    lines: list[str] = []
    lines.append("**核心指标**")
    lines.append(f"- **总访问量**: {total_visits} 次")
    lines.append(f"- **独立访客**: {unique_visitors} 人")
    lines.append(f"- **独立 IP**: {unique_ips} 个")
    lines.append("")

    if top_pages:
        lines.append("**热门页面 Top 5**")
        for item in top_pages:
            count = int(item.get("count") or 0)
            page_path = str(item.get("page_path") or "未知页面")
            percentage = count / total_visits * 100 if total_visits > 0 else 0
            lines.append(f"- {page_path}: {count} 次 ({percentage:.1f}%)")
        lines.append("")

    if browser_stats:
        lines.append("**浏览器分布**")
        for item in browser_stats:
            count = int(item.get("count") or 0)
            percentage = (
                count / unique_visitors * 100 if unique_visitors > 0 else 0
            )
            browser_name = str(item.get("browser_name") or "未知")
            lines.append(f"- {browser_name}: {count} 人 ({percentage:.1f}%)")
        lines.append("")

    if os_stats:
        lines.append("**操作系统分布**")
        for item in os_stats:
            count = int(item.get("count") or 0)
            percentage = (
                count / unique_visitors * 100 if unique_visitors > 0 else 0
            )
            os_name = str(item.get("os_name") or "未知")
            lines.append(f"- {os_name}: {count} 人 ({percentage:.1f}%)")
        lines.append("")

    if device_stats:
        lines.append("**设备类型分布**")
        for item in device_stats:
            count = int(item.get("count") or 0)
            percentage = (
                count / unique_visitors * 100 if unique_visitors > 0 else 0
            )
            device_type = str(item.get("device_type") or "未知")
            lines.append(f"- {device_type}: {count} 人 ({percentage:.1f}%)")
        lines.append("")

    lines.append("---")
    lines.append("> 此消息由 BOT 自动发送")
    return "\n".join(lines)


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
        from app.core.container import get_rss_service

        async with get_rss_service(context.state.redis) as rss_service:
            stats = await rss_service.refresh_all_feeds()

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


@broker.task(
    schedule=[
        {
            "cron": "0 8 * * *",
            "schedule_id": "daily_visitor_summary",
            "cron_offset": "Asia/Shanghai",
        }
    ]
)
async def send_daily_summary(context: Context = TaskiqDepends()):
    """每天早上8点发送前一天的访问统计摘要飞书消息给管理员"""
    settings = get_settings()

    if not settings.FEISHU_WEBHOOK_URL:
        logger.warning(
            "feishu webhook not configured, skip daily summary notification"
        )
        return

    today_shanghai = datetime.now(SHANGHAI_TZ).replace(
        hour=0, minute=0, second=1
    )
    target_day_shanghai = today_shanghai - timedelta(days=1)
    target_day_utc = target_day_shanghai.astimezone(UTC)

    try:
        from app.core.container import get_monitor_service

        redis = context.state.redis
        if redis is None:
            logger.warning(
                "taskiq redis not initialized, skip daily summary notification"
            )
            return

        async with get_monitor_service() as monitor_service:
            stats = await monitor_service.get_daily_summary(target_day_utc)

        total_visits = stats["total_visits"]
        unique_visitors = stats["unique_visitors"]
        unique_ips = stats["unique_ips"]
        top_pages = stats["top_pages"]
        browser_stats = stats["browser_stats"]
        os_stats = stats["os_stats"]
        device_stats = stats["device_stats"]
        yesterday_str = stats["date"]

        message = _build_daily_summary_message(
            total_visits=total_visits,
            unique_visitors=unique_visitors,
            unique_ips=unique_ips,
            top_pages=top_pages,
            browser_stats=browser_stats,
            os_stats=os_stats,
            device_stats=device_stats,
        )
        if not message.strip():
            logger.warning("daily summary message empty, skip sending")
            return

        title = f"昨日访问统计 - {yesterday_str}"

        await _send_notification(title=title, body=message, color="blue")

    except Exception as e:
        error_msg = str(e)
        logger.error(f"daily summary notification failed: {error_msg}")
        await _send_notification(
            title="每日访问统计失败",
            body=f"**错误信息**: `{error_msg}`",
            color="red",
        )
        raise
