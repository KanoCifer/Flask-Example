"""飞书 Webhook 渠道 —— 以 interactive card 2.0 发送通知。

对齐 Go 端 ``go-backend/pkg/notification/feishu.go`` 的 ``buildFeishuCard``：
header 显示 title（模板色由 ``Message.color`` 控制），body 用 markdown
渲染正文。
"""

from __future__ import annotations

import httpx2

from app.core.config import get_settings
from app.core.logger import logger
from app.plugins.notification import Message, NotificationContext

_TIMEOUT = httpx2.Timeout(10.0)

# 飞书卡片 header 默认模板色（对齐 Go 端 feishuDefaultCardColor）。
_DEFAULT_CARD_COLOR = "green"


def _build_feishu_card(title: str, body: str, color: str) -> dict:
    """构造飞书 interactive card 2.0 结构。

    对齐 Go 端 ``buildFeishuCard``：schema 2.0、header 显示 title +
    模板色、body 用 markdown 渲染正文。
    """
    return {
        "schema": "2.0",
        "config": {"update_multi": True},
        "header": {
            "title": {"tag": "plain_text", "content": title},
            "template": color,
        },
        "body": {
            "direction": "vertical",
            "padding": "12px",
            "elements": [
                {"tag": "markdown", "content": body},
            ],
        },
    }


class FeishuChannel:
    """飞书 Webhook 传输 adapter —— 以 interactive card 2.0 发送。

    webhook_url 来源（保持重构前兼容优先级）：
    1. ``ctx.feishu_webhook_url``（订阅级 reminder_config）；
    2. 全局 settings.FEISHU_WEBHOOK_URL。
    """

    name = "feishu"

    async def send(self, message: Message, ctx: NotificationContext) -> bool:
        webhook_url = (
            ctx.feishu_webhook_url or get_settings().FEISHU_WEBHOOK_URL
        )
        if not webhook_url:
            logger.warning("[Feishu] FEISHU_WEBHOOK_URL not configured")
            return False

        color = message.color or _DEFAULT_CARD_COLOR
        card = _build_feishu_card(message.title, message.body, color)
        try:
            async with httpx2.AsyncClient(timeout=_TIMEOUT) as client:
                response = await client.post(url=webhook_url, json={
                    "msg_type": "interactive",
                    "card": card,
                })
                response.raise_for_status()
                body = response.json()
                code = body.get("code", body.get("StatusCode"))
                if code not in (0, "0"):
                    logger.error(
                        f"[Feishu] API error: code={code} body={body}"
                    )
                    return False
            logger.info(f"[Feishu] card sent: {message.title} (color={color})")
            return True
        except Exception as e:
            logger.error(f"[Feishu] Failed to send card: {e!r}")
            return False
