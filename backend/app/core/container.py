"""Service composition root — 已迁移至 :class:`app.appstate.AppState` + ``new_app_state()``。

所有 ``get_X_service()`` async context manager 已被移除（Phase 3）。
router 层改用 ``Depends(get_app_state)`` 获取单例 + ``Depends(get_session)`` 传 session。

过渡期：保留 ``UserServices`` 类型引用，其余 ``get_X_service`` 名称以 noop
stub 存在（Phase 4 router 重写完成后本文件彻底删除）。
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from dataclasses import dataclass

from app.services.user import GitHubAuthService, PasskeyService, UserService


@dataclass
class UserServices:
    """User 相关的服务集合 — 向后兼容过渡期引用，Phase 4 移除。"""

    user: UserService
    passkey: PasskeyService
    github: GitHubAuthService


async def _noop_cm() -> AsyncGenerator[None]:
    yield None


# Router 层使用的入口（Phase 4 完成后可移除）----------------------------- #
get_user_service = _noop_cm
get_user_services = _noop_cm
get_public_service = _noop_cm
get_ai_service = _noop_cm
get_sub_service = _noop_cm
get_notification_service = _noop_cm
get_device_service = _noop_cm
get_weather_service = _noop_cm
get_friendlink_service = _noop_cm
get_fishing_service = _noop_cm

# Task 后台任务仍通过 context manager 使用 —— 用 AppState 单例包装
# 返回 wrapper 代理 state 上的 service，session 仍按旧模式注入。


class _ServiceProxy:
    """将 AppState 的 service 单例包装为 async context manager。

    scheduled task 调用模式：`async with get_rss_service(redis) as svc:`
    我们忽略 redis 参数（已注入 AppState.rss_svc），直接返回底层 service。
    """

    def __init__(self, svc) -> None:
        self._svc = svc

    async def __aenter__(self):
        return self._svc

    async def __aexit__(self, *exc) -> None:
        return None


def get_rss_service(_redis):  # 旧签名保留，不使用 redis（已注入 AppState）
    from app.main import app

    return _ServiceProxy(app.state.services.rss_svc)
