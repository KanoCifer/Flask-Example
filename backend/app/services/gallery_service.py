from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core import logger
from app.models.models import GalleryImage
from app.repositories.gallery_repo import GalleryRepo
from app.schemas.gallery import GalleryInput


class GalleryService:
    """图片墙持久化与 EXIF 处理。"""

    def __init__(self, gallery_repo: GalleryRepo) -> None:
        self.gallery_repo: GalleryRepo = gallery_repo

    async def set_pic_gallery(
        self, session: AsyncSession, images: GalleryInput
    ) -> None:
        """设置照片墙数据（持久化到 Postgres）"""
        from app.utils.get_exif import get_exif_data
        from app.utils.media import get_image_path

        if not images.images:
            await self.gallery_repo.delete_all(session)
            return

        relative_paths = [get_image_path(img.url) for img in images.images]
        exif_data = [get_exif_data(path) for path in relative_paths]

        db_images = [
            GalleryImage(
                url=img.url,
                description=img.description,
                sort_order=idx,
                exif=exif,
            )
            for idx, (img, exif) in enumerate(
                zip(images.images, exif_data, strict=False)
            )
        ]
        await self.gallery_repo.save_images(session, db_images)

    async def get_pic_gallery(
        self, session: AsyncSession
    ) -> list[dict]:
        """获取照片墙数据（DB 直取，缓存由 API 层 redis_cache 负责）。"""
        try:
            db_images: list[GalleryImage] = (
                await self.gallery_repo.list_all(session)
            )
            return [self._serialize_gallery_image(img) for img in db_images]
        except Exception as e:
            logger.error(f"Failed to get pic gallery: {e}")
            return []

    @staticmethod
    def _serialize_gallery_image(img: GalleryImage) -> dict:
        return {
            "id": str(img.id),
            "url": img.url,
            "description": img.description,
            "uploadedAt": (
                img.uploaded_at.isoformat() if img.uploaded_at else None
            ),
            "exif": img.exif,
        }
