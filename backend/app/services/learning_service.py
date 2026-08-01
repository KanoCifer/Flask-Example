"""Learning course generation service (D2/D3 决策, task-351 重构).

渐进产出（per-lesson file / 渐进 course）：

- Step 1 — 单课 md：agent 产出 ``lesson_md``（单课正文，含 YAML front matter
  元数据）、``title`` + ``slug``（用于文件名）。``output_schema=LessonResourceOutput``
  把这几份以字段形式回传，方便结构化校验。
- Step 2 — 结构化：agent ``output_schema=MissionBundle``（``missions: list[Mission]``）。
  校验失败（content 仍是 ``str``）则用更明确的指令重试一次，仍失败则
  抛出 ``RuntimeError``。

一课一文件落盘到 ``tmp/learning/<course-id>/lessons/0001-<slug>.md`` 与
同目录 ``0001-<slug>.exercise.md``；``resource.md`` 仍是全课程共享。YAML
front matter 用 ``yaml.safe_dump`` 序列化。``LearningProgress`` 走 beanie
Document 直存（task-335 的 ``LearningRepo`` 后续可平滑替换）。

设计依据：
- spec：``task-334``（PR #22 决策 #24 课程包结构）、``task-351``（一课一文件 + 渐进产出）
- DeepSeek 仅支持 JSON mode（``json_object``），不支持原生 json_schema；
  ``agno.models.deepseek.DeepSeek.supports_native_structured_outputs=False``
  → 必须在 ``create_agent`` 显式 ``use_json_mode=True``，否则
  ``response_format`` 仍走 ``output_schema`` 直传，DeepSeek 会拒绝。
"""

from __future__ import annotations

import hashlib
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import yaml
from agno.agent import Agent
from agno.models.base import Model
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

from app.core.config import get_settings
from app.core.llm_factory import (
    create_agent,
    create_deepseek_model,
    create_postgres_db,
    create_research_agent,
    create_web_search_tools,
)
from app.core.llm_prompts import (
    LANGUAGE,
    RESEARCH_CONTEXT_HINT,
    RESEARCH_USER_PROMPT_TEMPLATE,
    STEP1_INSTRUCTIONS,
    STEP1_USER_PROMPT_TEMPLATE,
    STEP2_INSTRUCTIONS,
    STEP2_RETRY_HINT,
    STEP2_USER_PROMPT_TEMPLATE,
)
from app.core.logger import logger
from app.models.learning import LearningProgress
from app.repositories.learning_repo import LearningRepo
from app.schemas.learning import CoursePackage, LessonItem, Mission

# ── 顶层 schema ─────────────────────────────────────────────────────── #


class LessonResourceOutput(BaseModel):
    """Step 1 的 output_schema：agent 同时回传单课 md + 共享 resource。

    - ``title`` / ``slug`` 由 LLM 生成（基于用户主题 / 上一课上下文），用于
      磁盘文件名 ``<num>-<slug>.md`` 与 :class:`LessonItem` 字段。
    - ``lesson_md`` 是该课的**单课**正文（不再是整门课程 3-8 Session 拼装版）；
      ``resource_md`` 是全课程共享参考资料，独立成文。
    """

    title: str = Field(..., description="本课标题（用于 LessonItem.title）")
    slug: str = Field(
        ...,
        description="本课 dash-case slug（用于文件名 <num>-<slug>.md）",
    )
    lesson_md: str = Field(..., description="本课 lesson.md 全文（正文）")
    resource_md: str = Field(..., description="resource.md 全文（课程共享）")


class MissionBundle(BaseModel):
    """Step 2 的 output_schema：练习任务清单。"""

    missions: list[Mission] = Field(default_factory=list)


# ── service ─────────────────────────────────────────────────────────── #


