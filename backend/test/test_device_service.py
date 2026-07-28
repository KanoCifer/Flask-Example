"""Integration tests for app.services.device_service — requires test DB."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio

from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.models import User
from app.repositories.device_repo import DeviceRepo
from app.services.device_service import DeviceService

# Share the session loop so asyncpg Futures don't cross loop boundaries.
pytestmark = pytest.mark.asyncio(loop_scope="session")


@pytest_asyncio.fixture
async def device_service():
    return DeviceService(DeviceRepo())


@pytest_asyncio.fixture
async def user(db_session):
    u = User(username="svcuser", password="pass123")
    db_session.add(u)
    await db_session.flush()
    return u


@pytest_asyncio.fixture
async def other_user(db_session):
    u = User(username="othersvc", password="pass456")
    db_session.add(u)
    await db_session.flush()
    return u


def _device_data(**overrides):
    data = {
        "name": "MacBook Pro",
        "purchase_date": datetime(2024, 1, 1, tzinfo=UTC),
        "price": 14999.0,
        "currency": "CNY",
        "status": "active",
    }
    data.update(overrides)
    return data


@pytest.mark.asyncio
async def test_get_owned_device_success(device_service, db_session, user):
    device = await device_service.create_device(db_session, user.id, **_device_data())
    result = await device_service.get_owned_device(db_session, device.id, user.id)
    assert result.id == device.id
    assert result.user_id == user.id


@pytest.mark.asyncio
async def test_get_owned_device_raises_not_found(device_service, db_session, user):
    with pytest.raises(NotFoundError) as exc_info:
        await device_service.get_owned_device(db_session, 99999, user.id)
    assert "设备不存在" in exc_info.value.message


@pytest.mark.asyncio
async def test_get_owned_device_raises_forbidden(
    device_service, db_session, user, other_user
):
    device = await device_service.create_device(db_session, user.id, **_device_data())
    with pytest.raises(ForbiddenError) as exc_info:
        await device_service.get_owned_device(db_session, device.id, other_user.id)
    assert "无权访问" in exc_info.value.message


@pytest.mark.asyncio
async def test_get_user_devices(device_service, db_session, user, other_user):
    await device_service.create_device(db_session, user.id, **_device_data(name="U1"))
    await device_service.create_device(db_session, user.id, **_device_data(name="U2"))
    await device_service.create_device(db_session, other_user.id, **_device_data(name="O1"))

    result = await device_service.get_user_devices(db_session, user.id)
    assert len(result) == 2
    assert {d.name for d in result} == {"U1", "U2"}


@pytest.mark.asyncio
async def test_update_device_status(device_service, db_session, user):
    device = await device_service.create_device(db_session, user.id, **_device_data())
    updated = await device_service.update_device_status(db_session, device.id, "retired")
    assert updated is not None
    assert updated.status == "retired"


@pytest.mark.asyncio
async def test_delete_device(device_service, db_session, user):
    device = await device_service.create_device(db_session, user.id, **_device_data())
    result = await device_service.delete_device(db_session, device.id)
    assert result is True
    assert await device_service.repo.get_device_track_by_id(db_session, device.id) is None


@pytest.mark.asyncio
async def test_get_upcoming_milestone_devices(device_service, db_session, user):
    today = datetime.now(UTC)
    # Device purchased 350 days ago → 365-day milestone is within 30 days
    purchase = today - timedelta(days=350)
    await device_service.create_device(
        db_session,
        user.id,
        **_device_data(
            purchase_date=purchase,
            reminder_config={"milestones": [365]},
        ),
    )
    # Device purchased 100 days ago → no milestone within 30 days
    purchase2 = today - timedelta(days=100)
    await device_service.create_device(
        db_session,
        user.id,
        **_device_data(
            purchase_date=purchase2,
            reminder_config={"milestones": [365]},
        ),
    )

    upcoming = await device_service.get_upcoming_milestone_devices(
        db_session, user.id, days_ahead=30
    )
    assert len(upcoming) == 1
    assert upcoming[0].purchase_date.date() == purchase.date()


@pytest.mark.asyncio
async def test_get_upcoming_milestone_excludes_retired(device_service, db_session, user):
    today = datetime.now(UTC)
    purchase = today - timedelta(days=350)
    await device_service.create_device(
        db_session,
        user.id,
        **_device_data(
            purchase_date=purchase,
            status="retired",
            reminder_config={"milestones": [365]},
        ),
    )

    upcoming = await device_service.get_upcoming_milestone_devices(
        db_session, user.id, days_ahead=30
    )
    assert upcoming == []
