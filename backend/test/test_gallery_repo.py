"""Integration tests for app.repositories.gallery_repo — requires test DB."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
import pytest_asyncio

from app.models.models import GalleryImage, User
from app.repositories.gallery_repo import GalleryRepo

# Share the session loop so asyncpg Futures don't cross loop boundaries.
pytestmark = pytest.mark.asyncio(loop_scope="session")


@pytest_asyncio.fixture
async def gallery_repo():
    return GalleryRepo()


@pytest_asyncio.fixture
async def user(db_session):
    u = User(username="galleryuser", password="pass123")
    db_session.add(u)
    await db_session.flush()
    return u


def _make_image(**overrides):
    data = {
        "url": "https://example.com/img.jpg",
        "description": "A test image",
        "file_size": 1024,
        "mime_type": "image/jpeg",
        "sort_order": 0,
    }
    data.update(overrides)
    return GalleryImage(**data)


@pytest.mark.asyncio
async def test_list_all_returns_empty_when_no_images(gallery_repo, db_session):
    result = await gallery_repo.list_all(db_session)
    assert result == []


@pytest.mark.asyncio
async def test_list_all_returns_images_ordered_by_sort_order(
    gallery_repo, db_session
):
    img1 = _make_image(url="https://a.com/1.jpg", sort_order=2)
    img2 = _make_image(url="https://a.com/2.jpg", sort_order=1)
    img3 = _make_image(url="https://a.com/3.jpg", sort_order=0)
    await gallery_repo.save_images(db_session, [img1, img2, img3])

    result = await gallery_repo.list_all(db_session)
    assert len(result) == 3
    assert result[0].url == "https://a.com/3.jpg"
    assert result[1].url == "https://a.com/2.jpg"
    assert result[2].url == "https://a.com/1.jpg"


@pytest.mark.asyncio
async def test_save_images_replaces_all_existing(gallery_repo, db_session):
    await gallery_repo.save_images(
        db_session, [_make_image(url="https://a.com/old.jpg")]
    )
    assert len(await gallery_repo.list_all(db_session)) == 1

    await gallery_repo.save_images(
        db_session, [_make_image(url="https://a.com/new.jpg")]
    )
    result = await gallery_repo.list_all(db_session)
    assert len(result) == 1
    assert result[0].url == "https://a.com/new.jpg"


@pytest.mark.asyncio
async def test_delete_all_removes_everything(gallery_repo, db_session):
    await gallery_repo.save_images(
        db_session,
        [
            _make_image(url="https://a.com/1.jpg"),
            _make_image(url="https://a.com/2.jpg"),
        ],
    )
    assert len(await gallery_repo.list_all(db_session)) == 2

    await gallery_repo.delete_all(db_session)
    assert await gallery_repo.list_all(db_session) == []


@pytest.mark.asyncio
async def test_list_all_with_user_id(gallery_repo, user, db_session):
    img = _make_image(url="https://a.com/user.jpg", user_id=user.id)
    await gallery_repo.save_images(db_session, [img])

    result = await gallery_repo.list_all(db_session)
    assert len(result) == 1
    assert result[0].user_id == user.id


# ── update_image ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_update_image_returns_none_when_missing(gallery_repo, db_session):
    result = await gallery_repo.update_image(
        db_session,
        image_id=999999,
        description="new desc",
        uploaded_at=None,
        exif=None,
    )
    assert result is None


@pytest.mark.asyncio
async def test_update_image_only_description(gallery_repo, db_session):
    await gallery_repo.save_images(
        db_session,
        [
            _make_image(
                url="https://a.com/1.jpg",
                description="old desc",
                exif={"camera": "Sony"},
            )
        ],
    )
    existing = (await gallery_repo.list_all(db_session))[0]
    original_uploaded_at = existing.uploaded_at

    result = await gallery_repo.update_image(
        db_session,
        image_id=existing.id,
        description="new desc",
        uploaded_at=None,
        exif=None,
    )

    assert result is not None
    assert result.description == "new desc"
    # 未传字段保持原值
    assert result.exif == {"camera": "Sony"}
    assert result.uploaded_at == original_uploaded_at


@pytest.mark.asyncio
async def test_update_image_only_exif(gallery_repo, db_session):
    await gallery_repo.save_images(
        db_session,
        [_make_image(url="https://a.com/1.jpg", description="keep me")],
    )
    existing = (await gallery_repo.list_all(db_session))[0]

    result = await gallery_repo.update_image(
        db_session,
        image_id=existing.id,
        description=None,
        uploaded_at=None,
        exif={"camera": "Canon", "gps": "31.2,121.4"},
    )

    assert result is not None
    assert result.exif == {"camera": "Canon", "gps": "31.2,121.4"}
    assert result.description == "keep me"


@pytest.mark.asyncio
async def test_update_image_all_fields(gallery_repo, db_session):
    await gallery_repo.save_images(
        db_session, [_make_image(url="https://a.com/1.jpg", description="old")]
    )
    existing = (await gallery_repo.list_all(db_session))[0]
    new_uploaded_at = datetime(2024, 6, 1, 12, 30, 0, tzinfo=UTC)

    result = await gallery_repo.update_image(
        db_session,
        image_id=existing.id,
        description="all new",
        uploaded_at=new_uploaded_at,
        exif={"iso": "100"},
    )

    assert result is not None
    assert result.description == "all new"
    assert result.uploaded_at == new_uploaded_at
    assert result.exif == {"iso": "100"}


@pytest.mark.asyncio
async def test_update_image_clear_exif_with_empty_dict(gallery_repo, db_session):
    await gallery_repo.save_images(
        db_session,
        [_make_image(url="https://a.com/1.jpg", exif={"camera": "Nikon"})],
    )
    existing = (await gallery_repo.list_all(db_session))[0]

    result = await gallery_repo.update_image(
        db_session,
        image_id=existing.id,
        description=None,
        uploaded_at=None,
        exif={},
    )

    assert result is not None
    assert result.exif == {}
