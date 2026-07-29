from collections.abc import Sequence
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.des.auth import manager
from app.api.des.db import get_session
from app.appstate import AppState, get_app_state
from app.core.exceptions import APIError, NotFoundError
from app.core.response import APIResponse
from app.models.models import DeviceTrack
from app.schemas.device import (
    DeviceInput,
    DeviceResponse,
    DeviceStatusUpdate,
    DeviceUpdateInput,
    ReminderConfigUpdate,
)

router = APIRouter(prefix="/device", tags=["device"])


@router.get("")
async def get_user_devices(
    user: int = Depends(manager),
    state: AppState = Depends(get_app_state),
    session: AsyncSession = Depends(get_session),
):
    """获取用户的设备列表"""
    devices: Sequence[DeviceTrack] = await state.device_svc.get_user_devices(
        session, user
    )
    response: list[DeviceResponse] = [
        DeviceResponse.model_validate(device) for device in devices
    ]
    return APIResponse(
        data={"devices": response}, message="获取设备列表成功"
    )


@router.get("/upcoming")
async def get_upcoming_devices(
    days_ahead: int = 30,
    user: int = Depends(manager),
    state: AppState = Depends(get_app_state),
    session: AsyncSession = Depends(get_session),
):
    """获取即将到达里程碑的设备"""
    devices: Sequence[
        DeviceTrack
    ] = await state.device_svc.get_upcoming_milestone_devices(
        session, user, days_ahead
    )
    response: list[DeviceResponse] = [
        DeviceResponse.model_validate(device) for device in devices
    ]
    return APIResponse(
        data={"devices": response}, message="获取即将到达里程碑的设备成功"
    )


@router.get("/{device_id}")
async def get_device_by_id(
    device_id: int,
    user: int = Depends(manager),
    state: AppState = Depends(get_app_state),
    session: AsyncSession = Depends(get_session),
):
    """根据设备ID获取设备信息"""
    device = await state.device_svc.get_owned_device(session, device_id, user)
    response: DeviceResponse = DeviceResponse.model_validate(device)
    return APIResponse(
        data={"device": response}, message="获取设备信息成功"
    )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_device(
    device_input: DeviceInput,
    user: int = Depends(manager),
    state: AppState = Depends(get_app_state),
    session: AsyncSession = Depends(get_session),
):
    """创建新设备"""
    device: DeviceTrack = await state.device_svc.create_device(
        session, user_id=user, **device_input.model_dump()
    )
    response: DeviceResponse = DeviceResponse.model_validate(device)
    return APIResponse(
        data={"device": response},
        message="创建设备成功",
    )


@router.put("/{device_id}")
async def update_device(
    device_id: int,
    device_input: DeviceUpdateInput,
    user: int = Depends(manager),
    state: AppState = Depends(get_app_state),
    session: AsyncSession = Depends(get_session),
):
    """更新设备信息"""
    await state.device_svc.get_owned_device(session, device_id, user)
    updated_device: DeviceTrack | None = await state.device_svc.update_device(
        session, device_id, **device_input.model_dump(exclude_unset=True)
    )
    if not updated_device:
        raise APIError(message="设备信息不存在或更新失败")
    response: DeviceResponse = DeviceResponse.model_validate(updated_device)
    return APIResponse(
        data={"device": response}, message="更新设备信息成功"
    )


@router.delete("/{device_id}")
async def delete_device(
    device_id: int,
    user: int = Depends(manager),
    state: AppState = Depends(get_app_state),
    session: AsyncSession = Depends(get_session),
):
    """删除设备"""
    await state.device_svc.get_owned_device(session, device_id, user)
    if not await state.device_svc.delete_device(session, device_id):
        raise NotFoundError("设备删除失败")
    return APIResponse(message="删除设备成功")


@router.delete("")
async def delete_all_devices(
    user: int = Depends(manager),
    state: AppState = Depends(get_app_state),
    session: AsyncSession = Depends(get_session),
):
    """删除用户的所有设备"""
    await state.device_svc.repo.delete_device_tracks_by_user_id(session, user)
    return APIResponse(message="删除所有设备成功")


@router.patch("/{device_id}/status")
async def update_device_status(
    device_id: int,
    status_update: DeviceStatusUpdate,
    user: int = Depends(manager),
    state: AppState = Depends(get_app_state),
    session: AsyncSession = Depends(get_session),
):
    """更新设备状态（active/retired）"""
    await state.device_svc.get_owned_device(session, device_id, user)
    updated_device: DeviceTrack | None = (
        await state.device_svc.update_device_status(
            session, device_id, status=status_update.status
        )
    )
    if not updated_device:
        raise NotFoundError("设备状态更新失败")
    response: DeviceResponse = DeviceResponse.model_validate(updated_device)
    return APIResponse(
        data={"device": response}, message="更新设备状态成功"
    )


@router.patch("/{device_id}/reminders")
async def update_device_reminders(
    device_id: int,
    reminder_update: ReminderConfigUpdate,
    user: int = Depends(manager),
    state: AppState = Depends(get_app_state),
    session: AsyncSession = Depends(get_session),
):
    """更新设备提醒配置"""
    await state.device_svc.get_owned_device(session, device_id, user)
    updated_device: (
        DeviceTrack | None
    ) = await state.device_svc.update_device_reminder_config(
        session, device_id, reminder_config=reminder_update.reminder_config
    )
    if not updated_device:
        raise NotFoundError("提醒配置更新失败")
    response: DeviceResponse = DeviceResponse.model_validate(updated_device)
    return APIResponse(
        data={"device": response}, message="更新提醒配置成功"
    )


@router.post("/{device_id}/test-notification")
async def test_device_notification(
    device_id: int,
    user: int = Depends(manager),
    state: AppState = Depends(get_app_state),
    session: AsyncSession = Depends(get_session),
):
    """测试通知发送"""
    device = await state.device_svc.get_owned_device(session, device_id, user)

    from app.notification import DeviceNotificationPayload
    from app.notification.context import context_from_config
    from app.notification.renderers import render_device_milestone
    from app.plugins.notification import NotificationPlugin

    # 构建测试通知
    days_owned: int = (
        datetime.now(UTC).date() - device.purchase_date.date()
    ).days
    payload = DeviceNotificationPayload(
        title=f"测试通知 - {device.name}",
        body=f"这是一条测试通知，设备已使用 {days_owned} 天",
        name=device.name,
        price=device.price,
        currency=device.currency,
        purchase_date=device.purchase_date,
    )

    reminder_config = device.reminder_config or {}
    channels = reminder_config.get("channels", ["email"])

    ctx = await context_from_config(user, reminder_config)
    message = render_device_milestone(payload)
    plugin = NotificationPlugin()
    results = await plugin.notify(channels, message, ctx)

    return APIResponse(
        data={"results": results}, message="测试通知发送完成"
    )
