"""On-demand tasks: email, RSS persisting, cache writing."""

from __future__ import annotations

from email_validator import validate_email
from fastapi_mail import FastMail, MessageSchema, MessageType
from pydantic import EmailStr, NameEmail
from taskiq import Context, TaskiqDepends

from app.core.config import get_settings
from app.core.logger import logger
from app.core.mail import MailConfig
from app.plugins.task.task import broker
from app.schemas import EmailCodeContent


@broker.task
async def send_code(email: str, verification_code: str) -> None:
    """发送验证码邮件"""
    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:24px;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;">
<tr><td style="padding:32px 24px 16px;">
<p style="margin:0 0 16px;font-size:14px;color:#333333;">这是您的验证码：</p>
<p style="margin:0 0 24px;font-size:32px;font-weight:700;letter-spacing:4px;color:#1a1a1a;font-family:'SF Mono',Consolas,monospace;">{verification_code}</p>
<p style="margin:0;font-size:13px;color:#888888;">请在5分钟内使用。</p>
</td></tr>
</table>
</body>
</html>
"""
    valid_email: EmailStr = validate_email(email).email

    content = EmailCodeContent(
        recipient=valid_email,
        verification_code=verification_code,
        subject="kanocifer.chat 注册验证码",
        body=html,
    )

    message = MessageSchema(
        subject=content.subject,
        recipients=[NameEmail(name="ReadingList", email=str(valid_email))],
        body=content.body,
        subtype=MessageType.html,
    )
    fm = FastMail(MailConfig.conf)

    try:
        await fm.send_message(message)
        logger.info(f"✅验证码邮件已发送到 {email}")
    except Exception as e:
        logger.error(f"❌发送验证码邮件失败: {e!s}")
        raise e


@broker.task
async def save_to_mongo(
    feed_url: str,
    entries: list,
    user_id: int,
    context: Context = TaskiqDepends(),
) -> None:
    """Taskiq 将解析的 RSS 条目保存到 MongoDB 中。

    :param feed_url: RSS 源链接
    :param entries: 解析后的 RSS 条目列表
    :param user_id: 当前用户 ID
    """
    try:
        from app.main import app

        saved_count = await app.state.services.rss_svc.save_entries_to_mongo(
            feed_url=feed_url,
            entries=entries,
        )
        logger.info(
            f"Background task: RSS {feed_url} saved {saved_count} new articles for user {user_id}"
        )
    except Exception as e:
        logger.error(
            f"Background task failed: Error saving RSS {feed_url} for user {user_id}: {e!r}"
        )


@broker.task
async def save_cache_to_redis(
    key: str,
    value: str,
    expire: int = 3600,
    context: Context = TaskiqDepends(),
) -> None:
    """将总结结果存储到 Redis 中，供后续查询使用

    :param key: Redis 键
    :param value: Redis 值
    :param expire: 过期时间，单位为秒，默认为 3600（1小时）
    :param context: Taskiq 上下文对象，自动注入
    """
    try:
        await context.state.redis.set(key, value, ex=expire)
    except Exception as e:
        logger.error(f"❌Failed to save cache to Redis: {e!r}")
