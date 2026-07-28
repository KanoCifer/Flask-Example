from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Subscription


class NotificationRepo:
    async def get_all_active_subscriptions(
        self,
        session: AsyncSession,
    ) -> list[Subscription]:
        """获取所有活跃订阅"""
        stmt = select(Subscription).where(Subscription.status == "active")
        result = await session.execute(stmt)
        return list(result.scalars().all())
