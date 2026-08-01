"""Learning 课程生成异步任务。

两个 sibling task：
- :func:`generate_course` — 由 ``POST /v2/learning/courses`` 触发：API 层先
  upsert ``LearningProgress(status="pending")`` 并把 ``course_id`` 立刻返回给
  前端，再 ``.kiq()`` 投递本任务；worker 端走
  :func:`app.services.course_generator_service.CourseGeneratorService.generate_course`
  跑 agno + DeepSeek 生成 + 落盘，最终把进度置 ``ready``。
- :func:`generate_next_lesson` — 由 ``POST /v2/learning/courses/{course_id}/lessons``
  触发（task-352 渐进产出）：从已有 progress 读 topic，扫描 ``lessons/`` 找
  next_num，调 :func:`CourseGeneratorService.generate_next_lesson` 衔接生成新课 +
  刷共享 resource.md；**不**重新走 pending → ready 状态切换（progress 仍 ready，
  用户通过轮询 ``GET /courses/{id}`` 看到 `lessons` 列表增长）。

设计依据：
- 任务只执行一次（不再挂 broker 级 :class:`SmartRetryMiddleware`）：失败由
  service 内部整 run 重试一次（``CourseGeneratorService._generate_lesson`` 用
  ``COURSE_AGENT_RETRY_HINT`` 追加提示再跑一轮），再失败抛
  ``RuntimeError``。``generate_course`` 捕获后直接 :func:`_mark_failed` 把
  ``LearningProgress.status`` 置 ``failed``；``generate_next_lesson`` 失败只
  记日志 + re-raise（课程主体仍 ready）。
- 幂等由 service 保证：``generate_course`` 自身 upsert progress 且覆盖写
  文件；``generate_next_lesson`` 靠扫描 ``lessons/`` + 文件已存在直接返回
  None 实现幂等。
"""

from __future__ import annotations

from app.core.logger import logger
from app.plugins.task.task import broker
from app.services.course_generator_service import CourseGeneratorService


@broker.task
async def generate_course(
    topic: str,
    owner: str,
    course_id: str,
    goal: str | None = None,
) -> None:
    """生成课程包并落盘；最终把 ``LearningProgress`` 置 ``ready``。

    失败由 service 内部重试一次，再失败由 :func:`_mark_failed` 把状态置
    ``failed``，让前端轮询体现终态。

    :param topic: 课程主题。
    :param owner: 进度归属（user_id 或 anon_id）。
    :param course_id: 课程 ID（API 层预计算并已 upsert 了一条
        ``status="pending"`` 记录）。
    :param goal: 学习目标（可选），透传给 service 组织 MISSION.md 文案。
    """
    logger.bind(course_id=course_id, owner=owner, topic=topic).info(
        "learning: course generation task started"
    )

    try:
        # 与 email.py / scheduled.py 一致：worker 启动时已在
        # _on_worker_startup 把 new_app_state 挂到 app.state.services。
        from app.main import app

        course_gen_svc: CourseGeneratorService = (
            app.state.services.course_gen_svc
        )
        await course_gen_svc.generate_course(
            topic=topic, owner=owner, goal=goal, course_id=course_id
        )
    except Exception as exc:
        logger.bind(course_id=course_id, owner=owner).error(
            f"learning: course generation task failed: {exc!r}"
        )
        await _mark_failed(course_id=course_id, owner=owner)
        raise
    else:
        logger.bind(course_id=course_id, owner=owner).info(
            "learning: course generation task succeeded"
        )


@broker.task
async def generate_next_lesson(
    topic: str,
    owner: str,
    course_id: str,
    goal: str | None = None,
    session_id: str | None = None,
) -> int | None:
    """渐进产出：在已有课程下生成下一课并落盘（task-352）。

    与 :func:`generate_course` 的差异：
    - **不**走 pending → ready 状态切换（progress 已为 ready，不动）；
    - 幂等性由 :meth:`CourseGeneratorService.generate_next_lesson` 内部保证
      （扫描 ``lessons/``：若对应编号的文件已存在 → 直接返回 None，**不**
      重复生成）；
    - 失败**不**调 :func:`_mark_failed`（课程主体仍 ready，仅本课失败）：
      只记日志 + re-raise，异常进 taskiq 级 DLQ 候选，前端轮询
      ``GET /courses/{id}`` 时 lessons 列表长度未变可感知。

    :param topic: 课程主题（API 层从 progress 读出后传入）。
    :param owner: 进度归属（user_id 或 anon_id）。
    :param course_id: 课程 ID。
    :param goal: 学习目标（可选，API 层从 progress 读出转发，保证 prompt 与
        MISSION.md 目标一致）。
    :param session_id: agno 会话 ID（task-373，API 层从 progress 读出转发，
        复用首课锚定的会话让 agent 跨轮记住上下文）。
    :return: 新课编号；幂等命中（已存在）时返回 None。
    """
    logger.bind(course_id=course_id, owner=owner, topic=topic).info(
        "learning: next-lesson task started"
    )

    try:
        from app.main import app

        course_gen_svc: CourseGeneratorService = (
            app.state.services.course_gen_svc
        )
        next_num = await course_gen_svc.generate_next_lesson(
            topic=topic,
            owner=owner,
            course_id=course_id,
            goal=goal,
            session_id=session_id,
        )
    except Exception as exc:
        logger.bind(course_id=course_id, owner=owner).error(
            f"learning: next-lesson task failed: {exc!r}"
        )
        # 不标 failed —— 课程主体 ready 状态对用户仍可用。
        raise
    else:
        logger.bind(
            course_id=course_id,
            owner=owner,
            next_lesson=next_num,
        ).info("learning: next-lesson task succeeded")
        return next_num


async def _mark_failed(*, course_id: str, owner: str) -> None:
    """把 ``LearningProgress`` 状态置 ``failed``，失败仅记日志不回滚。

    不再打穿 ``_repo`` 私有属性：C2 拆分后状态切换统一经
    :meth:`LearningProgressService.mark_failed`。
    """
    try:
        from app.main import app

        progress_svc = app.state.services.progress_svc
        await progress_svc.mark_failed(owner=owner, course_id=course_id)
        logger.bind(course_id=course_id, owner=owner).warning(
            "learning: course progress marked failed"
        )
    except Exception as exc:  # pragma: no cover - 兜底
        logger.bind(course_id=course_id, owner=owner).error(
            f"learning: failed to mark progress as failed: {exc!r}"
        )
