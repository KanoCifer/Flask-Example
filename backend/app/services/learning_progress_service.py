"""Learning progress service (纯进度领域, task-374 C2 拆分).

从 fat :class:`app.services.learning_service.LearningService` 拆出的**纯进度**
service：只负责 ``LearningProgress`` 的增改查（pending 落库 / 列表 / 标记
session_done / exercise_done / 状态三态切换 / 登录合并），**不感知**
agno / DeepSeek / CoursePackageRepo，也不 import 任何其它 service 模块
（无循环依赖）。依赖方向：handler → service → repo。

生成侧（``generate_course`` 等）需要读/写进度时经本类的 ``get_progress`` /
``mark_ready`` / ``mark_failed`` 混合调用，与磁盘课程包逻辑解耦。
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from app.core.logger import logger
from app.models.learning import LearningProgress
from app.repositories.learning_repo import LearningRepo
from app.services.learning_utils import _progress_to_dict


class LearningProgressService:
    """学习进度领域 service：``LearningProgress`` 的增改查与登录合并。

    Args:
        repo: 可选的进度仓库；为 None 时用 :class:`LearningRepo` 默认实例。
    """

    def __init__(self, *, repo: LearningRepo | None = None) -> None:
        self._repo = repo or LearningRepo()

    async def create_pending(
        self, owner: str, course_id: str, topic: str, goal: str | None = None
    ) -> None:
        """API 提交阶段：先 upsert 一条 ``LearningProgress(status="pending")``。

        与生成侧 ``generate_course`` 置 ``ready`` 对称：API 收到主题后立刻落库
        一条 pending 记录，``course_id`` 同步返回给前端用于轮询；再
        ``.kiq()`` 异步任务，最后由 worker 把状态置 ``ready``。

        复用 :meth:`LearningRepo.upsert_progress` 的并发安全语义（按唯一索引
        ``(owner, course_id)`` 处理 ``DuplicateKeyError``），原
        ``sessions_done`` / ``exercise_done`` 不会被覆盖。

        Args:
            owner: 进度归属。
            course_id: 课程 ID。
            topic: 学习主题。
            goal: 学习目标（可选），随 pending 记录落库。
        """
        await self._repo.upsert_progress(
            owner=owner,
            course_id=course_id,
            topic=topic,
            status="pending",
            goal=goal,
        )

    async def list_progress(self, owner: str) -> list[dict[str, Any]]:
        """列出 owner 的课程进度，每条含推导出的 ``next_session``。"""
        docs = await self._repo.list_progress(owner)
        return [_progress_to_dict(doc) for doc in docs]

    async def mark_progress(
        self,
        owner: str,
        course_id: str,
        *,
        session_done: int | None = None,
        exercise_done: bool | None = None,
    ) -> dict[str, Any] | None:
        """标记进度：追加完成的 session 或设置 exercise_done（幂等）。

        Returns:
            更新后的进度 dict；进度不存在返回 None。
        """
        doc = None
        if session_done is not None:
            doc = await self._repo.add_session_done(
                owner, course_id, session_done
            )
        if exercise_done is not None:
            doc = await self._repo.set_exercise_done(
                owner, course_id, exercise_done
            )
        if doc is None:
            # 无 mutation 时补读一次；mutation 已返回同步后的最新文档。
            doc = await self._repo.get_progress(owner, course_id)
        if doc is None:
            return None
        return _progress_to_dict(doc)

    async def merge_progress(self, anon_owner: str, user_owner: str) -> int:
        """登录合并：将 anon_owner 进度合入 user_owner（并集 / OR）。

        行为：
        - ``anon_owner == user_owner``：直接返回 0，避免 repo 把同一 owner
          的文档互相覆盖。
        - 否则委托 ``LearningRepo.merge_anon_into_user``，返回成功合并的
          课程数量。

        Returns:
            本次合并涉及的课程数量（0 表示无事可做或 self-merge）。

        Note:
            幂等：第一次合并后匿名文档会被删除，重复调用返回 0；
            ``task-337`` 的登录路由负责在 user_owner 完成认证后调用一次。
        """
        if not anon_owner or not user_owner:
            logger.bind(anon_owner=anon_owner, user_owner=user_owner).warning(
                "learning merge_progress skipped: empty owner"
            )
            return 0
        if anon_owner == user_owner:
            logger.bind(owner=anon_owner).info(
                "learning merge_progress skipped: anon_owner == user_owner"
            )
            return 0

        merged = await self._repo.merge_anon_into_user(anon_owner, user_owner)
        logger.bind(
            anon_owner=anon_owner, user_owner=user_owner, merged=merged
        ).info("learning anon progress merged into user")
        return merged

    async def get_progress(
        self, owner: str, course_id: str
    ) -> LearningProgress | None:
        """按 (owner, course_id) 读取单条进度（供生成侧混合读）。

        Args:
            owner: 进度归属（user_id 或 anon_id）。
            course_id: 课程 ID。

        Returns:
            进度文档；不存在返回 None。
        """
        return await self._repo.get_progress(owner, course_id)

    async def get_progress_or_expire(
        self,
        owner: str,
        course_id: str,
        ttl_minutes: int,
    ) -> LearningProgress | None:
        """读单条进度；``pending`` 超过 ``ttl_minutes`` 未就绪即判定生成失败。

        读侧惰性恢复：``POST /courses`` 先 upsert pending 再 ``.kiq()``，broker /
        worker 故障时记录会永久 pending、前端无限轮询。本方法在读取路径上把过期
        pending 置 ``failed`` 并返回 None，让前端轮询体现终态、DB 不再积累卡死
        记录；``ready`` / ``failed`` / 不存在原样返回。

        Args:
            owner: 进度归属（user_id 或 anon_id）。
            course_id: 课程 ID。
            ttl_minutes: pending 状态的有效时长（分钟）；超时视为生成失败。

        Returns:
            未过期的进度文档；过期 pending 置 failed 后 / ``failed`` / 不存在返回
            None。
        """
        progress = await self._repo.get_progress(owner, course_id)
        if progress is None or progress.status != "pending":
            return progress
        # beanie 读回 created_at 可能为 naive UTC（pymongo 反序列化），统一归一化
        # 到 aware 再与 now 比较，避免 ``datetime`` 直接相减抛 TypeError。
        created = progress.created_at
        if created.tzinfo is None:
            created = created.replace(tzinfo=UTC)
        age = datetime.now(UTC) - created
        if age.total_seconds() > ttl_minutes * 60:
            await self.mark_failed(owner=owner, course_id=course_id)
            logger.bind(
                course_id=course_id,
                owner=owner,
                ttl_minutes=ttl_minutes,
            ).warning("learning pending progress expired, marked failed")
            return None
        return progress

    async def mark_ready(
        self,
        owner: str,
        course_id: str,
        topic: str,
        goal: str | None = None,
        session_id: str | None = None,
    ) -> None:
        """生成成功后置 ``ready``：upsert ``LearningProgress(status="ready")``。

        与 :meth:`create_pending` 对称，供 worker 在课程落盘成功后把状态推进
        到 ``ready``。复用 :meth:`LearningRepo.upsert_progress` 的并发安全
        语义，原 ``sessions_done`` / ``exercise_done`` 不会被覆盖。

        Args:
            owner: 进度归属。
            course_id: 课程 ID。
            topic: 学习主题。
            goal: 学习目标（可选）。
            session_id: agno 会话 ID（可选），首课生成时锚定。
        """
        await self._repo.upsert_progress(
            owner=owner,
            course_id=course_id,
            topic=topic,
            status="ready",
            goal=goal,
            session_id=session_id,
        )
        logger.bind(
            course_id=course_id, owner=owner, status="ready"
        ).info("learning progress marked ready")

    async def mark_failed(self, owner: str, course_id: str) -> None:
        """生成失败置 ``failed``：设置 ``LearningProgress.status="failed"``。

        Args:
            owner: 进度归属。
            course_id: 课程 ID。
        """
        await self._repo.set_status(owner, course_id, "failed")
        logger.bind(
            course_id=course_id, owner=owner, status="failed"
        ).warning("learning progress marked failed")


__all__ = ["LearningProgressService"]
