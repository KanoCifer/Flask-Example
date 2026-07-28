"""Compatibility shims — 过渡期保留旧 ``_dep`` 包装器供 router / test import。

旧的 per-request service factory 设计已由 :class:`AppState` 替代（Phase 3）。
router 层通过 ``Depends(get_app_state)`` 获取 service 单例，session 经
``Depends(get_session)`` 显式传入。Phase 4 router 重写完成后本文件删除。

过渡期策略：旧 ``_dep()`` 保留为 opaque generator stub —— yield ``None``，
不向调用方提供实际 service；旧 router 签名的 ``Depends(xxx_service_dep)``
仍可解析但运行时行为已不可用（Phase 4 修复）。
"""

from __future__ import annotations

from collections.abc import AsyncGenerator


async def _noop_dep() -> AsyncGenerator[None]:
    yield None


user_service_dep = _noop_dep
user_services_dep = _noop_dep
public_service_dep = _noop_dep
rss_service_dep = _noop_dep
weread_service_dep = _noop_dep
ai_service_dep = _noop_dep
sub_service_dep = _noop_dep
notification_service_dep = _noop_dep
device_service_dep = _noop_dep
fishing_service_dep = _noop_dep
weather_service_dep = _noop_dep
friendlink_service_dep = _noop_dep
