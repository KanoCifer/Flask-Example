"""照片墙图片处理:生成派生图并返回元数据。

纯工具层函数,不触碰 DB / 请求上下文。
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageOps

from app.core import logger
from app.utils.get_exif import get_exif_data
from app.utils.media import _get_media_root, image_mime_for_ext

# 派生图最大边(px)与 WebP 质量
_THUMB_MAX_SIDE = 480
_MED_MAX_SIDE = 1920
_WEBP_QUALITY = 82

# 原图解压像素上限(宽*高),防解压炸弹/超清图导致内存峰值 DoS。
# 4000 万像素约对应 8000×5000 的高清大图。
_MAX_IMAGE_PIXELS = 40_000_000


def _derived_rel(path: Path, media_root: Path, tag: str) -> str:
    """原图路径 → 派生图相对媒体根路径(如 gallery/1/xxx-thumb.webp)。

    path 必须是媒体根内的绝对路径(调用方 resolve_media_path 已保证),
    否则(逃逸)直接抛 ValueError,防止派生图写出媒体根。
    """
    try:
        rel = path.resolve().relative_to(media_root.resolve())
    except ValueError:
        raise ValueError(
            f"image path escapes media root: {path!r}"
        ) from None
    return rel.with_name(f"{rel.stem}-{tag}.webp").as_posix()


def process_image(path: Path) -> dict:
    """处理一张照片墙原图,生成派生图并返回元数据。

    Returns dict: {thumbnail_rel, medium_rel, width, height, aspect_ratio,
                   file_size, mime_type, exif}
    Raises: 任何失败直接抛异常,由上层捕获降级。
    """
    media_root = _get_media_root()
    with Image.open(path) as src:
        # 解压前先看尺寸上限(不用 FULL 解压,先读头),超限直接抛异常降级
        if (src.width * src.height) > _MAX_IMAGE_PIXELS:
            raise ValueError(
                f"image too large: {src.width}x{src.height} "
                f"({src.width * src.height} px > {_MAX_IMAGE_PIXELS})"
            )
        is_animated = getattr(src, "is_animated", False)
        # 修正 EXIF Orientation(返回可能为副本)
        img = ImageOps.exif_transpose(src)
        # 动图派生图只取静态首帧,保存单帧
        if is_animated:
            img.seek(0)

        width, height = img.size
        aspect_ratio = round(width / height, 3) if height else 0
        file_size = path.stat().st_size
        mime_type = image_mime_for_ext(path.suffix)

        # 先出 med(1920),再从 med 的缩略结果派生 thumb(480)——
        # 避免两次从全分辨率原图 copy/重采样,大图时省一次全尺寸内存与 CPU。
        # PIL thumbnail 天然只缩小不放大:图小于目标边时保持原尺寸。
        med_img = img.copy()
        med_img.thumbnail(
            (_MED_MAX_SIDE, _MED_MAX_SIDE), Image.Resampling.LANCZOS
        )
        derived: dict[str, str] = {}
        for tag, derived_img in (
            ("med", med_img),
            ("thumb", med_img.copy()),
        ):
            derived_img.thumbnail(
                (_THUMB_MAX_SIDE, _THUMB_MAX_SIDE), Image.Resampling.LANCZOS
            )
            out_rel = _derived_rel(path, media_root, tag)
            out_path = media_root / out_rel
            out_path.parent.mkdir(parents=True, exist_ok=True)
            # 幂等:文件已存在时直接覆盖写
            derived_img.save(out_path, format="WebP", quality=_WEBP_QUALITY)
            derived[tag] = out_rel

    # EXIF 从原文件读(不是从 exif_transpose 后的图)
    exif = get_exif_data(path)

    result = {
        "thumbnail_rel": derived["thumb"],
        "medium_rel": derived["med"],
        "width": width,
        "height": height,
        "aspect_ratio": aspect_ratio,
        "file_size": file_size,
        "mime_type": mime_type,
        "exif": exif,
    }
    logger.bind(
        path=str(path),
        thumbnail_rel=derived["thumb"],
        medium_rel=derived["med"],
    ).info("processed gallery image")
    return result
