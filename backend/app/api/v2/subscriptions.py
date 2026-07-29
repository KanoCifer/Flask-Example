from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.des.auth import manager
from app.api.des.db import get_session
from app.appstate import AppState, get_app_state
from app.core.exceptions import APIError, NotFoundError
from app.core.response import APIResponse
from app.notification import NotificationPayload
from app.schemas.sub import (
    CreateOneSubRequest,
    GlobalConfigIn,
    SubResponse,
    TestNotificationRequest,
    UpdateSubRequest,
)

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


@router.get("")
async def get_subscriptions(
    current_user: int = Depends(manager),
    state: AppState = Depends(get_app_state),
    session: AsyncSession = Depends(get_session),
):
    """获取当前用户的订阅列表"""
    subscriptions = await state.sub_svc.get_all_subscriptions(
        session, current_user
    )
    response = [
        SubResponse.model_validate(sub).model_dump(mode="json")
        for sub in subscriptions
    ]
    return APIResponse(
        data={"subscriptions": response},
        message="获取订阅列表成功",
    )


@router.get("/upcoming")
async def get_upcoming_subscriptions(
    current_user: int = Depends(manager),
    state: AppState = Depends(get_app_state),
    session: AsyncSession = Depends(get_session),
):
    """获取即将到期的订阅"""
    due_subscriptions = await state.sub_svc.get_due_subscriptions(session)
    user_due_subs = [
        sub for sub in due_subscriptions if sub.user_id == current_user
    ]
    response = [
        SubResponse.model_validate(sub).model_dump(mode="json")
        for sub in user_due_subs
    ]
    return APIResponse(
        data={"subscriptions": response},
        message="获取即将到期的订阅成功",
    )


@router.get("/global-config")
async def get_global_notification_config(
    current_user: int = Depends(manager),
    state: AppState = Depends(get_app_state),
    session: AsyncSession = Depends(get_session),
) -> APIResponse:
    """获取用户的全局通知配置"""
    config = await state.sub_svc.get_user_global_reminder_config(
        session, user_id=current_user
    )
    return APIResponse(data={"config": config}, message="获取全局通知配置成功")


@router.put("/global-config")
async def update_global_notification_config(
    config_data: GlobalConfigIn,
    current_user: int = Depends(manager),
    state: AppState = Depends(get_app_state),
    session: AsyncSession = Depends(get_session),
) -> APIResponse:
    """更新用户的全局通知配置"""
    updated_config = await state.sub_svc.update_user_global_reminder_config(
        session, user_id=current_user, config_data=config_data.model_dump()
    )
    if updated_config is None:
        raise APIError(message="更新全局通知配置失败")
    return APIResponse(
        data={"config": updated_config}, message="更新全局通知配置成功"
    )


@router.get("/{sub_id}")
async def get_subscription(
    sub_id: int,
    current_user: int = Depends(manager),
    state: AppState = Depends(get_app_state),
    session: AsyncSession = Depends(get_session),
):
    """获取订阅详情"""
    subscription = await state.sub_svc.get_owned_subscription(
        session, sub_id, current_user
    )
    response = SubResponse.model_validate(subscription).model_dump(mode="json")
    return APIResponse(
        data={"subscription": response}, message="获取订阅详情成功"
    )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_subscription(
    sub_data: CreateOneSubRequest,
    current_user: int = Depends(manager),
    state: AppState = Depends(get_app_state),
    session: AsyncSession = Depends(get_session),
):
    """创建新的订阅"""
    subscription = await state.sub_svc.create_one_subscription(
        session, user_id=current_user, **sub_data.model_dump()
    )
    response = SubResponse.model_validate(subscription).model_dump(mode="json")
    return APIResponse(
        data={"subscription": response},
        message="创建订阅成功",
    )


@router.put("/{sub_id}")
async def update_subscription(
    sub_id: int,
    update_data: UpdateSubRequest,
    current_user: int = Depends(manager),
    state: AppState = Depends(get_app_state),
    session: AsyncSession = Depends(get_session),
):
    """更新订阅信息"""
    await state.sub_svc.get_owned_subscription(session, sub_id, current_user)
    updated_subscription = await state.sub_svc.update_subscription(
        session, sub_id, **update_data.model_dump(exclude_unset=True)
    )
    response = (
        SubResponse.model_validate(updated_subscription).model_dump(
            mode="json"
        )
        if updated_subscription
        else None
    )
    return APIResponse(data={"subscription": response}, message="更新订阅成功")


@router.delete("/{sub_id}")
async def delete_subscription(
    sub_id: int,
    current_user: int = Depends(manager),
    state: AppState = Depends(get_app_state),
    session: AsyncSession = Depends(get_session),
):
    """删除订阅"""
    await state.sub_svc.get_owned_subscription(session, sub_id, current_user)
    if not await state.sub_svc.delete_subscription(session, sub_id):
        raise NotFoundError("删除订阅失败")
    return APIResponse(message="删除订阅成功")


@router.patch("/{sub_id}/status")
async def update_subscription_status(
    sub_id: int,
    new_status: str,
    current_user: int = Depends(manager),
    state: AppState = Depends(get_app_state),
    session: AsyncSession = Depends(get_session),
):
    """更新订阅状态"""
    await state.sub_svc.get_owned_subscription(session, sub_id, current_user)
    updated_subscription = await state.sub_svc.update_status(
        session, sub_id, new_status
    )
    if updated_subscription is None:
        raise NotFoundError("更新订阅状态失败")
    response = SubResponse.model_validate(updated_subscription).model_dump(
        mode="json"
    )
    return APIResponse(
        data={"subscription": response}, message="更新订阅状态成功"
    )


@router.patch("/{sub_id}/reminders")
async def update_subscription_reminders(
    sub_id: int,
    reminder_data: dict,
    current_user: int = Depends(manager),
    state: AppState = Depends(get_app_state),
    session: AsyncSession = Depends(get_session),
):
    """更新订阅提醒"""
    await state.sub_svc.get_owned_subscription(session, sub_id, current_user)
    updated_subscription = await state.sub_svc.update_reminder_config(
        session, sub_id, reminder_data
    )
    if updated_subscription is None:
        raise NotFoundError("更新订阅提醒失败")
    response = SubResponse.model_validate(updated_subscription).model_dump(
        mode="json"
    )
    return APIResponse(
        data={"subscription": response}, message="更新订阅提醒成功"
    )


@router.post("/{sub_id}/test-notification")
async def test_subscription_notification(
    sub_id: int,
    test_config: TestNotificationRequest,
    current_user: int = Depends(manager),
    state: AppState = Depends(get_app_state),
    session: AsyncSession = Depends(get_session),
):
    """测试订阅通知"""
    subscription = await state.sub_svc.get_owned_subscription(
        session, sub_id, current_user
    )

    payload = NotificationPayload(
        title="测试通知",
        body=f"这是一条来自 {subscription.name} 的测试通知",
        subscription_name=subscription.name,
        provider=subscription.provider,
        price=subscription.price,
        currency=subscription.currency,
        days_until=0,
        next_billing_date=subscription.next_billing_date,
    )

    # NotificationService.send_reminder does not take session
    result = await state.notification_svc.send_reminder(
        payload=payload,
        config=test_config.config,
        user_id=current_user,
        channels=test_config.channels,
    )

    success = any(result.values())
    if success:
        return APIResponse(
            data={"results": result}, message="测试通知发送成功"
        )
    raise APIError(message=f"测试通知发送失败，请检查渠道配置。结果: {result}")
