"""通知业务服务 —— 桥接领域逻辑与通用通知传输插件。"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.notification.context import context_from_config
from app.notification.payloads import SubscriptionPayload
from app.notification.ports import DbProfilePort, ProfilePort
from app.notification.renderers import render_subscription_reminder
from app.plugins.notification import NotificationPlugin
from app.repositories.notification_repo import NotificationRepo


class NotificationService:
    """通知服务 —— 负责订阅/设备提醒的发送编排。

    依赖：
    - ``plugin``: 通用通知传输插件（渠道注册表可注入，便于测试）。
    - ``repo``: 通知数据仓库。
    - ``profile_port``: 可选的 Profile 查询端口；不传则使用默认
      :class:`DbProfilePort`（查 Postgres）。
    """

    def __init__(
        self,
        plugin: NotificationPlugin,
        repo: NotificationRepo,
        profile_port: ProfilePort | None = None,
    ) -> None:
        self._plugin = plugin
        self.repo = repo
        self._profile_port = profile_port

    async def get_all_active_subscriptions(self, session: AsyncSession):
        return await self.repo.get_all_active_subscriptions(session)

    async def send_reminder(
        self,
        payload: SubscriptionPayload,
        config: dict,
        user_id: int,
        channels: list[str],
    ) -> dict[str, bool]:
        ctx = await context_from_config(
            user_id, config, profile_port=self._profile_port
        )
        message = render_subscription_reminder(payload)
        return await self._plugin.notify(channels, message, ctx)
