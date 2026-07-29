from __future__ import annotations

import time

import httpx2

from app.core.config import get_settings
from app.repositories.public_repo import PublicRepo

_FRONTEND_URL = get_settings().FRONTEND_URL.rstrip("/")


class PublicService:
    def __init__(self, repo: PublicRepo) -> None:
        self.repo: PublicRepo = repo

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

    # ── Changelog ──────────────────────────────────────────────

    async def get_changelogs(self) -> list[dict]:
        """获取所有 changelog。"""
        docs = await self.repo.get_changelogs()
        return [d.model_dump(mode="json", exclude_none=True) for d in docs]
