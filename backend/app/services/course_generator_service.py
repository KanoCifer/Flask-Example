"""Course generation service"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any
from uuid import uuid4

from agno.agent import Agent
from agno.models.base import Model

from app.core.config import get_settings
from app.core.logger import logger
from app.repositories.course_package_repo import CoursePackageRepo
from app.schemas.learning import CoursePackage
from app.services.course_agent_runner import CourseAgentRunner
from app.services.learning_progress_service import LearningProgressService
from app.services.learning_utils import build_course_id

# ── 顶层 schema ─────────────────────────────────────────────────────── #


@dataclass(frozen=True)
class NextLessonContext:
    """``preview_next_lesson`` 的返回：进度 + 磁盘预检结果（C3 吸收进 C1）。

    一次调用带回 handler 需要的全部信息——幂等预检（``next_num`` /
    ``already_generated``）与 ``.kiq()`` 转发所需的 topic / goal / session_id /
    model_id（task-391：整门课复用首课所选模型）——让 API 层不再打穿 service
    私有属性。
    """

    next_num: int
    already_generated: bool
    topic: str
    goal: str | None
    session_id: str | None
    model_id: str | None


# ── service ─────────────────────────────────────────────────────────── #


class CourseGeneratorService:
    """课程生成 service：一次 course agent run + 一课一文件 + 渐进产出。

    Args:
        model: 可选注入；为 None 时用 ``create_deepseek_model()`` 默认值。
            测试时可注入 mock。
        agent: 可选注入；为 None 时按 model + 默认 db 即时构建。
            :class:`CourseAgentRunner` 注入时以其 model / db 为模板新建一份，
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
        self._tmp_dir = tmp_dir
        self._progress_svc = progress_svc
        # agent 构造与单次 run 执行拆到 CourseAgentRunner（B 拆分），service
        # 退化为编排 + 混合读门面；model / agent 注入经 runner 透传。
        self._runner = CourseAgentRunner(
            model=model, agent=agent, tmp_dir=tmp_dir
        )

    # ── 公开 API ────────────────────────────────────────────────────── #

    async def generate_course(
        self,
        topic: str,
        owner: str,
        goal: str | None = None,
        course_id: str | None = None,
        model_id: str = "deepseek-v4-flash",
        extra_prompt: str | None = None,
    ) -> str:
        """生成**第 1 课**并落盘，经 ``progress_svc.mark_ready`` 落 ready 进度。

        落盘结构：

        .. code-block:: text

            <course_id>/
              lessons/
                0001-<slug>.md
                0001-<slug>.exercise.md
              RESOURCE.md

        Args:
            topic: 用户输入的学习主题。
            owner: 进度归属（user_id 或 anon_id）。
            goal: 学习目标（可选），透传给课程 agent 组织 MISSION.md 文案。
            course_id: 课程 ID。由调用方（API 层已生成并 upsert pending）传入，
                保证同一请求内 pending 与 ready 指向同一条记录；为 None 时内部
                用 :func:`build_course_id` 新生成一个（每次不同，不幂等）。
            model_id: 模型 ID（task-391），同时落库到 ``LearningProgress`` 让
                后续课经 :meth:`preview_next_lesson` 复用。
            extra_prompt: 用户补充的额外提示（task-391），首课 prompt 使用，
                同时落库用于审计 / 首课重生成。

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
        await self._runner.run_lesson(
            topic=topic,
            course_id=course_id,
            owner=owner,
            lesson_num=1,
            goal=goal,
            session_id=session_id,
            model_id=model_id,
            extra_prompt=extra_prompt,
        )

        # 标记进度为ready
        await self._progress_svc.mark_ready(
            owner=owner,
            course_id=course_id,
            topic=topic,
            goal=goal,
            session_id=session_id,
            model_id=model_id,
            extra_prompt=extra_prompt,
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
        model_id: str | None = None,
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

        模型一致性（task-391）：``model_id`` 由 :meth:`preview_next_lesson`
        从 ``LearningProgress.model_id`` 读出后透传，整门课保持同一模型；
        ``None`` 时回退 runner 默认 flash。

        Args:
            topic: 原始主题（用于 prompt）。
            owner: 进度归属（仅用于日志，不再写 progress）。
            course_id: 课程 ID。
            session_id: 已锚定的 agno 会话 ID（可选）；非 None 时传给 agent，
                否则按 agno 默认行为新开会话（仅用于单元测试 / 历史调用）。
            model_id: 模型 ID（task-391）。None 回退 flash。

        Returns:
            新课的编号；若有冲突（已存在）则返回 None。
        """
        # 1. 扫 lessons/ 找目标课编号 next_num（idempotent：已存在 → 直接返回 None）。
        #    编号由 CoursePackageRepo 统一计算（磁盘最大编号 + 1），agent 侧
        #    LessonWriter 以该显式 num 写盘，二者以磁盘为准收敛。
        repo = CoursePackageRepo(course_id=course_id, tmp_dir=self._tmp_dir)
        next_num = repo.next_lesson_num()

        # 防御：极端 race（两个 worker 同时跑同一个 course），文件已存在 →
        # 视为幂等成功。
        if repo.lesson_file_exists(next_num):
            logger.bind(
                course_id=course_id, owner=owner, lesson_num=next_num
            ).info("learning next lesson already exists, skipping")
            return None

        # 2. 生成并落盘下一课（ZPD 衔接由 agent 经 FileTools.read_file 自读上一课
        #    正文；goal 转发保证 prompt 与 MISSION.md 目标一致；session_id 复用首课
        #    锚定的会话，让 agent 跨轮记住前序 run 的消息；model_id 整门课
        #    保持同一模型，None 时回退 flash；run 后校验以 next_num 为唯一权威，
        #    经 repo.find_lesson 回查磁盘，不依赖仓库状态）
        await self._runner.run_lesson(
            topic=topic,
            course_id=course_id,
            owner=owner,
            lesson_num=next_num,
            goal=goal,
            session_id=session_id,
            model_id=model_id or "deepseek-v4-flash",
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

    async def require_ready_course(
        self, owner: str, course_id: str
    ) -> CoursePackageRepo | None:
        """下载前置门（task-385）：owner 校验 + 课程就绪 + 定位课程包根目录。

        下载端点复用本方法而非在 handler 里重建「owner 校验 → 404」逻辑：
        - ``get_progress_or_expire`` 把「不存在 / ``failed`` / pending 过期」
          折叠成 None，仍 ``pending``（未过期，还在生成）同样不可下载；
        - 三种情形都返回 None，由 handler 统一 404（不区分 401/403/pending，
          避免泄露 course_id 是否存在）；
        - 返回的 :class:`CoursePackageRepo` 用 ``self._tmp_dir`` 定位根目录，
          与 ``get_course`` / ``preview_next_lesson`` 同源，避免下载端点与生成
          端点读到的课程包根不一致。

        Returns:
            已就绪课程的仓库；owner 校验失败 / pending / failed / 不存在 → None。
        """
        progress = await self._progress_svc.get_progress_or_expire(
            owner,
            course_id,
            ttl_minutes=get_settings().LEARNING_PENDING_TTL_MINUTES,
        )
        if progress is None or progress.status != "ready":
            return None
        return CoursePackageRepo(course_id=course_id, tmp_dir=self._tmp_dir)

    async def preview_next_lesson(
        self, owner: str, course_id: str
    ) -> NextLessonContext | None:
        """同步预检「下一课」：进度 + 磁盘 next_num，供 API 层做幂等预检。

        C3 吸收进 C1 后的接缝修复：handler 不再打穿 ``_repo`` / ``_course_dir``
        / 裸扫描磁盘，只调本公开方法。一次调用带回：

        - ``next_num``：预期下一课编号（磁盘最大编号 + 1）；
        - ``already_generated``：该编号文件是否已存在（幂等命中）；
        - ``topic`` / ``goal`` / ``session_id``：``.kiq()`` 转发所需的进度字段；
        - ``model_id``（task-391）：整门课复用首课所选模型。

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
            model_id=progress.model_id,
        )


__all__ = [
    "CourseGeneratorService",
    "NextLessonContext",
]
