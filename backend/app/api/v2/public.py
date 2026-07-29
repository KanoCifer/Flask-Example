"""Public API router for ReadingList (v2).

公开接口，无需鉴权：
- API 状态检查
- robots.txt / sitemap.xml (SEO)
- 图片墙
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import APIRouter, Body, Depends
from fastapi.responses import PlainTextResponse

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

from app.api.des.db import get_session
from app.appstate import AppState, get_app_state
from app.core.exceptions import APIError
from app.core.logger import logger
from app.core.response import APIResponse
from app.plugins.cache import redis_cache
from app.schemas.gallery import GalleryInput
from app.services.public_service import PublicService

router = APIRouter(prefix="/publicv2", tags=["publicv2"])


async def _safe_invalidate(*func_names: str) -> None:
    """写后清理缓存。失败降级为日志,不影响主流程。"""
    try:
        await redis_cache.invalidate(*func_names)
    except Exception:
        logger.exception("cache invalidation failed (non-fatal)")


# ── Changelogs ────────────────────────────────────────────────


@router.get("/changelogs")
@redis_cache(ttl=3600, exclude=["state"])
async def get_changelogs(state: AppState = Depends(get_app_state)):
    return APIResponse(data=await state.public_svc.get_changelogs())


# ── Status ────────────────────────────────────────────────────


@router.get("/status-detail")
@redis_cache(ttl=60, exclude=["state", "session"])
async def get_status_detail(
    state: AppState = Depends(get_app_state),
    session: AsyncSession = Depends(get_session),
) -> APIResponse:
    """获取详细状态信息（版本、服务指标、系统信息）。"""
    data = await state.status_svc.get_status_detail(session)

    return APIResponse(
        data=data,
        message="Status detail retrieved successfully",
    )


# ── SEO ───────────────────────────────────────────────────────


@router.get("/robots.txt", response_class=PlainTextResponse)
async def get_robots_txt(
    state: AppState = Depends(get_app_state),
) -> PlainTextResponse:
    """返回 robots.txt，供搜索引擎爬取。"""
    robots_content = state.public_svc.get_robots_txt()

    return PlainTextResponse(
        content=robots_content,
        media_type="text/plain",
        headers={"Cache-Control": "public, max-age=3600"},
    )


@router.get("/sitemap.xml")
async def get_sitemap_xml(
    state: AppState = Depends(get_app_state),
) -> PlainTextResponse:
    """生成并返回 sitemap.xml，供搜索引擎爬取。"""
    xml_content = state.public_svc.build_sitemap_xml()

    return PlainTextResponse(
        content=xml_content,
        media_type="application/xml",
        headers={"Cache-Control": "public, max-age=3600"},
    )


# ── Picture gallery ───────────────────────────────────────────


@router.post("/set-pic-gallery")
async def set_pic_gallery(
    images: GalleryInput = Body(..., description="List of image data to set"),
    state: AppState = Depends(get_app_state),
    session: AsyncSession = Depends(get_session),
) -> APIResponse:
    """设置图片墙数据。"""
    try:
        await state.gallery_svc.set_pic_gallery(session, images=images)
        await _safe_invalidate("get_pic_gallery")
        return APIResponse(
            message="Picture gallery updated successfully",
        )
    except Exception as exc:
        logger.error(f"Failed to update picture gallery: {exc!r}")
        raise APIError(
            message="Failed to update picture gallery",
            code=500,
        ) from exc


@router.get("/pic-gallery")
@redis_cache(ttl=600, exclude=["state", "session"])
async def get_pic_gallery(
    state: AppState = Depends(get_app_state),
    session: AsyncSession = Depends(get_session),
):
    """获取图片墙图片列表。"""
    try:
        images = await state.gallery_svc.get_pic_gallery(session)
        return APIResponse(
            data={"images": images},
            message="Picture gallery retrieved successfully",
        )
    except Exception as exc:
        logger.error(f"Failed to retrieve picture gallery: {exc!r}")
        raise APIError(
            message="Failed to retrieve picture gallery",
            code=500,
        ) from exc