class LearningService:
    """课程生成 service：单课一步生成 + 一课一文件 + 渐进产出。

    Args:
        model: 可选注入；为 None 时用 ``create_deepseek_model()`` 默认值
            (``deepseek-v4-pro``)。测试时可注入 mock。
        agent: 可选注入；为 None 时按 model + Redis db 即时构建（每次 step
            重建一份，避免 ``deepcopy(agent)`` 复制 run state / session 缓存
            带来的共享状态风险）。
        tmp_dir: 课程包根目录；为 None 时用 ``<backend>/tmp/learning``。
            单元测试可注入 :class:`pathlib.Path` 指向临时目录。
        research_agent: 可选注入的**研究 Agent**（Exa + Context7 双工具）。
            为 None 时按 ``EXA_API_KEY`` 是否配置决定：配置了才构建研究步，
            未配置则跳过研究直接生成课程（优雅降级，课程生成不受影响）。
        research_db: 可选注入的研究 Agent 会话存储；为 None 时沿用
            :func:`create_redis_db` 默认值。
    """

    def __init__(
        self,
        *,
        model: Model | None = None,
        agent: Agent | None = None,
        tmp_dir: Path | None = None,
        repo: LearningRepo | None = None,
        research_agent: Agent | None = None,
        research_db: Any | None = None,
    ) -> None:
        self._model = model
        self._agent = agent
        self._tmp_dir = tmp_dir
        self._repo = repo or LearningRepo()
        self._research_agent = research_agent
        self._research_db = research_db

    # ── 公开 API ────────────────────────────────────────────────────── #

    async def generate_course(self, topic: str, owner: str) -> str:
        """生成**第 1 课**并落盘，同步写一条 ``LearningProgress(status="ready")``。

        落盘结构：

        .. code-block:: text

            <course_id>/
              lessons/
                0001-<slug>.md
                0001-<slug>.exercise.md
              resource.md

        Args:
            topic: 用户输入的学习主题。
            owner: 进度归属（user_id 或 anon_id）。

        Returns:
            ``course_id``，格式 ``<slug>--<8hex>``。

        Raises:
            RuntimeError: 两步生成中任一步连续两次解析失败。
        """
        course_id = build_course_id(topic)
        course_dir = self._course_dir(course_id)
        lessons_dir = course_dir / "lessons"
        resource_path = course_dir / "resource.md"
        lessons_dir.mkdir(parents=True, exist_ok=True)

        # Step 0 — 研究步（可选）：Exa + Context7 搜集资料，喂给 step1
        research_summary = await self._run_research(topic=topic)

        # Step 1 — 单课 lesson + 共享 resource（无 previous_lesson_md）
        bundle: LessonResourceOutput = await self._run_step1(
            topic=topic,
            course_id=course_id,
            research_summary=research_summary,
        )
        lesson_num = 1
        slug = bundle.slug

        # Step 2 — 该课的练习题
        missions = await self._run_step2(topic=topic, course_id=course_id)

        # 写入磁盘：lesson body + exercise + resource
        lesson_path = lessons_dir / f"{lesson_num:04d}-{slug}.md"
        exercise_path = lessons_dir / f"{lesson_num:04d}-{slug}.exercise.md"
        lesson_path.write_text(bundle.lesson_md, encoding="utf-8")
        exercise_path.write_text(
            _render_mission_md(
                title=f"课程练习：{topic}",
                course_id=course_id,
                missions=missions,
            ),
            encoding="utf-8",
        )
        resource_path.write_text(bundle.resource_md, encoding="utf-8")

        # 落盘成功后再持久化进度，避免半成品状态。
        await self._upsert_progress(
            owner=owner, course_id=course_id, topic=topic
        )

        logger.bind(
            course_id=course_id, owner=owner, lesson_num=lesson_num, slug=slug
        ).info("learning course lesson 1 generated")
        return course_id

    async def generate_next_lesson(
        self, topic: str, owner: str, course_id: str
    ) -> int | None:
        """渐进产出：生成**下一课**并落盘。

        幂等策略：以磁盘上已存在的 ``lessons/000N-<slug>.md`` 文件为准，
        ``next_num = max(existing ids) + 1``；若该编号对应的文件已存在
        （重试 / 并发场景），**直接返回 None**，不重复生成。

        ZPD（最近发展区）上下文：调 Step1 时把上一课 ``md`` 的尾部（默认
        1500 字符）拼进 user prompt，让 LLM 既不重复也不跳跃。

        Args:
            topic: 原始主题（用于 prompt）。
            owner: 进度归属（仅用于日志，不再写 progress）。
            course_id: 课程 ID。

        Returns:
            新课的编号；若有冲突（已存在）则返回 None。
        """
        course_dir = self._course_dir(course_id)
        lessons_dir = course_dir / "lessons"
        resource_path = course_dir / "resource.md"

        # 1. 扫 lessons/ 找 next_num（idempotent：已存在 → 直接返回 None）
        existing_ids = _list_existing_lesson_ids(lessons_dir)
        next_num = (max(existing_ids) + 1) if existing_ids else 1

        # 防御：极端 race（两个 worker 同时跑同一个 course），文件已存在 →
        # 视为幂等成功。
        tentative_path = lessons_dir / f"{next_num:04d}-pending.md"
        if tentative_path.exists() or any(
            p.name.startswith(f"{next_num:04d}-")
            for p in lessons_dir.glob(f"{next_num:04d}-*.md")
        ):
            logger.bind(
                course_id=course_id, owner=owner, lesson_num=next_num
            ).info("learning next lesson already exists, skipping")
            return None

        lessons_dir.mkdir(parents=True, exist_ok=True)

        # 2. 上一课 md 尾巴（缺失则空字符串）
        previous_md = _last_lesson_md_tail(lessons_dir, existing_ids) or ""

        # 2.5 研究步（可选）：Exa + Context7 搜集资料，喂给 step1
        research_summary = await self._run_research(topic=topic)

        # 3. Step 1 — 单课 + 共享 resource（喂上一课尾巴 + 研究摘要）
        bundle = await self._run_step1(
            topic=topic,
            course_id=course_id,
            previous_lesson_md=previous_md,
            research_summary=research_summary,
        )
        slug = bundle.slug

        # 4. Step 2 — 该课的练习题
        missions = await self._run_step2(topic=topic, course_id=course_id)

        # 5. 落盘两文件；resource.md 同步刷新（Step1 会重写共享资源）
        lesson_path = lessons_dir / f"{next_num:04d}-{slug}.md"
        exercise_path = lessons_dir / f"{next_num:04d}-{slug}.exercise.md"
        lesson_path.write_text(bundle.lesson_md, encoding="utf-8")
        exercise_path.write_text(
            _render_mission_md(
                title=f"课程练习：{topic}",
                course_id=course_id,
                missions=missions,
            ),
            encoding="utf-8",
        )
        resource_path.write_text(bundle.resource_md, encoding="utf-8")

        logger.bind(
            course_id=course_id,
            owner=owner,
            lesson_num=next_num,
            slug=slug,
        ).info("learning next lesson generated")
        return next_num

    async def get_course(
        self, owner: str, course_id: str
    ) -> dict[str, Any] | None:
        """读取课程：``ready`` 时返回解析后的课程序列化 JSON，否则返回状态。

        Args:
            owner: 进度归属（user_id 或 anon_id）。
            course_id: 课程 ID。

        Returns:
            - 未找到 / ``failed``：None（由路由决定 404）。
            - ``pending``：``{"status": "pending"}``。
            - ``ready``：``{"status": "ready", "course": CoursePackage}``，
              ``course.lessons`` 只含已生成的课（仅按磁盘实际文件列表）。
        """
        progress = await self._repo.get_progress(owner, course_id)
        if progress is None or progress.status == "failed":
            return None

        if progress.status == "pending":
            return {"status": "pending"}

        course_dir = self._course_dir(course_id)
        lessons_dir = course_dir / "lessons"
        resource_path = course_dir / "resource.md"
        if not lessons_dir.exists() or not resource_path.exists():
            return None

        lessons = _assemble_lessons(lessons_dir)
        resource_md = resource_path.read_text(encoding="utf-8")

        return {
            "status": "ready",
            "course": CoursePackage(
                course_id=course_id,
                topic=progress.topic,
                lessons=lessons,
                resource_md=resource_md,
            ),
        }

    async def list_progress(self, owner: str) -> list[dict[str, Any]]:
        """列出 owner 的课程进度，每条含推导出的 ``next_session``。"""
        docs = await self._repo.list_progress(owner)
        result: list[dict[str, Any]] = []
        for doc in docs:
            result.append(
                {
                    "course_id": doc.course_id,
                    "topic": doc.topic,
                    "sessions_done": doc.sessions_done,
                    "mission_done": doc.mission_done,
                    "status": doc.status,
                    "next_session": doc.next_session,
                }
            )
        return result

    async def mark_progress(
        self,
        owner: str,
        course_id: str,
        *,
        session_done: int | None = None,
        mission_done: bool | None = None,
    ) -> dict[str, Any] | None:
        """标记进度：追加完成的 session 或设置 mission_done（幂等）。

        Returns:
            更新后的进度 dict；进度不存在返回 None。
        """
        if session_done is not None:
            await self._repo.add_session_done(owner, course_id, session_done)
        if mission_done is not None:
            await self._repo.set_mission_done(owner, course_id, mission_done)

        doc = await self._repo.get_progress(owner, course_id)
        if doc is None:
            return None
        return {
            "course_id": doc.course_id,
            "topic": doc.topic,
            "sessions_done": doc.sessions_done,
            "mission_done": doc.mission_done,
            "status": doc.status,
            "next_session": doc.next_session,
        }

    async def create_pending(
        self, owner: str, course_id: str, topic: str
    ) -> None:
        """API 提交阶段：先 upsert 一条 ``LearningProgress(status="pending")``。

        与 :meth:`generate_course` 的 ``_upsert_progress``（置 ``ready``）对称：
        API 收到主题后立刻落库一条 pending 记录，``course_id`` 同步返回给前端
        用于轮询；再 ``.kiq()`` 异步任务，最后由 worker 把状态置 ``ready``。

        复用 :meth:`LearningRepo.upsert_progress` 的并发安全语义（按唯一索引
        ``(owner, course_id)`` 处理 ``DuplicateKeyError``），原
        ``sessions_done`` / ``mission_done`` 不会被覆盖。
        """
        await self._repo.upsert_progress(
            owner=owner, course_id=course_id, topic=topic, status="pending"
        )

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

    # ── 内部 ──────────────────────────────────────────────────────── #

    async def _run_research(self, topic: str) -> str:
        """课程生成前的**研究步**（Exa + Context7 双工具，可选增强）。

        - ``self._research_agent`` 已注入：直接用它（测试 / 定制路径）。
        - 否则按 ``EXA_API_KEY`` 是否配置决定：未配置 → 跳过研究，返回
          空字符串（课程生成照常，优雅降级）；配置了 → 走
          :func:`create_research_agent` 构建 agent。
        - MCPTools 是 async context manager（须 connect / close），生命周期
          在 ``async with`` 内管理。
        - 研究失败不拖垮课程：异常仅记日志，返回空字符串。

        Returns:
            研究摘要 markdown（带来源 URL）；跳过或失败时为空字符串。
        """
        agent: Agent | None = self._research_agent
        if agent is None:
            # 未配置 EXA_API_KEY → 跳过研究（优雅降级）。
            if not get_settings().EXA_API_KEY:
                logger.bind(topic=topic).debug(
                    "learning research skipped: EXA_API_KEY not configured"
                )
                return ""
            try:
                agent = create_research_agent(
                    topic=topic, db=self._research_db
                )
            except Exception as exc:
                logger.bind(topic=topic).warning(
                    f"learning research agent init failed, skipping: {exc!r}"
                )
                return ""

        prompt = RESEARCH_USER_PROMPT_TEMPLATE.format(topic=topic)
        try:
            # 研究 agent 挂了 AsyncPostgresDb（异步 db）→ 必须用 ``arun``，
            # ``run`` 同步接口会抛 "use arun instead"。
            response = await agent.arun(prompt)
            summary = getattr(response, "content", "") or ""
            logger.bind(topic=topic, summary_len=len(str(summary))).info(
                "learning research step completed"
            )
            return str(summary)
        except Exception as exc:
            logger.bind(topic=topic).warning(
                f"learning research step failed, continuing without: {exc!r}"
            )
            return ""

    def _build_step_agent(self, instructions: str) -> Agent:
        """构建一份 step 专用 agent。

        - 若 ``self._agent`` 已注入（生产路径），以其 model / db 为模板新建
          一份并覆写 ``instructions``。不直接 ``deepcopy(agent)`` —— agno
          Agent 持有 run state / session 缓存，``deepcopy`` 会克隆它们，造
          成跨 step 的共享状态。
        - 否则走 factory：``create_deepseek_model()`` +
          ``create_postgres_db()``（异步 db，因此 step 调用必须用
          ``await agent.arun``）。DeepSeek 仅支持 json_object 模式，必须
          ``use_json_mode=True`` 才能让 ``response_format`` 走
          ``{"type": "json_object"}``，否则 agno 会把 Pydantic schema 直传
          DeepSeek，DeepSeek 会拒绝。
        """
        if self._agent is not None:
            return create_agent(
                model=self._agent.model,
                instructions=instructions,
                db=self._agent.db,
                tools=list(self._agent.tools or []),
                use_json_mode=getattr(self._agent, "use_json_mode", True),
                markdown=self._agent.markdown,
                add_history_to_context=self._agent.add_history_to_context,
                num_history_runs=self._agent.num_history_runs,
            )
        return create_agent(
            model=self._model or create_deepseek_model(),
            instructions=instructions,
            db=create_postgres_db(),
            tools=[create_web_search_tools()],
            use_json_mode=True,
        )

    def _course_dir(self, course_id: str) -> Path:
        root = self._tmp_dir
        if root is None:
            root = (
                Path(__file__).resolve().parent.parent.parent
                / "tmp"
                / "learning"
            )
        return Path(root) / course_id

    async def _run_step1(
        self,
        *,
        topic: str,
        course_id: str,
        previous_lesson_md: str = "",
        research_summary: str = "",
    ) -> LessonResourceOutput:
        """Step 1：调一次 agent 拿单个 lesson + 共享 resource。

        ``previous_lesson_md`` 非空时，把它追加到 user prompt 末尾作为
        "上一课" 的尾部上下文，让 LLM 生成衔接课程（ZPD）。

        ``research_summary`` 非空时，把研究摘要（带来源）注入 prompt，
        让 lesson / resource 引用关键事实与规格（Exa + Context7 研究步）。

        Step agent 挂 :func:`create_postgres_db`（异步 db），必须用
        ``await agent.arun`` 而非同步 ``.run``（agno 同步接口会抛
        "use arun instead"）。
        """
        step_agent = self._build_step_agent(STEP1_INSTRUCTIONS)
        prompt = STEP1_USER_PROMPT_TEMPLATE.format(
            topic=topic, course_id=course_id
        )
        if research_summary:
            prompt = (
                f"{prompt}\n\n"
                f"{RESEARCH_CONTEXT_HINT.format(research_summary=research_summary)}"
            )
        if previous_lesson_md:
            tail = previous_lesson_md[-1500:].strip()
            prompt = (
                f"{prompt}\n\n"
                f"## 上一课正文（尾部 1500 字）\n"
                f"在写新课时请衔接上文，避免重复或跳跃：\n\n"
                f"```markdown\n{tail}\n```"
            )
        response = await step_agent.arun(
            prompt, output_schema=LessonResourceOutput
        )
        return self._unwrap_step1(response)

    def _unwrap_step1(self, response: Any) -> LessonResourceOutput:
        """解析 step1 响应：``isinstance`` 命中 / dict 兜底 / str 失败。"""
        content = getattr(response, "content", None)
        if isinstance(content, LessonResourceOutput):
            return content
        if isinstance(content, dict):
            try:
                return LessonResourceOutput.model_validate(content)
            except Exception as exc:
                raise RuntimeError(
                    f"Step1 dict 校验失败: {exc}; raw={content!r}"
                ) from exc
        raise RuntimeError(
            f"Step1 解析失败：content 不是 LessonResourceOutput（type="
            f"{type(content).__name__}）；raw={content!r}"
        )

    async def _run_step2(
        self,
        topic: str,
        course_id: str,
    ) -> list[Mission]:
        """Step 2：取 mission list。失败重试 1 次，重试用更明确的指令。"""
        prompt = STEP2_USER_PROMPT_TEMPLATE.format(
            topic=topic, course_id=course_id
        )
        step_agent = self._build_step_agent(STEP2_INSTRUCTIONS)

        last_error: Exception | None = None
        for attempt in (1, 2):
            user_prompt = (
                prompt if attempt == 1 else f"{prompt}\n\n{STEP2_RETRY_HINT}"
            )
            response = await step_agent.arun(
                user_prompt, output_schema=MissionBundle
            )
            try:
                return self._unwrap_step2(response)
            except RuntimeError as exc:
                last_error = exc
            logger.bind(attempt=attempt).warning(
                "learning step2 output_schema parse failed, retrying"
            )

        raise RuntimeError(f"Step2 两次解析均失败：{last_error!r}")

    def _unwrap_step2(self, response: Any) -> list[Mission]:
        """解析 step2 响应：``isinstance`` 命中 / dict 兜底 / str 失败。"""
        content = getattr(response, "content", None)
        if isinstance(content, MissionBundle):
            return content.missions
        if isinstance(content, dict):
            try:
                bundle = MissionBundle.model_validate(content)
                return bundle.missions
            except Exception as exc:
                raise RuntimeError(
                    f"Step2 dict 校验失败: {exc}; raw={content!r}"
                ) from exc
        raise RuntimeError(
            f"Step2 解析失败：content 不是 MissionBundle（type="
            f"{type(content).__name__}）；raw={content!r}"
        )

    async def _upsert_progress(
        self, *, owner: str, course_id: str, topic: str
    ) -> None:
        """upsert ``LearningProgress``，状态置 ``ready``。

        暂时直接走 beanie Document 直存（task-335 的 ``LearningRepo`` 后续可
        平滑替换为 ``LearningRepo.upsert_progress``；唯一索引 (owner, course_id)
        的并发语义在两侧保持一致）。
        """
        existing = await _find_progress(owner, course_id)
        if existing is not None:
            existing.topic = topic
            existing.status = "ready"
            await existing.save()
            return

        doc = LearningProgress(
            owner=owner,
            course_id=course_id,
            topic=topic,
            status="ready",
            created_at=datetime.now(UTC),
        )
        try:
            await doc.insert()
        except DuplicateKeyError:
            # 并发：另一请求先插入，回退到 update 分支。
            existing = await _find_progress(owner, course_id)
            if existing is None:  # pragma: no cover - 极端竞态
                raise
            existing.topic = topic
            existing.status = "ready"
            await existing.save()


