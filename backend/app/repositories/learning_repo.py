"""Learning progress repository (beanie / MongoDB)."""

from __future__ import annotations

from datetime import UTC, datetime

from pymongo.errors import DuplicateKeyError

from app.models.learning import LearningProgress


class LearningRepo:
    """对 LearningProgress 的数据访问封装。

    设计要点：
    - 唯一索引 (owner, course_id) 是 upsert / merge 的边界，重复 key 由调用方处理。
    - sessions_done / exercise_done 写入使用 $addToSet / $set，保证幂等。
    - merge_anon_into_user 用 set union + OR 合并，不做简单覆盖。
    """

    async def get_progress(
        self, owner: str, course_id: str
    ) -> LearningProgress | None:
        """按 (owner, course_id) 读取单条进度，不存在返回 None。"""
        return await LearningProgress.find_one(
            LearningProgress.owner == owner,
            LearningProgress.course_id == course_id,
        )

    async def list_progress(self, owner: str) -> list[LearningProgress]:
        """列出某 owner 的全部进度（不过滤 status，由 service 决定）。"""
        return (
            await LearningProgress.find(
                LearningProgress.owner == owner,
            )
            .sort("-created_at")
            .to_list()
        )

    async def upsert_progress(
        self,
        owner: str,
        course_id: str,
        topic: str,
        status: str,
        goal: str | None = None,
        session_id: str | None = None,
        model_id: str | None = None,
        extra_prompt: str | None = None,
    ) -> LearningProgress:
        """创建或替换一条进度记录（按唯一索引 (owner, course_id)）。

        - 已存在：topic / status 无条件替换，goal / session_id / model_id /
          extra_prompt 仅在非 ``None`` 时替换，原 sessions_done /
          exercise_done 保留。
        - 不存在：插入新行，created_at 由模型默认值生成；可空字段不传则为
          None。

        存量旧字段不迁移，见 task-365。
        """
        existing = await self.get_progress(owner, course_id)
        if existing is not None:
            await self._apply_upsert_fields(
                existing,
                topic,
                status,
                goal,
                session_id,
                model_id,
                extra_prompt,
            )
            return existing

        new_doc = LearningProgress(
            owner=owner,
            course_id=course_id,
            topic=topic,
            status=status,
            goal=goal,
            session_id=session_id,
            model_id=model_id,
            extra_prompt=extra_prompt,
            created_at=datetime.now(UTC),
        )
        try:
            await new_doc.insert()
        except DuplicateKeyError:
            # 并发场景下另一请求先插入；回退为重新读取并按已存在分支处理。
            existing = await self.get_progress(owner, course_id)
            if existing is None:  # pragma: no cover - 极端竞态
                raise
            await self._apply_upsert_fields(
                existing,
                topic,
                status,
                goal,
                session_id,
                model_id,
                extra_prompt,
            )
            return existing
        return new_doc

    @staticmethod
    async def _apply_upsert_fields(
        doc: LearningProgress,
        topic: str,
        status: str,
        goal: str | None,
        session_id: str | None = None,
        model_id: str | None = None,
        extra_prompt: str | None = None,
    ) -> LearningProgress:
        """已存在分支的统一字段应用：topic/status 替换，其余字段非 None 才替换。"""
        doc.topic = topic
        doc.status = status
        if goal is not None:
            doc.goal = goal
        if session_id is not None:
            doc.session_id = session_id
        if model_id is not None:
            doc.model_id = model_id
        if extra_prompt is not None:
            doc.extra_prompt = extra_prompt
        await doc.save()
        return doc

    async def add_session_done(
        self, owner: str, course_id: str, session_num: int
    ) -> LearningProgress | None:
        """幂等追加已完成的 Session 编号。

        - 已存在该编号：no-op（$addToSet 去重）。
        - 进度文档不存在：返回 None，由上层决定是否自动创建。
        """
        doc = await self.get_progress(owner, course_id)
        if doc is None:
            return None
        await doc.update({"$addToSet": {"sessions_done": session_num}})
        await doc.sync()
        return doc

    async def set_exercise_done(
        self, owner: str, course_id: str, done: bool = True
    ) -> LearningProgress | None:
        """幂等设置 exercise_done。"""
        doc = await self.get_progress(owner, course_id)
        if doc is None:
            return None
        await doc.update({"$set": {"exercise_done": done}})
        await doc.sync()
        return doc

    async def set_status(
        self, owner: str, course_id: str, status: str
    ) -> LearningProgress | None:
        """用于 pending -> ready / failed 的状态切换。"""
        doc = await self.get_progress(owner, course_id)
        if doc is None:
            return None
        await doc.update({"$set": {"status": status}})
        await doc.sync()
        return doc

    async def merge_anon_into_user(
        self, anon_owner: str, user_owner: str
    ) -> int:
        """登录合并：将 anon_owner 的进度合入 user_owner，然后删除匿名文档。

        合并规则（按 course_id 分组）：
        - sessions_done：取两侧集合的并集（去重 + 排序）。
        - exercise_done：任一侧为 True 即为 True。
        - topic / status / created_at：以 user_owner 已存在记录为准；
          若 user_owner 没有对应记录，则把匿名文档迁过去并改 owner。

        返回成功合并的课程数量。
        """
        anon_docs = (
            await LearningProgress.find(
                LearningProgress.owner == anon_owner,
            ).to_list()
        )
        if not anon_docs:
            return 0

        merged = 0
        for anon in anon_docs:
            user_doc = await self.get_progress(user_owner, anon.course_id)
            if user_doc is None:
                # 直接迁移：改 owner 即可，created_at 沿用 anon 原值。
                await anon.update({"$set": {"owner": user_owner}})
                merged += 1
                continue

            merged_sessions = sorted(
                set(user_doc.sessions_done) | set(anon.sessions_done)
            )
            merged_exercise_done = bool(
                user_doc.exercise_done or anon.exercise_done
            )
            await user_doc.update(
                {
                    "$set": {
                        "sessions_done": merged_sessions,
                        "exercise_done": merged_exercise_done,
                    }
                }
            )
            await anon.delete()
            merged += 1

        return merged
