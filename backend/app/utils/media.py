"""Media upload helpers."""

from __future__ import annotations

import re
import uuid
from pathlib import Path

import pillow_heif
from fastapi import UploadFile, status

from app.core.config import get_settings
from app.core.exceptions import APIError

# 注册 HEIF 解码器,使 PIL.Image 能打开 .heic/.heif 文件
# (供 EXIF 读取、压缩等后续处理使用;上传存盘本身不经 PIL)
pillow_heif.register_heif_opener()

ALLOWED_IMAGE_TYPES: set[str] = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/heif",
    "image/heic",
}

MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10MB

# HEIF content_type -> 扩展名映射(浏览器/客户端常把 .heic 报成 image/heif)
_HEIF_EXT_BY_TYPE = {
    "image/heif": ".heif",
    "image/heic": ".heic",
}


def _get_media_root() -> Path:
    env_media = get_settings().MEDIA_PATH
    if env_media != "":
        return Path(env_media)
    return Path(__file__).resolve().parent.parent.parent / "media"


def _guess_extension(upload_file: UploadFile) -> str:
    ext = Path(upload_file.filename or "").suffix.lower()
    if ext:
        return ext
    content_type = (upload_file.content_type or "").lower()
    if content_type == "image/jpeg":
        return ".jpg"
    if content_type == "image/png":
        return ".png"
    if content_type == "image/gif":
        return ".gif"
    if content_type == "image/webp":
        return ".webp"
    if content_type in _HEIF_EXT_BY_TYPE:
        return _HEIF_EXT_BY_TYPE[content_type]
    return ".bin"


def save_upload_image(upload_file: UploadFile, subdir: str) -> str:
    """Save uploaded image to media directory.

    Args:
        upload_file: The uploaded file object.
        subdir: Subdirectory under media root.

    Returns:
        The relative path under media root.
    """
    content_type = (upload_file.content_type or "").lower()
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise APIError(
            code=status.HTTP_400_BAD_REQUEST,
            message="Unsupported image type.",
        )

    if upload_file.size and upload_file.size > MAX_IMAGE_BYTES:
        raise APIError(
            code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            message="Image is too large.",
        )

    content = upload_file.file.read()
    filename = f"{uuid.uuid4().hex}{_guess_extension(upload_file)}"
    media_root = _get_media_root()
    target_dir = media_root / subdir
    try:
        target_dir.mkdir(parents=True, exist_ok=True)
    except Exception as exc:
        raise APIError(
            code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message="Failed to create media directory",
        ) from exc

    file_path: Path = target_dir / filename
    try:
        with file_path.open("wb") as f:
            f.write(content)
    except Exception as exc:
        raise APIError(
            code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message="Failed to save image",
        ) from exc

    return f"{subdir}/{filename}"


# 完整 URL 中的媒体前缀(按出现顺序剥离):https://host/api/v1/media/xxx 或 https://host/v3/media/xxx
_MEDIA_URL_PATTERN = re.compile(
    r"^(?:https?://[^/]+)?/(?:api/v1/|v3/)?media/"
)


def resolve_media_path(url: str) -> Path:
    """把照片墙图 url 归一化为媒体根下的绝对路径(唯一权威入口)。

    兼容三种形态 + 防穿越:
      - 完整 URL:https://api.kanocifer.chat/api/v1/media/gallery/1/x.jpg
      - 相对前缀:  /v3/media/gallery/1/x.jpg
      - 纯相对:    gallery/1/x.jpg
    剥离已知前缀与 query/fragment 后 resolve(),并校验结果落在媒体根内,
    超界(路径穿越)抛 ValueError。
    """
    media_root: Path = _get_media_root()
    # 去 query / fragment,只留 path
    clean = url.split("?", 1)[0].split("#", 1)[0]
    relative_path = _MEDIA_URL_PATTERN.sub("", clean).lstrip("/")

    resolved = (media_root / relative_path).resolve()
    if not resolved.is_relative_to(media_root.resolve()):
        raise ValueError(f"media path escapes media root: {url!r}")
    return resolved


def get_image_path(url: str) -> Path:
    """兼容旧调用:委托统一解析器。"""
    return resolve_media_path(url)


def media_url(rel: str) -> str:
    """相对媒体根路径 → 公开 URL(/media/...)。rel 传相对路径(如 gallery/1/x.jpg)。"""
    return f"/media/{rel.lstrip('/')}"


def get_media_abs_path(rel: str) -> Path:
    """相对媒体根路径 → 媒体根下的绝对路径。仅接受不含 .. 的规范相对路径。"""
    media_root: Path = _get_media_root()
    rel_clean = rel.lstrip("/")
    resolved = (media_root / rel_clean).resolve()
    if not resolved.is_relative_to(media_root.resolve()):
        raise ValueError(f"media path escapes media root: {rel!r}")
    return resolved


def image_mime_for_ext(suffix: str) -> str:
    """文件后缀 → MIME 类型(供 mime_type 回填)。未知后缀返回 application/octet-stream。"""
    ext = suffix.lower().lstrip(".")
    return {
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "gif": "image/gif",
        "webp": "image/webp",
        "heif": "image/heif",
        "heic": "image/heic",
    }.get(ext, "application/octet-stream")