# ── 自由函数 ────────────────────────────────────────────────────────── #


def build_course_id(topic: str) -> str:
    """``course_id = <topic-slug>--<8hex>``，8hex 是 topic 文本的 sha1 前 8 位。

    使用 sha1 而非 md5 以避免历史碰撞顾虑；截断到 8 字符是 prototype
    约定的格式。slug 用 kebab-case（ASCII 小写 + 数字 + 连字符，合并
    连续分隔符）。
    """
    slug = _slugify(topic)
    digest = hashlib.sha1(topic.strip().encode("utf-8")).hexdigest()[:8]
    return f"{slug}--{digest}"


def _slugify(topic: str) -> str:
    """kebab-case 化：保留 ASCII 字母数字，其余折成 '-'，合并连续 '-'。"""
    raw = topic.strip().lower()
    slug = re.sub(r"[^a-z0-9]+", "-", raw)
    slug = slug.strip("-")
    return slug or "course"


def _slugify_label(text: str) -> str:
    """为 LLM 生成的 ``slug`` 字段兜底：同 ``_slugify`` 语义，但允许在
    ``text`` 为空 / 纯非 ASCII 时回退到 ``lesson``。
    """
    return _slugify(text) or "lesson"


async def _find_progress(
    owner: str, course_id: str
) -> LearningProgress | None:
    return await LearningProgress.find_one(
        LearningProgress.owner == owner,
        LearningProgress.course_id == course_id,
    )


