"""Learning progress domain model."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import ClassVar

from beanie import Document
from pydantic import Field
from pymongo import ASCENDING, IndexModel


class LearningProgress(Document):
    """单个 owner 在某门课程上的学习进度。

    owner 可以是登录用户的 user_id（str/int 序列化后的字符串），
    也可以是匿名用户的 anon_id（D4 决议：匿名也可）。
    """

    owner: str = Field(..., description="进度归属：user_id 或 anon_id")
    course_id: str = Field(..., description="课程 ID")
    topic: str = Field(..., description="生成时的主题")
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    sessions_done: list[int] = Field(
        default_factory=list, description="已完成的 Session 编号列表"
    )
    mission_done: bool = Field(default=False, description="练习任务是否全部完成")
    status: str = Field(
        default="pending",
        description="课程生成状态：pending / ready / failed",
    )

    class Settings:
        name = "learning_progress"
        indexes: ClassVar[list] = [
            IndexModel(
                [("owner", ASCENDING), ("course_id", ASCENDING)],
                unique=True,
            ),
        ]

    @property
    def next_session(self) -> int | None:
        """派生属性：下一个应学习的 Session 编号（D2 决议）。

        取 1..max_done+1 内最小的不在 sessions_done 中的正整数；
        若 sessions_done 已包含 1..n 中的所有编号（视作全部完成），返回 None。
        """
        done = set(self.sessions_done)
        upper = (max(done) + 1) if done else 1
        for n in range(1, upper + 1):
            if n not in done:
                return n
        return None
