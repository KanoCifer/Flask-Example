from __future__ import annotations

from app.models.changelog import Changelog


class PublicRepo:
    async def get_changelogs(self) -> list[Changelog]:
        """获取所有 changelog，按版本号降序排列。"""
        changelogs = await Changelog.find().sort("-version").to_list()  # pyright: ignore[reportGeneralTypeIssues]
        return changelogs
