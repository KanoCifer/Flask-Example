"""Integration tests for app.services.sub_service — requires test DB."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio

from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.models import User
from app.repositories.sub_repo import SubRepo
from app.services.sub_service import SubService

# Share the session loop so asyncpg Futures don't cross loop boundaries.
pytestmark = pytest.mark.asyncio(loop_scope="session")


@pytest_asyncio.fixture
async def service(db_session):
    return SubService(SubRepo())


@pytest_asyncio.fixture
async def user(db_session):
    u = User(username="svcuser", password="pass123")
    db_session.add(u)
    await db_session.flush()
    return u


@pytest_asyncio.fixture
async def other_user(db_session):
    u = User(username="other", password="pass456")
    db_session.add(u)
    await db_session.flush()
    return u


def _sub_data(**overrides):
    data = {
        "name": "Netflix",
        "provider": "Netflix Inc",
        "price": 15.99,
        "currency": "USD",
        "billing_cycle": "monthly",
        "next_billing_date": datetime.now(UTC) + timedelta(days=30),
        "status": "active",
    }
    data.update(overrides)
    return data


@pytest.mark.asyncio
async def test_get_owned_subscription_success(service, db_session, user):
    sub = await service.create_one_subscription(db_session, user.id, **_sub_data())
    result = await service.get_owned_subscription(db_session, sub.id, user.id)
    assert result.id == sub.id
    assert result.user_id == user.id


@pytest.mark.asyncio
async def test_get_owned_subscription_raises_not_found(service, db_session, user):
    with pytest.raises(NotFoundError) as exc_info:
        await service.get_owned_subscription(db_session, 99999, user.id)
    assert "订阅不存在" in exc_info.value.message


@pytest.mark.asyncio
async def test_get_owned_subscription_raises_forbidden(service, db_session, user, other_user):
    sub = await service.create_one_subscription(db_session, user.id, **_sub_data())
    with pytest.raises(ForbiddenError) as exc_info:
        await service.get_owned_subscription(db_session, sub.id, other_user.id)
    assert "无权访问" in exc_info.value.message


@pytest.mark.asyncio
async def test_get_due_subscriptions(service, db_session, user):
    now = datetime.now(UTC)
    # Due: active + past billing date
    await service.create_one_subscription(
        db_session,
        user.id,
        **_sub_data(name="Due1", status="active", next_billing_date=now - timedelta(days=1)),
    )
    # Not due: active + future billing date
    await service.create_one_subscription(
        db_session,
        user.id,
        **_sub_data(name="Future", status="active", next_billing_date=now + timedelta(days=10)),
    )
    # Not due: canceled + past billing date
    await service.create_one_subscription(
        db_session,
        user.id,
        **_sub_data(name="Canceled", status="canceled", next_billing_date=now - timedelta(days=5)),
    )

    due = await service.get_due_subscriptions(db_session)
    names = {s.name for s in due}
    assert names == {"Due1"}


@pytest.mark.asyncio
async def test_get_all_subscriptions_for_user(service, db_session, user, other_user):
    await service.create_one_subscription(db_session, user.id, **_sub_data(name="U1"))
    await service.create_one_subscription(db_session, user.id, **_sub_data(name="U2"))
    await service.create_one_subscription(db_session, other_user.id, **_sub_data(name="O1"))

    result = await service.get_all_subscriptions(db_session, user.id)
    assert len(result) == 2
    assert {s.name for s in result} == {"U1", "U2"}


@pytest.mark.asyncio
async def test_update_status_flow(service, db_session, user):
    sub = await service.create_one_subscription(
        db_session, user.id, **_sub_data(status="active")
    )
    updated = await service.update_status(db_session, sub.id, "paused")
    assert updated is not None
    assert updated.status == "paused"


@pytest.mark.asyncio
async def test_delete_subscription(service, db_session, user):
    sub = await service.create_one_subscription(db_session, user.id, **_sub_data())
    result = await service.delete_subscription(db_session, sub.id)
    assert result is True
    assert await service.sub_repo.get_subscription_by_id(db_session, sub.id) is None
