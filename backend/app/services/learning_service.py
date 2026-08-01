"""Learning course generation service (D2/D3 决策, task-351 重构, task-3553 切换 agent_driven).

agent_driven 重构（task-3551/3552/3553）后，课程生成为**一次主 agent run**：

- 单一课程 agent 绑定三个磁盘工具（save_lesson / save_resource /
  read_previous_lesson）+ 可选研究工具（Exa + Context7），在一次 ``arun``
  内自主完成「写课 + 写 resource + 出题」，最终响应解析为 ``MissionBundle``。
- 一课一文件落盘到 ``<learning-root>/<course-id>/lessons/0001-<slug>.md``
  （learning-root 默认 ``<backend>/tmp/learning``，可用 ``LEARNING_ROOT_DIR``
  环境变量配置，见 :meth:`_course_dir`）；
  同目录 ``0001-<slug>.exercise.md`` 由 service 在 run 后按「最大编号 + 同名
  slug」落盘，与 lesson body 严格同名对应；``resource.md`` 由 agent 经
  ``save_resource`` 写盘。YAML front matter 用 ``yaml.safe_dump`` 序列化。
- ``LearningProgress`` 统一经 ``LearningRepo`` 持久化（upsert / 查询 / 合并）。

设计依据：
- spec：``task-334``（PR #22 决策 #24 课程包结构）、``task-351``（一课一文件 + 渐进产出）、
  ``task-3553``（三步流水线 → 一次 course agent run）
- DeepSeek 仅支持 JSON mode（``json_object``），不支持原生 json_schema；
  ``agno.models.deepseek.DeepSeek.supports_native_structured_outputs=False``
  → 必须在 ``create_agent`` 显式 ``use_json_mode=True``，否则
  ``response_format`` 仍走 ``output_schema`` 直传，DeepSeek 会拒绝。
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from agno.agent import Agent
from agno.models.base import Model
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.core.llm_factory import (
    create_agent,
    create_deepseek_model,
    create_postgres_db,
)
from app.core.llm_prompts import (
    COURSE_AGENT_INSTRUCTIONS,
    COURSE_AGENT_RETRY_HINT,
    COURSE_AGENT_USER_PROMPT_TEMPLATE,
)
from app.core.logger import logger
from app.repositories.learning_repo import LearningRepo
from app.schemas.learning import CoursePackage, Mission
from app.services.learning_tools import create_learning_tools
from app.services.learning_utils import (
    _assemble_lessons,
    _lesson_slug_for_num,
    _progress_to_dict,
    _render_mission_md,
    _unwrap_model,
    build_course_id,
    lesson_file_exists,
    list_existing_lesson_ids,
)

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
    """course agent run 的 output_schema：一课练习任务清单。"""

    missions: list[Mission] = Field(default_factory=list)


# ── service ─────────────────────────────────────────────────────────── #


class LearningService:
    """课程生成 service：一次 course agent run + 一课一文件 + 渐进产出。

    Args:
        model: 可选注入；为 None 时用 ``create_deepseek_model()`` 默认值。
            测试时可注入 mock。
        agent: 可选注入；为 None 时按 model + 默认 db 即时构建。
            :meth:`_build_course_agent` 注入时以其 model / db 为模板新建一份，
            避免 ``deepcopy(agent)`` 复制 run state / session 缓存带来的
            共享状态风险。
        tmp_dir: 课程包根目录；为 None 时依次取 ``LEARNING_ROOT_DIR`` 环境变量、
            无则回退 ``<backend>/tmp/learning``。单元测试可注入 :class:`pathlib.Path`
            指向临时目录。
        repo: 可选的进度仓库；为 None 时用 :class:`LearningRepo` 默认实例。
    """

    def __init__(
        self,
        *,
        model: Model | None = None,
        agent: Agent | None = None,
        tmp_dir: Path | None = None,
        repo: LearningRepo | None = None,
    ) -> None:
        self._model = model
        self._agent = agent
        self._tmp_dir = tmp_dir
        self._repo = repo or LearningRepo()

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
            RuntimeError: 单次 agent run 失败或 ``MissionBundle`` 响应无法解析。
        """
        course_id = build_course_id(topic)
        course_dir = self._course_dir(course_id)
        lessons_dir = course_dir / "lessons"
        lessons_dir.mkdir(parents=True, exist_ok=True)

        # 一步生成第 1 课（无上一课上下文），落盘三文件。
        await self._generate_lesson(
            topic=topic,
            course_id=course_id,
            lessons_dir=lessons_dir,
            owner=owner,
            lesson_num=1,
        )

        # 落盘成功后再持久化进度，避免半成品状态。
        await self._repo.upsert_progress(
            owner=owner, course_id=course_id, topic=topic, status="ready"
        )

        logger.bind(
            course_id=course_id, owner=owner, lesson_num=1
        ).info("learning course lesson 1 generated")
        return course_id

    async def generate_next_lesson(
        self, topic: str, owner: str, course_id: str
    ) -> int | None:
        """渐进产出：生成**下一课**并落盘。

        幂等策略：以磁盘上已存在的 ``lessons/000N-<slug>.md`` 文件为准，
        ``next_num = max(existing ids) + 1``；若该编号对应的文件已存在
        （重试 / 并发场景），**直接返回 None**，不重复生成。

        ZPD（最近发展区）上下文：由 agent 通过 ``read_previous_lesson()`` 工具
        自读上一课正文，service 不再拼进 prompt。

        Args:
            topic: 原始主题（用于 prompt）。
            owner: 进度归属（仅用于日志，不再写 progress）。
            course_id: 课程 ID。

        Returns:
            新课的编号；若有冲突（已存在）则返回 None。
        """
        course_dir = self._course_dir(course_id)
        lessons_dir = course_dir / "lessons"

        # 1. 扫 lessons/ 找 next_num（idempotent：已存在 → 直接返回 None）
        existing_ids = list_existing_lesson_ids(lessons_dir)
        next_num = (max(existing_ids) + 1) if existing_ids else 1

        # 防御：极端 race（两个 worker 同时跑同一个 course），文件已存在 →
        # 视为幂等成功。
        if lesson_file_exists(lessons_dir, next_num):
            logger.bind(
                course_id=course_id, owner=owner, lesson_num=next_num
            ).info("learning next lesson already exists, skipping")
            return None

        lessons_dir.mkdir(parents=True, exist_ok=True)

        # 2. 生成并落盘下一课（ZPD 衔接由 agent 经 read_previous_lesson 工具完成）
        await self._generate_lesson(
            topic=topic,
            course_id=course_id,
            lessons_dir=lessons_dir,
            owner=owner,
            lesson_num=next_num,
        )

        logger.bind(
            course_id=course_id,
            owner=owner,
            lesson_num=next_num,
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
        return [_progress_to_dict(doc) for doc in docs]

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
        doc = None
        if session_done is not None:
            doc = await self._repo.add_session_done(owner, course_id, session_done)
        if mission_done is not None:
            doc = await self._repo.set_mission_done(owner, course_id, mission_done)
        if doc is None:
            # 无 mutation 时补读一次；mutation 已返回同步后的最新文档。
            doc = await self._repo.get_progress(owner, course_id)
        if doc is None:
            return None
        return _progress_to_dict(doc)

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

    def _build_course_agent(self, course_dir: str | Path) -> Agent:
        """构建**单一课程 agent**（agent_driven 重构核心路径，task-3553 已切换）。

        为「一次主 agent run」提供 agent：

        - **instructions** 用融合的 :data:`COURSE_AGENT_INSTRUCTIONS`
          （写课 + 出题 + 工具使用 + 研究 + ZPD 说明），不再分 Step1 / Step2。
        - **tools 显式传**：:func:`create_learning_tools` 返回的三个磁盘工具
          （save_lesson / save_resource / read_previous_lesson）为基底；配置了
          ``EXA_API_KEY`` 时再追加研究工具（ExaTools + Context7 MCPTools），
          未配置则不挂（优雅降级——agent 上下文里没有搜索工具，自然跳过研究）。
        - 注入 ``self._agent`` 时以其 model / db 为模板新建一份；否则走 factory
          ``create_deepseek_model`` + ``create_postgres_db``。

        ``use_json_mode=True`` 必须保留：DeepSeek 仅支持 JSON mode
        （``json_object``），不支持原生 ``json_schema``。

        Args:
            course_dir: 课程包根目录，传给 :func:`create_learning_tools` 闭包。

        Returns:
            已绑定 learning tools（+ 可选研究工具）与
            :data:`COURSE_AGENT_INSTRUCTIONS` 的 :class:`Agent`。
        """
        tools = list(create_learning_tools(course_dir))

        exa_api_key = get_settings().EXA_API_KEY
        if exa_api_key:
            # 课程 agent 研究工具裁剪（task-3553）：Exa 全子工具 + Context7
            # MCPTools。MCPTools 作为 agent 常驻工具时生命周期由 agno 自动管理
            # （arun 内 connect / 结束后 disconnect），无需手动 async with。
            from agno.tools.exa import ExaTools
            from agno.tools.mcp import MCPTools

            tools.extend(
                [
                    ExaTools(api_key=exa_api_key, all=True, show_results=True),
                    MCPTools(
                        transport="streamable-http",
                        url="https://mcp.context7.com/mcp",
                    ),
                ]
            )

        if self._agent is not None:
            # 只透传 create_agent 不硬编码、且不会与默认值冲突的模板属性
            # （model / db / tools / use_json_mode）。markdown / add_history_to_context
            # / num_history_runs 被 create_agent 硬编码，透传会触发
            # "got multiple values for keyword argument"（注入路径的既有缺陷，
            # 本方法不复刻）。
            return create_agent(
                model=self._agent.model,
                instructions=COURSE_AGENT_INSTRUCTIONS,
                db=self._agent.db,
                tools=tools,
                use_json_mode=getattr(self._agent, "use_json_mode", True),
            )
        return create_agent(
            model=self._model or create_deepseek_model(),
            instructions=COURSE_AGENT_INSTRUCTIONS,
            db=create_postgres_db(),
            tools=tools,
            use_json_mode=True,
        )

    async def _generate_lesson(
        self,
        *,
        topic: str,
        course_id: str,
        lessons_dir: Path,
        owner: str,
        lesson_num: int,
    ) -> None:
        """一次主 agent run 生成一课 + service 落盘 exercise 文件（task-3553）。

        - 不再有独立研究步：研究由主 agent 的 ExaTools（配置了
          ``EXA_API_KEY`` 时）自主接管。
        - lesson body / resource.md 由 agent 在 run 内通过 save_lesson /
          save_resource 工具写盘（编号 / 幂等全在工具内）。
        - ZPD 衔接由 agent 经 ``read_previous_lesson()`` 工具自读，service
          不拼进 prompt。
        - 最终响应解析为 ``MissionBundle``；exercise 文件由 service 在 run
          后按「最大编号 + 同名 slug」落盘，与 lesson body 严格同名对应。

        兜底重试（task-3554）：run 结束后的「磁盘缺 body 文件」或
        「MissionBundle 解析失败」触发**整 run 重试一次**——第二次 run 用
        :data:`COURSE_AGENT_RETRY_HINT` 追加到用户消息，指示 agent 补调
        ``save_lesson`` 落盘、返回严格合法的 ``MissionBundle`` JSON；两次均
        失败则抛 ``RuntimeError``。重试只覆盖 run **之后**的校验失败；
        ``arun`` 本身抛错不重试（直接上抛）。
        """
        course_agent = self._build_course_agent(lessons_dir.parent)
        base_prompt = COURSE_AGENT_USER_PROMPT_TEMPLATE.format(
            topic=topic, course_id=course_id
        )
        retry_prompt = base_prompt + "\n\n" + COURSE_AGENT_RETRY_HINT

        last_error: RuntimeError | None = None
        for attempt in (1, 2):
            prompt = retry_prompt if attempt == 2 else base_prompt
            response = await course_agent.arun(
                prompt, output_schema=MissionBundle
            )
            try:
                bundle = _unwrap_model(response, MissionBundle, "CourseAgent")

                # exercise 文件名确定：工具已在 run 内写盘 lesson body，service
                # 无从得知 num/slug，只能从磁盘反向推导 —— 本次 run 刚写的课 =
                # 最大编号，再 glob 该编号的 lesson body 文件名取 slug（与
                # _parse_lesson_filename 共用同一命名约定）。
                existing_ids = list_existing_lesson_ids(lessons_dir)
                num = max(existing_ids) if existing_ids else lesson_num
                slug = _lesson_slug_for_num(lessons_dir, num)
                if slug is None:
                    raise RuntimeError(
                        f"CourseAgent run 后未在 {lessons_dir} 找到 lesson body "
                        f"(num={num})，无法落盘 exercise 文件"
                    )

                (lessons_dir / f"{num:04d}-{slug}.exercise.md").write_text(
                    _render_mission_md(
                        title=f"课程练习:{topic}",
                        course_id=course_id,
                        missions=bundle.missions,
                    ),
                    encoding="utf-8",
                )

                logger.bind(
                    course_id=course_id,
                    owner=owner,
                    lesson_num=num,
                    slug=slug,
                    attempt=attempt,
                ).info("learning lesson generated")
                return
            except RuntimeError as exc:
                last_error = exc
                logger.bind(
                    course_id=course_id,
                    owner=owner,
                    lesson_num=lesson_num,
                    attempt=attempt,
                ).warning(
                    "learning lesson attempt failed, will retry once"
                    if attempt == 1
                    else "learning lesson failed after retry",
                    error=str(exc),
                )

        raise RuntimeError(
            f"CourseAgent 生成课程失败（已重试一次）: {last_error}"
        ) from last_error

    def _course_dir(self, course_id: str) -> Path:
        """课程包根目录：``self._tmp_dir`` 注入 > ``LEARNING_ROOT_DIR`` env > 默认值。"""
        root = self._tmp_dir
        if root is None:
            configured = get_settings().LEARNING_ROOT_DIR
            root = Path(configured) if configured else (
                Path(__file__).resolve().parent.parent.parent
                / "tmp"
                / "learning"
            )
        return Path(root) / course_id


__all__ = [
    "LearningService",
    "LessonResourceOutput",
    "MissionBundle",
]
