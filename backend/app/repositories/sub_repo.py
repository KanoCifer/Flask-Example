from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.models import Profile, Subscription


class SubRepo:
    async def get_all_subscriptions(
        self, session: AsyncSession, user_id: int
    ) -> list[Subscription]:
        """获取用户的所有订阅"""
        stmt = select(Subscription).where(Subscription.user_id == user_id)
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def get_subscription_by_id(
        self, session: AsyncSession, sub_id: int
    ) -> Subscription | None:
        """根据订阅ID获取订阅详情"""
        stmt = (
            select(Subscription)
            .where(Subscription.id == sub_id)
            .options(selectinload(Subscription.user))
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def create_one_subscription(
        self,
        session: AsyncSession,
        user_id: int,
        **sub_data: Any,
    ) -> Subscription:
        """创建新的订阅"""

        next_billing_date = sub_data.get("next_billing_date")
        if isinstance(next_billing_date, str):
            sub_data["next_billing_date"] = datetime.fromisoformat(
                next_billing_date
            )
        subscription = Subscription(user_id=user_id, **sub_data)
        session.add(subscription)
        await session.flush()
        await session.refresh(subscription)
        return subscription

    async def update_subscription(
        self,
        session: AsyncSession,
        sub_id: int,
        **update_data: Any,
    ) -> Subscription | None:
        """更新订阅信息"""
        subscription = await self.get_subscription_by_id(session, sub_id)
        if subscription is None:
            return None
        for key, value in update_data.items():
            if value is not None:
                if key == "next_billing_date" and isinstance(value, str):
                    value = datetime.fromisoformat(value)
                setattr(subscription, key, value)
        await session.flush()
        await session.refresh(subscription)
        return subscription

    async def delete_subscription(
        self, session: AsyncSession, sub_id: int
    ) -> bool:
        """删除订阅"""
        subscription = await self.get_subscription_by_id(session, sub_id)
        if subscription is None:
            return False
        await session.delete(subscription)
        return True

    async def update_status(
        self, session: AsyncSession, sub_id: int, new_status: str
    ) -> Subscription | None:
        """更新订阅状态"""
        subscription = await self.get_subscription_by_id(session, sub_id)
        if subscription is None:
            return None
        subscription.status = new_status
        await session.flush()
        await session.refresh(subscription)
        return subscription

    async def update_reminder_config(
        self, session: AsyncSession, sub_id: int, new_config: dict
    ) -> Subscription | None:
        """更新订阅提醒配置"""
        subscription = await self.get_subscription_by_id(session, sub_id)
        if subscription is None:
            return None
        subscription.reminder_config = new_config
        await session.flush()
        await session.refresh(subscription)
        return subscription

    async def get_active_subscriptions(
        self, session: AsyncSession
    ) -> list[Subscription]:
        """获取所有活跃订阅"""
        stmt = select(Subscription).where(Subscription.status == "active")
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def get_global_notification_config(
        self, session: AsyncSession, user_id: int
    ) -> dict:
        """获取用户的全局通知配置"""
        stmt = select(Profile).where(Profile.user_id == user_id)
        result = await session.execute(stmt)
        profile = result.scalar_one_or_none()
        if profile is None:
            return {}

        config = {
            "email": profile.email,
            "feishu_webhook_url": profile.feishu_webhook_url,
            "bark_device_key": profile.bark_device_key,
        }
        return config

    async def update_global_notification_config(
        self, session: AsyncSession, user_id: int, config_data: dict
    ) -> dict:
        """更新用户的全局通知配置"""
        stmt = select(Profile).where(Profile.user_id == user_id)
        result = await session.execute(stmt)
        profile = result.scalar_one_or_none()
        if profile is None:
            return {}

        for key, value in config_data.items():
            if value is not None and hasattr(profile, key):
                setattr(profile, key, value)

        await session.flush()
        await session.refresh(profile)

        updated_config = {
            "email": profile.email,
            "feishu_webhook_url": profile.feishu_webhook_url,
            "bark_device_key": profile.bark_device_key,
        }
        return updated_config