# ── 磁盘扫描 helpers ───────────────────────────────────────────────── #


_LESSON_FILE_RE = re.compile(r"^(\d{4})-([a-z0-9][a-z0-9-]*)\.md$")


def _list_existing_lesson_ids(lessons_dir: Path) -> list[int]:
    """扫描 ``lessons/`` 目录，提取所有 lesson body 文件（不含 .exercise.md）
    的前导编号。返回的编号已排序。
    """
    if not lessons_dir.exists():
        return []
    ids: list[int] = []
    for path in lessons_dir.glob("*.md"):
        if path.name.endswith(".exercise.md"):
            continue
        m = _LESSON_FILE_RE.match(path.name)
        if m:
            ids.append(int(m.group(1)))
    ids.sort()
    return ids


def _parse_lesson_filename(
    name: str,
) -> tuple[int, str] | None:
    """解析 ``0001-<slug>.md`` → ``(1, "<slug>")``；不匹配返回 None。"""
    if name.endswith(".exercise.md"):
        return None
    m = _LESSON_FILE_RE.match(name)
    if not m:
        return None
    return int(m.group(1)), m.group(2)


def _last_lesson_md_tail(
    lessons_dir: Path, existing_ids: list[int]
) -> str | None:
    """取**最大编号** lesson 的 md 全文作为上一课上下文。"""
    if not existing_ids:
        return None
    last_id = existing_ids[-1]
    for path in lessons_dir.glob(f"{last_id:04d}-*.md"):
        if path.name.endswith(".exercise.md"):
            continue
        return path.read_text(encoding="utf-8")
    return None


