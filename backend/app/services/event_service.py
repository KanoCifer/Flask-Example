from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.des.db import get_async_session
from app.models.event import Event


async def record_event(
    type: str,
    title: str,
    message: str = "",
    source: str = "",
    extra: dict | None = None,
    *,
    session: AsyncSession | None = None,
) -> Event:
    """持久化一条关键服务事件。

    独立 async 函数，不复用 log worker —— event 调用点极少且都是
    fire-and-forget 语义，经 Worker 反而耦合两者的背压/错误处理。

    ``session`` 可选：传入时复用该 session（测试场景，用 rollback-isolated
    session），否则经 ``get_async_session()`` 开独立 session 落生产库。
    """

    if session is not None:
        event = Event(
            type=type,
            title=title,
            message=message,
            source=source,
            extra=extra or {},
        )
        session.add(event)
        await session.flush()
        return event

    async with get_async_session() as prod_session:
        event = Event(
            type=type,
            title=title,
            message=message,
            source=source,
            extra=extra or {},
        )
        prod_session.add(event)
        # get_async_session 退出时统一 commit，这里无需手动提交
    return event
