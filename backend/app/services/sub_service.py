from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Subscription
from app.repositories.sub_repo import SubRepo
from app.services.base import BaseService


class SubService(BaseService):
    def __init__(self, repo: SubRepo) -> None:
        self.sub_repo = repo

    async def get_owned_subscription(
        self, session: AsyncSession, sub_id: int, user_id: int
    ) -> Subscription:
        """Return subscription if found and owned, otherwise raise."""
        sub = await self.sub_repo.get_subscription_by_id(session, sub_id)
        return self.get_owned(sub, user_id, "订阅不存在", "无权访问此订阅")

    async def get_all_subscriptions(
        self, session: AsyncSession, user_id: int
    ) -> list[Subscription]:
        return await self.sub_repo.get_all_subscriptions(session, user_id)

    async def create_one_subscription(
        self, session: AsyncSession, user_id: int, **sub_data,
    ) -> Subscription:
        return await self.sub_repo.create_one_subscription(
            session, user_id, **sub_data,
        )

    async def update_subscription(
        self, session: AsyncSession, sub_id: int, **update_data,
    ) -> Subscription | None:
        return await self.sub_repo.update_subscription(
            session, sub_id, **update_data,
        )

    async def delete_subscription(
        self, session: AsyncSession, sub_id: int,
    ) -> bool:
        return await self.sub_repo.delete_subscription(session, sub_id)

    async def update_status(
        self, session: AsyncSession, sub_id: int, new_status: str,
    ) -> Subscription | None:
        return await self.sub_repo.update_status(session, sub_id, new_status)

    async def update_reminder_config(
        self, session: AsyncSession, sub_id: int, config_data: dict,
    ) -> Subscription | None:
        return await self.sub_repo.update_reminder_config(
            session, sub_id, config_data,
        )

    async def get_due_subscriptions(
        self, session: AsyncSession,
    ) -> list[Subscription]:
        """Return active subscriptions past their billing date.

        The "due" rule — active AND next_billing_date <= now — lives here
        in the service layer, not in the repo.
        """
        active_subs = await self.sub_repo.get_active_subscriptions(session)
        now = datetime.now(UTC)
        return [s for s in active_subs if s.next_billing_date <= now]

    async def get_user_global_reminder_config(
        self, session: AsyncSession, user_id: int,
    ) -> dict:
        return await self.sub_repo.get_global_notification_config(
            session, user_id,
        )

    async def update_user_global_reminder_config(
        self, session: AsyncSession, user_id: int, config_data: dict,
    ) -> dict:
        return await self.sub_repo.update_global_notification_config(
            session, user_id, config_data,
        )
