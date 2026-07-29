from __future__ import annotations

import base64
import time

import httpx2
from redis.asyncio import Redis as AsyncRedis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import logger
from app.core.agent import AiAgent
from app.core.config import get_settings
from app.models.models import GalleryImage
from app.repositories.gallery_repo import GalleryRepo
from app.repositories.public_repo import PublicRepo
from app.schemas.aiagent import WeatherAnalysisInput
from app.schemas.gallery import GalleryInput

_FRONTEND_URL = get_settings().FRONTEND_URL.rstrip("/")


class PublicService:
    def __init__(
        self,
        repo: PublicRepo,
        gallery_repo: GalleryRepo | None = None,
        ai_agent: AiAgent | None = None,
    ) -> None:
        self.repo: PublicRepo = repo
        self.gallery_repo: GalleryRepo | None = gallery_repo
        self._ai_agent: AiAgent = ai_agent or AiAgent()

    @staticmethod
    def get_api_status() -> dict[str, str]:
        return {"status": "ok"}

    async def get_status_detail(self, session: AsyncSession) -> dict:
        """Collect version, service, and system health metrics."""
        import asyncio
        import gc
        import platform
        import sys
        import time

        import psutil
        from cpuinfo import get_cpu_info
        from sqlalchemy import text

        from app.core.startup import SERVER_START_TIME

        # Database health check
        db_ok = True
        try:
            await asyncio.wait_for(
                session.execute(text("SELECT 1")),
                timeout=3.0,
            )
        except Exception:
            db_ok = False

        # --- Version Info ---
        version_info = {
            "repo_url": "https://github.com/KanoCifer/kuroome-blog",
            "current_version": get_settings().API_VERSION,
        }

        # --- Service Info ---
        mem = psutil.virtual_memory()
        process = psutil.Process()
        heap_memory = process.memory_info().rss

        service_info = {
            "runtime": f"{sys.platform}/{platform.machine()}",
            "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
            "coroutines": len(asyncio.all_tasks()),
            "gc_count": gc.get_count(),
            "start_time": round(SERVER_START_TIME, 0),
            "heap_memory_bytes": heap_memory,
            "total_memory_bytes": mem.total,
            "db_ok": db_ok,
            "api_ok": True,
        }

        # --- System Info ---
        load_avg = [round(x, 2) for x in psutil.getloadavg()]

        # py-cpuinfo 提供比 platform.processor() 更准确的 CPU 型号与逻辑核数
        try:
            cpu_info = get_cpu_info()
            cpu_model = cpu_info.get("brand_raw") or platform.processor() or "Unknown"
            cpu_count_logical = cpu_info.get("count") or psutil.cpu_count(logical=True)
        except Exception:
            cpu_model = platform.processor() or "Unknown"
            cpu_count_logical = psutil.cpu_count(logical=True)

        system_info = {
            "system_time": time.strftime(
                "%Y/%m/%d %H:%M:%S", time.localtime()
            ),
            "system_timezone": "GMT+8",
            "os_name": f"{platform.system()} {platform.release()}",
            "os_version": platform.version(),
            "kernel_version": platform.release(),
            "cpu_model": cpu_model,
            "cpu_count_physical": psutil.cpu_count(logical=False),
            "cpu_count_logical": cpu_count_logical,
            "load_average": {
                "1m": load_avg[0],
                "5m": load_avg[1],
                "15m": load_avg[2],
            },
            "cpu_percent": psutil.cpu_percent(interval=None),
            "memory_usage_percent": round(mem.percent, 1),
            "memory_used_bytes": mem.used,
            "memory_total_bytes": mem.total,
        }

        return {
            "version": version_info,
            "service": service_info,
            "system": system_info,
        }

    @staticmethod
    def get_robots_txt() -> str:
        sitemap_url = f"{_FRONTEND_URL}/sitemap.xml"
        return f"""User-agent: *
Disallow: /v2/
Disallow: /v3/
Disallow: /admin/
Allow: /

Sitemap: {sitemap_url}
"""

    @staticmethod
    def build_sitemap_xml() -> str:
        """生成基础 sitemap.xml，列出站点主要公开路径。"""
        base = _FRONTEND_URL
        today = time.strftime("%Y-%m-%d")
        urls = [
            ("/", "1.0", "daily"),
            ("/changelogs", "0.5", "weekly"),
            ("/friends", "0.5", "monthly"),
            ("/about", "0.5", "monthly"),
        ]
        lines = ['<?xml version="1.0" encoding="UTF-8"?>']
        lines.append(
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        )
        for path, priority, changefreq in urls:
            lines.append("  <url>")
            lines.append(f"    <loc>{base}{path}</loc>")
            lines.append(f"    <lastmod>{today}</lastmod>")
            lines.append(f"    <changefreq>{changefreq}</changefreq>")
            lines.append(f"    <priority>{priority}</priority>")
            lines.append("  </url>")
        lines.append("</urlset>")
        return "\n".join(lines)

    @staticmethod
    async def add_like(redis: AsyncRedis, likescounts: int) -> int:
        like_key = "site:total_likes"
        return await redis.incrby(like_key, likescounts)

    @staticmethod
    async def get_likes(redis: AsyncRedis) -> int:
        likes = await redis.get("site:total_likes")
        return int(likes) if likes is not None else 0

    @staticmethod
    def get_amap_security_key() -> str:
        settings = get_settings()
        security_code = settings.AMAP_SECURITY_CODE
        return base64.b64encode(security_code.encode()).decode()

    @staticmethod
    async def reverse_geocode(location: str, extensions: str) -> dict:
        url = "https://restapi.amap.com/v3/geocode/regeo"
        params = {
            "key": get_settings().AMAP_WEB_KEY,
            "location": location,
            "extensions": extensions,
        }
        async with httpx2.AsyncClient() as client:
            response = await client.get(url, params=params)
            return response.json()

    async def analyze_weather(
        self, weather_data: WeatherAnalysisInput, model_id: str | None = None
    ):
        """根据天气数据进行分析并生成报告"""
        from app.services.fishing.fishing_index import parse_tide_info

        async def _on_index_calculated(data: dict, ai_score: int) -> None:
            """训练回调：AI 分析完成后保存反馈并触发自动训练"""
            # FishingService uses Mongo-backed repo (no session needed);
            # use a lightweight module-level-style instance for this callback.
            from app.repositories import FishingRepo
            from app.services.fishing.fishing_service import FishingService

            svc = FishingService(repo=FishingRepo())
            await svc.save_ai_analysis_feedback(
                data, ai_score, parse_tide_info
            )

        try:
            async for chunk in self._ai_agent.analyze_weather_stream(
                weather_data=weather_data,
                model_id=model_id,
                on_index_calculated=_on_index_calculated,
            ):
                # chunk 是 agent 层归一化后的 {type, content} dict,直接透传
                yield {
                    "type": chunk["type"],
                    "content": chunk["content"],
                    "is_end": False,
                }
            yield {"type": "content", "content": "", "is_end": True}
        except ValueError as exc:
            yield {
                "type": "content",
                "content": f"[ERROR] {exc!r}",
                "is_end": True,
            }
        except RuntimeError as exc:
            yield {
                "type": "content",
                "content": f"[ERROR] {exc!r}",
                "is_end": True,
            }
        except Exception as exc:
            yield {
                "type": "content",
                "content": f"[ERROR] 天气分析失败: {exc!r}",
                "is_end": True,
            }

    async def set_pic_gallery(
        self, session: AsyncSession, images: GalleryInput
    ) -> None:
        """设置照片墙数据（持久化到 Postgres）"""
        from app.utils.get_exif import get_exif_data
        from app.utils.media import get_image_path

        if not images.images:
            if self.gallery_repo is not None:
                await self.gallery_repo.delete_all(session)
            return

        if self.gallery_repo is None:
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
        if self.gallery_repo is None:
            return []
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

    # ── Changelog ──────────────────────────────────────────────

    async def get_changelogs(self) -> list[dict]:
        """获取所有 changelog。"""
        docs = await self.repo.get_changelogs()
        return [d.model_dump(mode="json", exclude_none=True) for d in docs]