def _assemble_lessons(lessons_dir: Path) -> list[LessonItem]:
    """扫描 ``lessons/`` 装配 :class:`LessonItem` 列表：按编号排序；
    每个 lesson body 从 front matter 抽 ``title``，否则回退到 slug 美化。
    练习题从同名 ``.exercise.md`` 解析（缺失则空 list）。
    """
    items: list[LessonItem] = []
    for path in sorted(lessons_dir.glob("*.md")):
        parsed = _parse_lesson_filename(path.name)
        if parsed is None:
            continue
        lesson_id, slug = parsed
        body = path.read_text(encoding="utf-8")
        title = _extract_title_from_front_matter(body) or slug.replace(
            "-", " "
        )

        exercise_path = lessons_dir / f"{lesson_id:04d}-{slug}.exercise.md"
        exercises: list[Mission] = []
        if exercise_path.exists():
            exercises = _parse_missions(
                exercise_path.read_text(encoding="utf-8")
            )

        items.append(
            LessonItem(
                id=lesson_id,
                title=title,
                slug=slug,
                md=body,
                exercises=exercises,
            )
        )
    return items


def _extract_title_from_front_matter(md_text: str) -> str | None:
    """从 lesson md 顶部 YAML front matter 抽 ``title``。容错优先。"""
    if not md_text.startswith("---"):
        return None
    end = md_text.find("\n---", 3)
    if end == -1:
        return None
    front_raw = md_text[3:end]
    try:
        payload = yaml.safe_load(front_raw)
    except yaml.YAMLError:
        return None
    if not isinstance(payload, dict):
        return None
    title = payload.get("title")
    if isinstance(title, str) and title.strip():
        return title.strip()
    return None


