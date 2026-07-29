"""API integration tests for /api/v2/subscriptions — requires test DB.

Tests the full HTTP stack: routing, request validation, auth, response
serialization, and error handling.  Uses a lightweight FastAPI app with
auth + service dependencies overridden to use the test session.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio

from app.models.models import User
from app.repositories.sub_repo import SubRepo
from app.services.sub_service import SubService

pytestmark = pytest.mark.asyncio(loop_scope="session")


@pytest_asyncio.fixture
async def other_user(db_session):
    u = User(username="subother", password="pass456")
    db_session.add(u)
    await db_session.flush()
    return u


def _sub_payload(**overrides):
    data = {
        "name": "Netflix",
        "provider": "Netflix Inc",
        "price": 15.99,
        "currency": "USD",
        "billing_cycle": "monthly",
        "next_billing_date": (
            datetime.now(UTC) + timedelta(days=30)
        ).isoformat(),
        "status": "active",
    }
    data.update(overrides)
    return data


# ── Auth ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_subscriptions_requires_auth(db_session):
    """No auth override → 401."""
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient

    from app.core import register_exception_handlers
    from app.router import register_router

    bare_app = FastAPI()
    register_router(bare_app)
    register_exception_handlers(bare_app)
    # Do NOT override manager — let it hit the real JWT dependency.

    transport = ASGITransport(app=bare_app)
    async with AsyncClient(
        transport=transport, base_url="http://test"
    ) as client:
        resp = await client.get("/v2/subscriptions")
        assert resp.status_code == 401


# ── GET /subscriptions ────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_subscriptions_empty(api_client, api_user):
    resp = await api_client.get("/v2/subscriptions")
    assert resp.status_code == 200
    body = resp.json()
    assert body["message"] == "获取订阅列表成功"
    assert body["data"]["subscriptions"] == []


@pytest.mark.asyncio
async def test_list_subscriptions_returns_user_subs(
    api_client, api_user, other_user, db_session
):
    svc = SubService(SubRepo())
    await svc.create_one_subscription(
        db_session, api_user.id, **_sub_payload(name="U1")
    )
    await svc.create_one_subscription(
        db_session, api_user.id, **_sub_payload(name="U2")
    )
    await svc.create_one_subscription(
        db_session, other_user.id, **_sub_payload(name="Other")
    )

    resp = await api_client.get("/v2/subscriptions")
    assert resp.status_code == 200
    names = {s["name"] for s in resp.json()["data"]["subscriptions"]}
    assert names == {"U1", "U2"}


# ── GET /subscriptions/{id} ───────────────────────────────────


@pytest.mark.asyncio
async def test_get_subscription_by_id(
    api_client, api_user, db_session
):
    svc = SubService(SubRepo())
    sub = await svc.create_one_subscription(
        db_session, api_user.id, **_sub_payload(name="FindMe")
    )

    resp = await api_client.get(f"/v2/subscriptions/{sub.id}")
    assert resp.status_code == 200
    data = resp.json()["data"]["subscription"]
    assert data["name"] == "FindMe"
    assert data["id"] == sub.id


@pytest.mark.asyncio
async def test_get_subscription_not_found(api_client, api_user):
    resp = await api_client.get("/v2/subscriptions/99999")
    assert resp.status_code == 404
    assert "不存在" in resp.json()["message"]


@pytest.mark.asyncio
async def test_get_subscription_forbidden(
    api_client, api_user, other_user, db_session
):
    svc = SubService(SubRepo())
    sub = await svc.create_one_subscription(
        db_session, other_user.id, **_sub_payload(name="Private")
    )

    resp = await api_client.get(f"/v2/subscriptions/{sub.id}")
    assert resp.status_code == 403
    assert "无权访问" in resp.json()["message"]


# ── POST /subscriptions ───────────────────────────────────────


@pytest.mark.asyncio
async def test_create_subscription(api_client, api_user):
    resp = await api_client.post(
        "/v2/subscriptions", json=_sub_payload(name="Spotify")
    )
    assert resp.status_code == 201
    data = resp.json()["data"]["subscription"]
    assert data["name"] == "Spotify"
    assert data["status"] == "active"
    assert "id" in data


@pytest.mark.asyncio
async def test_create_subscription_validation_error(api_client, api_user):
    """Missing required fields → 422."""
    resp = await api_client.post(
        "/v2/subscriptions", json={"name": "Incomplete"}
    )
    assert resp.status_code == 422


# ── PUT /subscriptions/{id} ───────────────────────────────────


@pytest.mark.asyncio
async def test_update_subscription(
    api_client, api_user, db_session
):
    svc = SubService(SubRepo())
    sub = await svc.create_one_subscription(
        db_session, api_user.id, **_sub_payload(name="OldName", price=10.0)
    )

    resp = await api_client.put(
        f"/v2/subscriptions/{sub.id}",
        json={"name": "NewName", "price": 20.0},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]["subscription"]
    assert data["name"] == "NewName"
    assert data["price"] == 20.0


@pytest.mark.asyncio
async def test_update_subscription_not_found(api_client, api_user):
    resp = await api_client.put(
        "/v2/subscriptions/99999", json={"name": "X"}
    )
    assert resp.status_code == 404


# ── DELETE /subscriptions/{id} ────────────────────────────────


@pytest.mark.asyncio
async def test_delete_subscription(
    api_client, api_user, db_session
):
    svc = SubService(SubRepo())
    sub = await svc.create_one_subscription(
        db_session, api_user.id, **_sub_payload(name="ToDelete")
    )

    resp = await api_client.delete(f"/v2/subscriptions/{sub.id}")
    assert resp.status_code == 200
    assert resp.json()["message"] == "删除订阅成功"

    # Verify it's gone
    resp2 = await api_client.get(f"/v2/subscriptions/{sub.id}")
    assert resp2.status_code == 404


@pytest.mark.asyncio
async def test_delete_subscription_not_found(api_client, api_user):
    resp = await api_client.delete("/v2/subscriptions/99999")
    assert resp.status_code == 404


# ── PATCH /subscriptions/{id}/status ──────────────────────────


@pytest.mark.asyncio
async def test_update_subscription_status(
    api_client, api_user, db_session
):
    svc = SubService(SubRepo())
    sub = await svc.create_one_subscription(
        db_session, api_user.id, **_sub_payload(status="active")
    )

    resp = await api_client.patch(
        f"/v2/subscriptions/{sub.id}/status",
        params={"new_status": "paused"},
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["subscription"]["status"] == "paused"


# ── GET /subscriptions/upcoming ───────────────────────────────


@pytest.mark.asyncio
async def test_get_upcoming_subscriptions(
    api_client, api_user, db_session
):
    now = datetime.now(UTC)
    svc = SubService(SubRepo())
    await svc.create_one_subscription(
        db_session,
        api_user.id,
        **_sub_payload(
            name="Due",
            status="active",
            next_billing_date=now - timedelta(days=1),
        ),
    )
    await svc.create_one_subscription(
        db_session,
        api_user.id,
        **_sub_payload(
            name="Future",
            status="active",
            next_billing_date=now + timedelta(days=10),
        ),
    )

    resp = await api_client.get("/v2/subscriptions/upcoming")
    assert resp.status_code == 200
    names = {s["name"] for s in resp.json()["data"]["subscriptions"]}
    assert names == {"Due"}
