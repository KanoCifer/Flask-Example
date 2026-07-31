from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import GalleryImage


class GalleryRepo:
    async def list_all(
        self,
        session: AsyncSession,
    ) -> list[GalleryImage]:
        result = await session.execute(
            select(GalleryImage).order_by(
                GalleryImage.sort_order, GalleryImage.created_at.desc()
            )
        )
        return list(result.scalars().all())

    async def save_images(
        self,
        session: AsyncSession,
        images: list[GalleryImage],
    ) -> None:
        """Replace all gallery images in a transaction."""
        await session.execute(GalleryImage.__table__.delete())
        for img in images:
            session.add(img)
        await session.flush()

    async def delete_all(
        self,
        session: AsyncSession,
    ) -> None:
        await session.execute(GalleryImage.__table__.delete())
        await session.flush()

    async def update_image(
        self,
        session: AsyncSession,
        *,
        image_id: int,
        description: str | None,
        uploaded_at: datetime | None,
        exif: dict | None,
    ) -> GalleryImage | None:
        """按 id 局部更新单图元数据，返回更新后的对象，找不到返回 None。

        JSON Merge 语义：仅当入参非 None 才赋值；``exif`` 直接覆盖 JSONB。
        """
        result = await session.execute(
            select(GalleryImage).where(GalleryImage.id == image_id)
        )
        img = result.scalar_one_or_none()
        if img is None:
            return None
        if description is not None:
            img.description = description
        if uploaded_at is not None:
            img.uploaded_at = uploaded_at
        if exif is not None:
            img.exif = exif
        await session.flush()
        await session.refresh(img)
        return img
