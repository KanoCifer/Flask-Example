from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import DeviceTrack
from app.repositories.device_repo import DeviceRepo
from app.services.base import BaseService


class DeviceService(BaseService):
    def __init__(self, repo: DeviceRepo):
        self.repo = repo

    async def get_owned_device(
        self, session: AsyncSession, device_id: int, user_id: int
    ) -> DeviceTrack:
        """Return device if found and owned, otherwise raise."""
        device = await self.repo.get_device_track_by_id(session, device_id)
        return self.get_owned(device, user_id, "设备不存在", "无权访问此设备")

    async def get_user_devices(
        self, session: AsyncSession, user_id: int
    ) -> Sequence[DeviceTrack]:
        return await self.repo.get_device_tracks_by_user_id(
            session, user_id
        )

    async def create_device(
        self, session: AsyncSession, user_id: int, **data: str
    ) -> DeviceTrack:
        return await self.repo.create_device_track(session, user_id, **data)

    async def update_device(
        self, session: AsyncSession, device_id: int, **data: str
    ) -> DeviceTrack | None:
        return await self.repo.update_device_track(
            session, device_id, **data
        )

    async def delete_device(
        self, session: AsyncSession, device_id: int
    ) -> bool:
        return await self.repo.delete_device_track_by_id(
            session, track_id=device_id
        )

    async def update_device_status(
        self, session: AsyncSession, device_id: int, status: str
    ) -> DeviceTrack | None:
        """更新设备状态"""
        return await self.repo.update_device_track(
            session, device_id, status=status
        )

    async def update_device_reminder_config(
        self, session: AsyncSession, device_id: int, reminder_config: dict
    ) -> DeviceTrack | None:
        """更新设备提醒配置"""
        return await self.repo.update_device_track(
            session, device_id, reminder_config=reminder_config
        )

    async def get_upcoming_milestone_devices(
        self, session: AsyncSession, user_id: int, days_ahead: int = 30
    ) -> Sequence[DeviceTrack]:
        """获取即将到达里程碑的设备（未来N天内）。

        里程碑计算逻辑属于业务规则，放在服务层而非仓库层。
        """
        devices = await self.repo.get_device_tracks_by_user_id(
            session, user_id
        )
        active_devices = [d for d in devices if d.status == "active"]

        today = datetime.now(UTC).date()
        future_date = today + timedelta(days=days_ahead)

        upcoming = []
        for device in active_devices:
            days_owned = (today - device.purchase_date.date()).days
            future_days = (future_date - device.purchase_date.date()).days

            reminder_config = device.reminder_config or {}
            milestones = reminder_config.get(
                "milestones", [100, 365, 730, 1000, 1825]
            )

            for milestone in milestones:
                if days_owned <= milestone <= future_days:
                    upcoming.append(device)
                    break

        return upcoming