def _parse_missions(md_text: str) -> list[Mission]:
    """从 mission.md 的 YAML front matter 解析出 ``missions`` 列表。

    找不到 front matter 或字段缺失时返回空列表（不抛错，便于容错）。
    """
    if not md_text.startswith("---"):
        return []
    end = md_text.find("\n---", 3)
    if end == -1:
        return []
    front_raw = md_text[3:end]
    try:
        payload = yaml.safe_load(front_raw)
    except yaml.YAMLError:
        return []
    missions = (payload or {}).get("missions", [])
    if not isinstance(missions, list):
        return []
    parsed: list[Mission] = []
    for item in missions:
        if isinstance(item, dict):
            try:
                parsed.append(Mission.model_validate(item))
            except Exception:
                continue
    return parsed


def _render_mission_md(
    *,
    title: str,
    course_id: str,
    missions: list[Mission],
) -> str:
    """渲染 mission.md：YAML front matter（missions 列表原样序列化）+ 正文模板。

    YAML front matter 用 ``yaml.safe_dump`` 序列化，``missions`` 列表通过
    ``Mission.model_dump(mode="json")`` 转成原生 Python 对象，避免 ``!!python/object`` 标签。
    """
    payload = {
        "title": title,
        "course_id": course_id,
        "language": LANGUAGE,
        "mission_count": len(missions),
        "passing_score": 80,
        "missions": [m.model_dump(mode="json") for m in missions],
    }
    body_yaml = yaml.safe_dump(
        payload,
        allow_unicode=True,
        sort_keys=False,
        default_flow_style=False,
    )
    body_template = (
        "\n# 练习任务\n\n"
        "按顺序完成以下 mission。**通过标准：≥ 80 分（总分 100）。**\n\n"
        "## 做题说明\n\n"
        "- **选择题（single_choice / multi_choice）**：提交选项后立即判分，"
        "答错会看到 `explanation`。\n"
        "- **判断题（true_false）**：判断命题对错，提交后立即判分，"
        "同样会看到 `explanation`。\n"
        "- 全部完成后回到课程首页查看完成度与错题。\n\n"
        "## 完成标准\n\n"
        "- [ ] 全部 mission 提交后即时判分\n"
        "- [ ] 总分 ≥ 80 / 100，课程标记为完成"
    )
    return f"---\n{body_yaml}---{body_template}"


__all__ = [
    "LearningService",
    "LessonResourceOutput",
    "MissionBundle",
    "build_course_id",
]
