"""Notification 子系统的端口（Port）定义 —— 解耦业务层与持久层。

架构说明
--------
``context_from_config`` 需要把 user_id 解析为 Profile 字段（email /
bark_device_key），但通知传输层（``app.plugins.notification``）不应直接
依赖数据库会话工厂。本模块定义 :class:`ProfilePort` 作为接缝，让上下文
构造器通过 Protocol 获取 Profile，从而：

- 生产路径注入 :class:`DbProfilePort`（查 Postgres）；
- 测试路径注入 fake（无需数据库）；
- 插件层保持"纯传输、无业务依赖"的承诺。

对齐架构评审 issue#3：修复通知上下文的层级穿透。
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from app.models.models import Profile


@runtime_checkable
class ProfilePort(Protocol):
    """Profile 查询端口 —— context_from_config 的唯一外部依赖。

    只声明读取方法，不暴露写操作；实现类须能按 user_id 返回
    Profile 或 None。
    """

    async def get_profile(self, user_id: int) -> Profile | None:
        """按 user_id 查 Profile；不存在返回 None。"""
        ...


class DbProfilePort:
    """生产实现 —— 通过 SQLAlchemy async session 查 Postgres。

    封装原来的 ``_get_user_profile`` 逻辑，使其可被替换。
    """

    async def get_profile(self, user_id: int) -> Profile | None:
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload

        from app.api.des.db import get_async_session
        from app.models.models import User

        async with get_async_session() as session:
            stmt = (
                select(User)
                .where(User.id == user_id)
                .options(selectinload(User.profile))
            )
            result = await session.execute(stmt)
            user = result.scalar_one_or_none()
            if not user or not user.profile:
                return None
            return user.profile
