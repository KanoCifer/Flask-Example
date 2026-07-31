from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core import logger
from app.models.models import GalleryImage
from app.repositories.gallery_repo import GalleryRepo
from app.schemas.gallery import GalleryInput
from app.utils.media import resolve_media_path
from app.utils.process_image import process_image


class GalleryService:
    """图片墙持久化与图片处理（派生图生成 + EXIF 提取）。"""

    def __init__(self, gallery_repo: GalleryRepo) -> None:
        self.gallery_repo: GalleryRepo = gallery_repo

    async def set_pic_gallery(
        self, session: AsyncSession, images: GalleryInput
    ) -> None:
        """设置照片墙数据（全删全插，逐张生成派生图）。

        单张图片处理失败降级为 status='failed'，保留 url/description/sort_order，
        不影响其他图片；请求整体不抛异常。
        """
        if not images.images:
            await self.gallery_repo.delete_all(session)
            return

        db_images = []
        for idx, img in enumerate(images.images):
            gallery_image = GalleryImage(
                url=img.url,
                description=img.description,
                sort_order=idx,
            )
            try:
                meta = process_image(resolve_media_path(img.url))
                gallery_image.thumbnail_url = meta["thumbnail_rel"]
                gallery_image.medium_url = meta["medium_rel"]
                gallery_image.width = meta["width"]
                gallery_image.height = meta["height"]
                gallery_image.aspect_ratio = meta["aspect_ratio"]
                gallery_image.file_size = meta["file_size"]
                gallery_image.mime_type = meta["mime_type"]
                gallery_image.exif = meta["exif"]
                gallery_image.status = "ready"
            except Exception:
                logger.bind(url=img.url).exception(
                    "gallery image processing failed"
                )
                gallery_image.status = "failed"
            db_images.append(gallery_image)

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
            "exif": _strip_gps(img.exif),
            "thumbnailUrl": img.thumbnail_url,
            "mediumUrl": img.medium_url,
            "width": img.width,
            "height": img.height,
            "aspectRatio": img.aspect_ratio,
            "fileSize": img.file_size,
            "mimeType": img.mime_type,
            "status": img.status,
        }


def _strip_gps(exif: dict | None) -> dict | None:
    """剔除 EXIF 中的 GPS 坐标(照片墙公开返回,避免泄露拍摄地点)。"""
    if not exif:
        return exif
    return {k: v for k, v in exif.items() if k != "gps"}
