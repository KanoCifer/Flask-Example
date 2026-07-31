"""一次性脚本:为存量照片墙图片回填派生图与元数据。

背景:照片墙 `gallery_image` 表新增了 thumbnail_url / medium_url / width /
height / aspect_ratio / file_size / mime_type / status 字段。常规路径下这些
字段在下次 `set_pic_gallery`(全删全插)时由 `process_image` 自动补齐;本脚本
为**当前已存在、但从未再保存过**的存量行提前补齐,避免它们停留在旧的
`uploaded` 状态。

用法(在生产服务器,backend 目录下):
    uv run python scripts/backfill_gallery_metadata.py

行为:
- 逐行扫描 gallery_image 表中 status 为 'uploaded' 的行(未处理过的旧数据)。
- 对每行:解析 url → 媒体根绝对路径 → process_image → 回填派生字段 + status='ready'。
- 失败降级:单行 try/except,失败置 status='failed' 并记录原因,不中断。
- 幂等:已 'ready' / 'failed' 的行跳过;重复执行安全。

一次性使用,跑完可删。
"""

from __future__ import annotations

from sqlalchemy import select

from app.api.des.db import AsyncSessionFactory, async_engine
from app.core import logger
from app.models.models import GalleryImage
from app.utils.media import resolve_media_path
from app.utils.process_image import process_image

# 只处理尚未处理过的存量行
STATUS_TARGET = "uploaded"


async def main() -> None:
    async with AsyncSessionFactory() as session:
        result = await session.execute(
            select(GalleryImage).where(GalleryImage.status == STATUS_TARGET)
        )
        rows = list(result.scalars().all())
        logger.info("found {} gallery rows to process", len(rows))

        ready = failed = 0
        for row in rows:
            try:
                meta = process_image(resolve_media_path(row.url))
                row.thumbnail_url = meta["thumbnail_rel"]
                row.medium_url = meta["medium_rel"]
                row.width = meta["width"]
                row.height = meta["height"]
                row.aspect_ratio = meta["aspect_ratio"]
                row.file_size = meta["file_size"]
                row.mime_type = meta["mime_type"]
                row.exif = meta["exif"]
                row.status = "ready"
                ready += 1
                logger.info(
                    "processed {}: {}x{} -> {} / {}",
                    row.id,
                    row.width,
                    row.height,
                    row.thumbnail_url,
                    row.medium_url,
                )
            except Exception:
                row.status = "failed"
                row.mime_type = None
                failed += 1
                logger.bind(url=row.url).exception(
                    "gallery image processing failed"
                )

        await session.commit()
        logger.info(
            "done: {} ready, {} failed, {} skipped",
            ready,
            failed,
            len(rows) - ready - failed,
        )


if __name__ == "__main__":
    import asyncio

    try:
        asyncio.run(main())
    finally:
        asyncio.run(async_engine.dispose())
