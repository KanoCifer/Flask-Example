"""API integration tests for /api/v2/device — requires test DB."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio

from app.models.models import User
from app.repositories.device_repo import DeviceRepo
from app.services.device_service import DeviceService

pytestmark = pytest.mark.asyncio(loop_scope="session")


@pytest_asyncio.fixture
async def other_user(db_session):
    u = User(username="deviceother", password="pass456")
    db_session.add(u)
    await db_session.flush()
    return u


def _device_payload(**overrides):
    data = {
        "name": "MacBook Pro",
        "purchase_date": datetime(2024, 1, 1, tzinfo=ISO_UTC).isoformat(),
        "price": 14999.0,
        "currency": "CNY",
        "status": "active",
    }
    data.update(overrides)
    return data


ISO_UTC = UTC


# ── GET /device ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_devices_empty(api_client, api_user):
    resp = await api_client.get("/v2/device")
    assert resp.status_code == 200
    assert resp.json()["data"]["devices"] == []


@pytest.mark.asyncio
async def test_list_devices_filters_by_user(
    api_client, api_user, other_user, db_session
):
    svc = DeviceService(DeviceRepo())
    await svc.create_device(db_session, api_user.id, **_device_payload(name="U1"))
    await svc.create_device(db_session, api_user.id, **_device_payload(name="U2"))
    await svc.create_device(db_session, other_user.id, **_device_payload(name="Other"))

    resp = await api_client.get("/v2/device")
    names = {d["name"] for d in resp.json()["data"]["devices"]}
    assert names == {"U1", "U2"}


# ── GET /device/{id} ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_device_by_id(
    api_client, api_user, db_session
):
    svc = DeviceService(DeviceRepo())
    device = await svc.create_device(db_session, api_user.id, **_device_payload(name="FindMe"))

    resp = await api_client.get(f"/v2/device/{device.id}")
    assert resp.status_code == 200
    assert resp.json()["data"]["device"]["name"] == "FindMe"


@pytest.mark.asyncio
async def test_get_device_not_found(api_client, api_user):
    resp = await api_client.get("/v2/device/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_device_forbidden(
    api_client, api_user, other_user, db_session
):
    svc = DeviceService(DeviceRepo())
    device = await svc.create_device(db_session, other_user.id, **_device_payload(name="Private"))

    resp = await api_client.get(f"/v2/device/{device.id}")
    assert resp.status_code == 403


# ── POST /device ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_device(api_client, api_user):
    resp = await api_client.post(
        "/v2/device", json=_device_payload(name="iPad")
    )
    assert resp.status_code == 201
    data = resp.json()["data"]["device"]
    assert data["name"] == "iPad"
    assert data["status"] == "active"


@pytest.mark.asyncio
async def test_create_device_validation_error(
    api_client, api_user
):
    resp = await api_client.post(
        "/v2/device", json={"name": "NoPrice"}
    )
    assert resp.status_code == 422


# ── PUT /device/{id} ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_update_device(
    api_client, api_user, db_session
):
    svc = DeviceService(DeviceRepo())
    device = await svc.create_device(db_session, api_user.id, **_device_payload(name="Old"))

    resp = await api_client.put(
        f"/v2/device/{device.id}", json={"name": "New"}
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["device"]["name"] == "New"


@pytest.mark.asyncio
async def test_update_device_not_found(
    api_client, api_user
):
    resp = await api_client.put("/v2/device/99999", json={"name": "X"})
    assert resp.status_code == 404


# ── DELETE /device/{id} ───────────────────────────────────────


@pytest.mark.asyncio
async def test_delete_device(
    api_client, api_user, db_session
):
    svc = DeviceService(DeviceRepo())
    device = await svc.create_device(db_session, api_user.id, **_device_payload(name="ToDelete"))

    resp = await api_client.delete(f"/v2/device/{device.id}")
    assert resp.status_code == 200
    assert resp.json()["message"] == "删除设备成功"

    resp2 = await api_client.get(f"/v2/device/{device.id}")
    assert resp2.status_code == 404


@pytest.mark.asyncio
async def test_delete_device_not_found(
    api_client, api_user
):
    resp = await api_client.delete("/v2/device/99999")
    assert resp.status_code == 404


# ── PATCH /device/{id}/status ─────────────────────────────────


@pytest.mark.asyncio
async def test_update_device_status(
    api_client, api_user, db_session
):
    svc = DeviceService(DeviceRepo())
    device = await svc.create_device(db_session, api_user.id, **_device_payload(status="active"))

    resp = await api_client.patch(
        f"/v2/device/{device.id}/status",
        json={"status": "retired"},
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["device"]["status"] == "retired"


# ── GET /device/upcoming ──────────────────────────────────────


@pytest.mark.asyncio
async def test_get_upcoming_milestone_devices(
    api_client, api_user, db_session
):
    today = datetime.now(UTC)
    svc = DeviceService(DeviceRepo())
    await svc.create_device(
        db_session,
        api_user.id,
        **_device_payload(purchase_date=today - timedelta(days=350)),
        reminder_config={"milestones": [365]},
    )
    await svc.create_device(
        db_session,
        api_user.id,
        **_device_payload(purchase_date=today - timedelta(days=100)),
        reminder_config={"milestones": [365]},
    )

    resp = await api_client.get("/v2/device/upcoming")
    assert resp.status_code == 200
    devices = resp.json()["data"]["devices"]
    assert len(devices) == 1
