"""Course generation service (task-374 C2 拆分：生成编排 + 混合读 + agent 构造).

从 fat :class:`app.services.learning_service.LearningService` 拆出的**生成侧**
service：课程生成编排（``generate_course`` / ``generate_next_lesson``）、两个
混合读（``get_course`` / ``preview_next_lesson``）与 course agent 构造
（``_build_course_agent`` / ``_generate_lesson``）。模块持有顶层 schema
``NextLessonContext``。

与纯进度侧 :class:`app.services.learning_progress_service.LearningProgressService`
的边界（C2）：本类**不直接持有 ``LearningRepo``**，进度读写全部在构造时注入
的 ``progress_svc`` 上进行——

- ``generate_course`` 成功落盘后经 ``progress_svc.mark_ready`` 置 ``ready``
  （替代原 ``LearningService._repo.upsert_progress(status="ready")``）。
- ``get_course`` / ``preview_next_lesson`` 经
  ``progress_svc.get_progress_or_expire`` 取状态门（None/failed→None、
  pending→{"status":"pending"}）与 topic / goal / session_id；pending 超
  ``LEARNING_PENDING_TTL_MINUTES`` 未就绪即置 ``failed``（读侧惰性恢复，
  卡死任务不再永久 pending）。

依赖方向：handler → service → repo；service → service（本类 → 纯进度类）
单向向下，无循环。

agent_driven 重构（task-3551/3552/3553）后，课程生成为**一次主 agent run**：

- 单一课程 agent 绑定四个写磁盘工具（save_lesson / save_resource /
  save_mission / save_exercise）+ 一个只读 ``FileTools(base_dir=repo.root)``
  + 可选研究工具（Exa + Context7），在一次 ``arun`` 内自主完成「写课 + 写
  resource + 出题」——四件套（lesson / resource / mission / exercise）全部由
  agent 经工具落盘，service 在 run 结束后只从磁盘读回，**不解析最终响应**
  （无 ``output_schema``）。
- 一课一文件落盘到 ``<learning-root>/<course-id>/lessons/0001-<slug>.md``
  （learning-root 默认 ``<backend>/tmp/learning``，可用 ``LEARNING_ROOT_DIR``
  环境变量配置；课程包布局统一由 :class:`CoursePackageRepo` 拥有）。
- ``LearningProgress`` 统一经注入的 ``progress_svc`` 持久化（mark_ready /
  get_progress），不感知 agno / DeepSeek / 磁盘布局。

设计依据：
- spec：``task-334``（PR #22 决策 #24 课程包结构）、``task-351``（一课一文件 +
  渐进产出）、``task-3553``（三步流水线 → 一次 course agent run）、
  ``task-374``（C2 拆分 fat LearningService）
- 无 ``output_schema``（练习由 ``save_exercise`` 工具落盘）→ 不再依赖 DeepSeek
  JSON mode，``use_json_mode=False``；``arun`` 的最终响应内容被忽略，根治了
  「模型把工具结果回显进最终响应 → 解析失败 → 整轮重试」这一类问题。
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any
from uuid import uuid4

from agno.agent import Agent
from agno.models.base import Model

from app.core.config import get_settings
from app.core.llm_factory import (
    create_agent,
    create_deepseek_model,
    create_postgres_db,
)
from app.core.llm_prompts import (
    COURSE_AGENT_INSTRUCTIONS,
    COURSE_AGENT_NEXT_LESSON_HINT,
    COURSE_AGENT_RETRY_HINT,
    COURSE_AGENT_USER_PROMPT_TEMPLATE,
    DEFAULT_GOAL_HINT,
)
from app.core.logger import logger
from app.repositories.course_package_repo import CoursePackageRepo
from app.schemas.learning import CoursePackage
from app.services.learning_progress_service import LearningProgressService
from app.services.learning_tools import create_learning_tools
from app.services.learning_utils import build_course_id

# ── 顶层 schema ─────────────────────────────────────────────────────── #


@dataclass(frozen=True)
class NextLessonContext:
    """``preview_next_lesson`` 的返回：进度 + 磁盘预检结果（C3 吸收进 C1）。

    一次调用带回 handler 需要的全部信息——幂等预检（``next_num`` /
    ``already_generated``）与 ``.kiq()`` 转发所需的 topic / goal / session_id
    ——让 API 层不再打穿 service 私有属性。
    """

    next_num: int
    already_generated: bool
    topic: str
    goal: str | None
    session_id: str | None


# ── service ─────────────────────────────────────────────────────────── #


class CourseGeneratorService:
    """课程生成 service：一次 course agent run + 一课一文件 + 渐进产出（C2 生成侧）。

    Args:
        model: 可选注入；为 None 时用 ``create_deepseek_model()`` 默认值。
            测试时可注入 mock。
        agent: 可选注入；为 None 时按 model + 默认 db 即时构建。
            :meth:`_build_course_agent` 注入时以其 model / db 为模板新建一份，
            避免 ``deepcopy(agent)`` 复制 run state / session 缓存带来的
            共享状态风险。
        tmp_dir: 课程包根目录；为 None 时依次取 ``LEARNING_ROOT_DIR`` 环境变量、
            无则回退 ``<backend>/tmp/learning``。单元测试可注入
            :class:`pathlib.Path` 指向临时目录。
        progress_svc: 进度领域 service（**必填**，C2 拆分后本类不再持有
            ``LearningRepo``）：生成成功经
            :meth:`LearningProgressService.mark_ready` 落库，混合读经
            :meth:`LearningProgressService.get_progress` 取状态门。
    """

    def __init__(
        self,
        *,
        model: Model | None = None,
        agent: Agent | None = None,
        tmp_dir: Path | None = None,
        progress_svc: LearningProgressService,
    ) -> None:
        self._model = model
        self._agent = agent
        self._tmp_dir = tmp_dir
        self._progress_svc = progress_svc

    # ── 公开 API ────────────────────────────────────────────────────── #

    async def generate_course(
        self,
        topic: str,
        owner: str,
        goal: str | None = None,
        course_id: str | None = None,
    ) -> str:
        """生成**第 1 课**并落盘，经 ``progress_svc.mark_ready`` 落 ready 进度。

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
            goal: 学习目标（可选），透传给课程 agent 组织 MISSION.md 文案。
            course_id: 课程 ID。由调用方（API 层已生成并 upsert pending）传入，
                保证同一请求内 pending 与 ready 指向同一条记录；为 None 时内部
                用 :func:`build_course_id` 新生成一个（每次不同，不幂等）。

        Returns:
            ``course_id``，格式 ``<slug>--<8hex>``。

        Raises:
            RuntimeError: 单次 agent run 失败或 run 后产物缺失（body /
                exercise 文件未落盘）。
        """
        ## 生成course_id session_id 不重复
        course_id = course_id or build_course_id(topic)
        session_id = uuid4().hex

        logger.bind(
            course_id=course_id,
            session_id=session_id,
            topic=topic,
            owner=owner,
        ).info("func:generate_course: start")

        # 一步生成第 1 课（无上一课上下文），落盘三文件。课程包布局 / 编号 /
        await self._generate_lesson(
            topic=topic,
            course_id=course_id,
            owner=owner,
            lesson_num=1,
            goal=goal,
            session_id=session_id,
        )

        # 标记进度为ready
        await self._progress_svc.mark_ready(
            owner=owner,
            course_id=course_id,
            topic=topic,
            goal=goal,
            session_id=session_id,
        )

        logger.bind(course_id=course_id, owner=owner, lesson_num=1).info(
            "learning course lesson-0001 generated"
        )
        return course_id

    async def generate_next_lesson(
        self,
        topic: str,
        owner: str,
        course_id: str,
        goal: str | None = None,
        session_id: str | None = None,
    ) -> int | None:
        """渐进产出：生成**下一课**并落盘。

        幂等策略：以磁盘上已存在的 ``lessons/000N-<slug>.md`` 文件为准，
        ``next_num = max(existing ids) + 1``；若该编号对应的文件已存在
        （重试 / 并发场景），**直接返回 None**，不重复生成。

        ZPD（最近发展区）上下文：由 agent 通过 ``FileTools.read_file`` 工具
        自读上一课正文，service 不再拼进 prompt。

        会话记忆（task-373）：``session_id`` 由 API/task 层从
        ``LearningProgress.session_id`` 读出后透传，复用首课锚定的同一 agno
        会话，让前几轮的对话 / 工具记录被回放进 context，agent 跨轮记住上下文。

        Args:
            topic: 原始主题（用于 prompt）。
            owner: 进度归属（仅用于日志，不再写 progress）。
            course_id: 课程 ID。
            session_id: 已锚定的 agno 会话 ID（可选）；非 None 时传给 agent，
                否则按 agno 默认行为新开会话（仅用于单元测试 / 历史调用）。

        Returns:
            新课的编号；若有冲突（已存在）则返回 None。
        """
        # 1. 扫 lessons/ 找 next_num（idempotent：已存在 → 直接返回 None）。
        #    编号 / 扫描委托 CoursePackageRepo，与 agent 工具内 write_lesson 的
        #    编号逻辑同一份。
        repo = CoursePackageRepo(course_id=course_id, tmp_dir=self._tmp_dir)
        next_num = repo.next_lesson_num()

        # 防御：极端 race（两个 worker 同时跑同一个 course），文件已存在 →
        # 视为幂等成功。
        if repo.lesson_file_exists(next_num):
            logger.bind(
                course_id=course_id, owner=owner, lesson_num=next_num
            ).info("learning next lesson already exists, skipping")
            return None

        # 2. 生成并落盘下一课（ZPD 衔接由 agent 经 read_previous_lesson 工具完成；
        #    goal 转发保证 prompt 与 MISSION.md 目标一致；session_id 复用首课
        #    锚定的会话，让 agent 跨轮记住前序 run 的消息；repo 与 agent 工具
        #    共用同一实例，exercise 配对直接消费 repo.last_written_lesson）
        await self._generate_lesson(
            topic=topic,
            course_id=course_id,
            owner=owner,
            lesson_num=next_num,
            goal=goal,
            session_id=session_id,
            repo=repo,
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
        progress = await self._progress_svc.get_progress_or_expire(
            owner,
            course_id,
            ttl_minutes=get_settings().LEARNING_PENDING_TTL_MINUTES,
        )
        if progress is None or progress.status == "failed":
            return None

        if progress.status == "pending":
            return {"status": "pending"}

        repo = CoursePackageRepo(course_id=course_id, tmp_dir=self._tmp_dir)
        if not repo.has_lessons() or not repo.has_resource():
            return None

        lessons = repo.assemble_lessons()
        resource_md = repo.read_resource() or ""
        # MISSION.md 缺失（旧课程 / 未生成）→ mission_md 为 None，前端隐藏展示。
        mission_md = repo.read_mission()

        return {
            "status": "ready",
            "course": CoursePackage(
                course_id=course_id,
                topic=progress.topic,
                lessons=lessons,
                resource_md=resource_md,
                mission_md=mission_md,
            ),
        }

    async def preview_next_lesson(
        self, owner: str, course_id: str
    ) -> NextLessonContext | None:
        """同步预检「下一课」：进度 + 磁盘 next_num，供 API 层做幂等预检。

        C3 吸收进 C1 后的接缝修复：handler 不再打穿 ``_repo`` / ``_course_dir``
        / 裸扫描磁盘，只调本公开方法。一次调用带回：

        - ``next_num``：预期下一课编号（磁盘最大编号 + 1）；
        - ``already_generated``：该编号文件是否已存在（幂等命中）；
        - ``topic`` / ``goal`` / ``session_id``：``.kiq()`` 转发所需的进度字段。

        磁盘规则委托 :class:`CoursePackageRepo`，与
        :meth:`generate_next_lesson` 内部用的是同一份逻辑，handler 与 worker
        不再可能算错两版。

        Args:
            owner: 进度归属（user_id 或 anon_id）。
            course_id: 课程 ID。

        Returns:
            进度不存在 / ``failed`` → None；否则 :class:`NextLessonContext`。
        """
        progress = await self._progress_svc.get_progress_or_expire(
            owner,
            course_id,
            ttl_minutes=get_settings().LEARNING_PENDING_TTL_MINUTES,
        )
        if progress is None or progress.status == "failed":
            return None

        repo = CoursePackageRepo(course_id=course_id, tmp_dir=self._tmp_dir)
        next_num = repo.next_lesson_num()
        return NextLessonContext(
            next_num=next_num,
            already_generated=repo.lesson_file_exists(next_num),
            topic=progress.topic,
            goal=progress.goal,
            session_id=progress.session_id,
        )

    # ── 内部 ──────────────────────────────────────────────────────── #

    async def _build_course_agent(self, repo: CoursePackageRepo) -> Agent:
        """构建**单一课程 agent**（agent_driven 重构核心路径，task-3553 已切换）。

        为「一次主 agent run」提供 agent：

        - **instructions** 用融合的 :data:`COURSE_AGENT_INSTRUCTIONS`
          （写课 + 出题 + 工具使用 + 研究 + ZPD 说明），不再分 Step1 / Step2。
        - **tools 显式传**：:func:`create_learning_tools` 返回的四个写磁盘工具
          （save_lesson / save_resource / save_mission / save_exercise）+ 一个
          只读 ``FileTools(base_dir=repo.root, enable_read_file=True)`` 为基底；
          配置了 ``EXA_API_KEY`` 时再追加研究工具（ExaTools + Context7
          MCPTools），未配置则不挂（优雅降级——agent 上下文里没有搜索工具，
          自然跳过研究）。
        - 注入 ``self._agent`` 时以其 model / db 为模板新建一份；否则走 factory
          ``create_deepseek_model`` + ``create_postgres_db``。

        无 ``output_schema``（练习由 ``save_exercise`` 工具落盘）→
        ``use_json_mode=False``，不再要求 DeepSeek JSON-mode 合规。

        Args:
            repo: 课程包仓库实例，传给 :func:`create_learning_tools` 薄适配器
                （与 service 的 exercise 配对共用同一实例）。

        Returns:
            已绑定 learning tools（+ 可选研究工具）与
            :data:`COURSE_AGENT_INSTRUCTIONS` 的 :class:`Agent`。
        """
        tools = list(create_learning_tools(repo))

        exa_api_key = get_settings().EXA_API_KEY
        if exa_api_key:
            # 课程 agent 研究工具裁剪（task-3553）：Exa 全子工具 + Context7
            # MCPTools。MCPTools 作为 agent 常驻工具时生命周期由 agno 自动管理
            # （arun 内 connect / 结束后 disconnect），无需手动 async with。
            from agno.tools.exa import ExaTools
            from agno.tools.mcp import MCPTools

            ctx7 = MCPTools(
                transport="streamable-http",
                url="https://mcp.context7.com/mcp",
            )
            try:
                await ctx7.connect()
            except Exception as exc:
                logger.warning(
                    "Context7 MCP connect failed, dropping tool",
                    error=str(exc),
                )
                await ctx7.close()  # 失败也 close 清理
                ctx7 = None
            if ctx7 is not None:
                tools.append(ctx7)  # pyright: ignore[reportArgumentType]

            tools.append(
                ExaTools(api_key=exa_api_key, all=True, show_results=True),  # pyright: ignore[reportArgumentType]
            )

        if self._agent is not None:
            # 只透传 create_agent 不硬编码、且不会与默认值冲突的模板属性
            # （model / db / tools）。markdown / add_history_to_context /
            # num_history_runs 被 create_agent 硬编码，透传会触发
            # "got multiple values for keyword argument"（注入路径的既有缺陷，
            # 本方法不复刻）。
            return create_agent(
                model=self._agent.model,  # pyright: ignore[reportArgumentType]
                instructions=COURSE_AGENT_INSTRUCTIONS,
                db=self._agent.db,  # pyright: ignore[reportArgumentType]
                tools=tools,
                use_json_mode=False,
            )
        return create_agent(
            model=self._model or create_deepseek_model(),
            instructions=COURSE_AGENT_INSTRUCTIONS,
            db=create_postgres_db(),
            tools=tools,
            use_json_mode=False,
        )

    async def _generate_lesson(
        self,
        *,
        topic: str,
        course_id: str,
        owner: str,
        lesson_num: int,
        goal: str | None = None,
        session_id: str | None = None,
        repo: CoursePackageRepo | None = None,
    ) -> None:
        """一次主 agent run 生成一课：四件套全部由 agent 经工具写盘。

        - 不再有独立研究步：研究由主 agent 的 ExaTools（配置了
          ``EXA_API_KEY`` 时）自主接管。
        - lesson body / resource.md / MISSION.md / exercise.md **全部由 agent
          在 run 内经工具写盘**（编号 / 幂等全在 :class:`CoursePackageRepo`）；
          ``arun`` **不带 ``output_schema``**，最终响应内容被忽略。
        - run 结束后 service 只从磁盘读回：``repo.last_written_lesson``
          （本次 run 刚写的 ``num / slug``）+ :meth:`CoursePackageRepo.read_exercises`
          解析练习题——与 lesson body 严格同名配对，不再从磁盘反推，一次 run
          写多课或重试顺序变化不会错位。

        会话记忆（task-373）：把 ``session_id`` 传给 ``Agent.arun``，让 agno
        复用同一会话（``create_agent`` 已硬编码 ``add_history_to_context=True,
        num_history_runs=20``），前序 run 的消息会被回放进 context。首课时
        ``session_id`` 由 :meth:`generate_course` 锚定并落库到
        ``LearningProgress.session_id``；后续 :meth:`generate_next_lesson` 从
        progress 读出后透传。两轮都传同一个 session_id（包括兜底重试的
        attempt 2），agent 能看到上一轮为何失败。

        兜底重试（task-3554）：run 结束后的「磁盘缺 body 文件」或「缺 exercise
        文件」触发**整 run 重试一次**——第二次 run 用
        :data:`COURSE_AGENT_RETRY_HINT` 追加到用户消息，指示 agent 补调
        ``save_lesson`` / ``save_exercise`` 落盘；两次均失败则抛
        ``RuntimeError``。重试只覆盖 run **之后**的校验失败；``arun`` 本身抛错
        不重试（直接上抛）。
        """
        # 共享 repo：agent 工具写盘与 service 的 exercise 配对用同一实例，run 后
        # 直接消费 repo.last_written_lesson，不做磁盘反推。
        repo = repo or CoursePackageRepo(
            course_id=course_id, tmp_dir=self._tmp_dir
        )
        course_agent = await self._build_course_agent(repo)
        base_prompt = COURSE_AGENT_USER_PROMPT_TEMPLATE.format(
            topic=topic,
            course_id=course_id,
            goal=goal or DEFAULT_GOAL_HINT,
        )
        # 渐进产出路径（lesson_num > 1）：把"必须推进"提示拼到 base prompt
        # 末尾,避免 LLM 在同主题复用 session_id 时倾向复制首课。
        # 重试 attempt 2 也保留这条 hint,因为约束(不要重复结构/示例/
        # slug)与重试目标(补齐 lesson/exercise)正交。
        if lesson_num > 1:
            base_prompt = base_prompt + "\n\n" + COURSE_AGENT_NEXT_LESSON_HINT
        retry_prompt = base_prompt + "\n\n" + COURSE_AGENT_RETRY_HINT

        last_error: RuntimeError | None = None
        for attempt in (1, 2):
            prompt = retry_prompt if attempt == 2 else base_prompt
            # 无 output_schema：产物全部由 agent 经工具落盘，最终响应内容忽略。
            await course_agent.arun(prompt, session_id=session_id)
            try:
                # exercise 文件配对：本次 run 内 save_lesson 已把 (num, slug)
                # 记录在 repo.last_written_lesson。缺新课（agent 漏调
                # save_lesson）→ RuntimeError 触发整 run 重试（task-3554）。
                written = repo.last_written_lesson
                if written is None or written.skipped:
                    raise RuntimeError(
                        "CourseAgent run 后未写新课，无法落盘 exercise 文件"
                    )

                # 练习题由 agent 经 save_exercise 工具直接落盘，run 后从磁盘读回；
                # 缺文件 / 解析为空（agent 漏调 save_exercise 或内容非法）→ 重试。
                exercises = repo.read_exercises(written.num, written.slug)
                if not exercises:
                    raise RuntimeError(
                        "CourseAgent run 后未落盘练习题（未调用 save_exercise 或"
                        "内容非法），无法配对 exercise 文件"
                    )

                logger.bind(
                    course_id=course_id,
                    owner=owner,
                    lesson_num=written.num,
                    slug=written.slug,
                    attempt=attempt,
                    exercise_count=len(exercises),
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


__all__ = [
    "CourseGeneratorService",
    "NextLessonContext",
]
