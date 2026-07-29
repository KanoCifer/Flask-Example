"""Integration tests for app.models.event / app.services.event_service."""

from __future__ import annotations

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.models.event import Event
from app.services.event_service import record_event

# Share the session loop so asyncpg Futures don't cross loop boundaries.
pytestmark = pytest.mark.asyncio(loop_scope="session")


@pytest_asyncio.fixture
async def startup_event(db_session):
    return await record_event(
        "startup",
        "API服务启动｜时间：2026-07-10 08:00:00",
        message="boot complete",
        source="boot",
        extra={"version": "2.0"},
        session=db_session,
    )


async def test_record_event_persists_fields(db_session, startup_event):
    """record_event 写入全字段并在 DB 中可查到。"""
    assert startup_event.id is not None
    assert startup_event.type == "startup"
    assert startup_event.source == "boot"
    assert startup_event.extra == {"version": "2.0"}

    result = await db_session.execute(
        select(Event).where(Event.id == startup_event.id)
    )
    assert result.scalar_one() is startup_event


async def test_record_event_default_extra(db_session):
    """extra 缺省为空 dict，而非 NULL。"""
    event = await record_event(
        "deploy", "后端服务升级", source="webhook_admin", session=db_session
    )
    assert event.extra == {}

    result = await db_session.execute(select(Event).where(Event.id == event.id))
    assert result.scalar_one().extra == {}


async def test_record_event_orders_by_timestamp(db_session):
    """多次写入按时间倒序可排列。"""
    first = await record_event("startup", "first", source="boot", session=db_session)
    second = await record_event("deploy", "second", source="admin", session=db_session)

    result = await db_session.execute(
        select(Event).where(Event.id.in_([first.id, second.id])).order_by(Event.timestamp.desc())
    )
    rows = list(result.scalars().all())
    assert rows[0].timestamp >= rows[1].timestamp
