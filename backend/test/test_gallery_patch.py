"""Integration tests for PATCH /v2/publicv2/pic-gallery/{image_id} — requires test DB."""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio

from app.api.des.auth import get_current_user_full
from app.models.models import GalleryImage, User
from app.plugins.cache import redis_cache

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def _make_image(db_session, **overrides):
    """Create and flush a gallery image row in the test session."""
    data = {
        "url": "https://example.com/img.jpg",
        "description": "original",
        "sort_order": 0,
        "exif": {"camera": "Nikon"},
        "mime_type": "image/jpeg",
        "file_size": 1024,
    }
    data.update(overrides)
    img = GalleryImage(**data)
    db_session.add(img)
    await db_session.flush()
    return img


@pytest_asyncio.fixture
async def gallery_admin(api_app, db_session):
    """Admin user (id in settings.ADMIN_USER_IDS) + wire auth override to it.

    覆盖 `get_current_user_full`（而非 `manager`）：get_current_user_full 内部的
    get_user 直接调用真实 get_session（绕过 DI，连生产库），测试里必须避免。
    覆盖后仍走真实的 `get_admin_user` 依赖，其 is_admin 检查照常生效。
    """
    u = User(id=1, username="galleryadmin", password="pass123")
    db_session.add(u)
    await db_session.flush()
    api_app.dependency_overrides[get_current_user_full] = lambda: u
    return u


@pytest_asyncio.fixture
async def gallery_plain_user(api_app, db_session):
    """Non-admin user (id outside ADMIN_USER_IDS) + wire auth override to it."""
    u = User(id=1000, username="galleryplain", password="pass123")
    db_session.add(u)
    await db_session.flush()
    api_app.dependency_overrides[get_current_user_full] = lambda: u
    return u


# ── 鉴权 / 404 / 校验 ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_patch_requires_admin(api_client, gallery_plain_user, db_session):
    img = await _make_image(db_session)
    resp = await api_client.patch(
        f"/v2/publicv2/pic-gallery/{img.id}",
        json={"description": "hacked"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_patch_missing_image_404(api_client, gallery_admin):
    resp = await api_client.patch(
        "/v2/publicv2/pic-gallery/999999",
        json={"description": "nope"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_patch_invalid_uploaded_at_422(api_client, gallery_admin, db_session):
    img = await _make_image(db_session)
    resp = await api_client.patch(
        f"/v2/publicv2/pic-gallery/{img.id}",
        json={"uploadedAt": "not-a-date"},
    )
    assert resp.status_code == 422


# ── 各字段组合 ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_patch_only_description(api_client, gallery_admin, db_session):
    img = await _make_image(db_session, description="old", exif={"camera": "Nikon"})
    original_uploaded_at = img.uploaded_at

    resp = await api_client.patch(
        f"/v2/publicv2/pic-gallery/{img.id}",
        json={"description": "new desc"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["message"] == "Picture image updated successfully"
    data = body["data"]
    assert data["description"] == "new desc"
    assert data["exif"] == {"camera": "Nikon"}

    await db_session.refresh(img)
    assert img.description == "new desc"
    assert img.exif == {"camera": "Nikon"}
    assert img.uploaded_at == original_uploaded_at


@pytest.mark.asyncio
async def test_patch_only_exif_with_gps(api_client, gallery_admin, db_session):
    img = await _make_image(db_session, description="keep", exif={"camera": "Nikon"})

    resp = await api_client.patch(
        f"/v2/publicv2/pic-gallery/{img.id}",
        json={"exif": {"camera": "Canon", "gps": "31.2,121.4"}},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    # 公开响应剥 GPS
    assert data["exif"] == {"camera": "Canon"}
    assert "gps" not in data["exif"]
    # DB 写入完整 exif（含 gps）
    await db_session.refresh(img)
    assert img.exif == {"camera": "Canon", "gps": "31.2,121.4"}
    assert img.description == "keep"


@pytest.mark.asyncio
async def test_patch_all_fields(api_client, gallery_admin, db_session):
    img = await _make_image(db_session, description="old")

    resp = await api_client.patch(
        f"/v2/publicv2/pic-gallery/{img.id}",
        json={
            "description": "all new",
            "uploadedAt": "2024-06-01T12:30:00Z",
            "exif": {"iso": "100"},
        },
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["description"] == "all new"
    assert datetime.fromisoformat(data["uploadedAt"]) == datetime(
        2024, 6, 1, 12, 30, tzinfo=UTC
    )
    assert data["exif"] == {"iso": "100"}

    await db_session.refresh(img)
    assert img.description == "all new"
    assert img.uploaded_at == datetime(2024, 6, 1, 12, 30, tzinfo=UTC)
    assert img.exif == {"iso": "100"}


@pytest.mark.asyncio
async def test_patch_clear_exif_with_empty_dict(api_client, gallery_admin, db_session):
    img = await _make_image(db_session, exif={"camera": "Nikon"})

    resp = await api_client.patch(
        f"/v2/publicv2/pic-gallery/{img.id}",
        json={"exif": {}},
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["exif"] == {}

    await db_session.refresh(img)
    assert img.exif == {}


# ── 缓存失效 ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_patch_invalidates_cache(
    api_client, gallery_admin, db_session, monkeypatch
):
    img = await _make_image(db_session)
    mock = AsyncMock(return_value=0)
    monkeypatch.setattr(redis_cache, "invalidate", mock)

    resp = await api_client.patch(
        f"/v2/publicv2/pic-gallery/{img.id}",
        json={"description": "updated"},
    )
    assert resp.status_code == 200
    mock.assert_awaited_once_with("get_pic_gallery")
