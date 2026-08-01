"""Learning 课程生成异步任务。

两个 sibling task：
- :func:`generate_course` — 由 ``POST /v2/learning/courses`` 触发：API 层先
  upsert ``LearningProgress(status="pending")`` 并把 ``course_id`` 立刻返回给
  前端，再 ``.kiq()`` 投递本任务；worker 端走
  :func:`app.services.learning_service.LearningService.generate_course` 跑两步
  agno + DeepSeek 生成 + 三文件落盘，最终把进度置 ``ready``。
- :func:`generate_next_lesson` — 由 ``POST /v2/learning/courses/{course_id}/lessons``
  触发（task-352 渐进产出）：从已有 progress 读 topic，扫描 ``lessons/`` 找
  next_num，调 :func:`LearningService.generate_next_lesson` 衔接生成新课 + 刷
  共享 resource.md；**不**重新走 pending → ready 状态切换（progress 仍 ready，
  用户通过轮询 ``GET /courses/{id}`` 看到 `lessons` 列表增长）。

设计依据：
- 失败由 :class:`SmartRetryMiddleware` 重试 3 次（指数退避 + jitter），因此
  本任务需要幂等：``generate_course`` 自身 upsert progress 且覆盖写文件，
  retry 不会污染状态。``generate_next_lesson`` 靠扫描 ``lessons/`` + 文件已
  存在直接返回 None 实现幂等。
- SmartRetryMiddleware 每次失败都会重新调度一次任务（4 次执行 = 1 次 +
  3 次重试），最后不会主动再抛 —— 我们靠 ``_retries`` label 判定是不是
  末次失败，再把 ``LearningProgress.status`` 置 ``failed``（仅 generate_course
  涉及，next_lesson 仍保持 ready 不变）。
"""

from __future__ import annotations

from taskiq import Context, TaskiqDepends

from app.core.logger import logger
from app.plugins.task.task import broker
from app.services.learning_service import LearningService


@broker.task
async def generate_course(
    topic: str,
    owner: str,
    course_id: str,
    context: Context = TaskiqDepends(),
) -> None:
    """生成课程包并落盘；最终把 ``LearningProgress`` 置 ``ready``。

    失败由 SmartRetryMiddleware 兜底重试 3 次；末次失败时由 :func:`_mark_failed`
    把状态置 ``failed``，让前端轮询体现终态。

    :param topic: 课程主题。
    :param owner: 进度归属（user_id 或 anon_id）。
    :param course_id: 课程 ID（API 层预计算并已 upsert 了一条
        ``status="pending"`` 记录）。
    :param context: Taskiq 上下文对象，自动注入。
    """
    retry_no = int(context.message.labels.get("_retries", 0))
    logger.bind(
        course_id=course_id, owner=owner, topic=topic, retry=retry_no
    ).info("learning: course generation task started")

    try:
        # 与 email.py / scheduled.py 一致：worker 启动时已在
        # _on_worker_startup 把 new_app_state 挂到 app.state.services。
        from app.main import app

        learning_svc: LearningService = app.state.services.learning_svc
        await learning_svc.generate_course(topic=topic, owner=owner)
    except Exception as exc:
        logger.bind(
            course_id=course_id, owner=owner, retry=retry_no
        ).error(f"learning: course generation task failed: {exc!r}")
        # 仅在 SmartRetryMiddleware 已耗尽重试的末次失败时标记 failed；
        # 否则让中间件继续调度重试。
        if retry_no >= 3:
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
    context: Context = TaskiqDepends(),
) -> int | None:
    """渐进产出：在已有课程下生成下一课并落盘（task-352）。

    与 :func:`generate_course` 的差异：
    - **不**走 pending → ready 状态切换（progress 已为 ready，不动）；
    - 幂等性由 :meth:`LearningService.generate_next_lesson` 内部保证
      （扫描 ``lessons/``：若对应编号的文件已存在 → 直接返回 None，**不**
      重复生成；SmartRetry 重试落在这里是安全的）；
    - 失败末次**不**调 :func:`_mark_failed`（课程主体仍 ready，仅本课失败）；
      SmartRetry 末次失败后会抛 taskiq 级异常进 DLQ 候选，前端轮询
      ``GET /courses/{id}`` 时 lessons 列表长度未变可感知。

    :param topic: 课程主题（API 层从 progress 读出后传入）。
    :param owner: 进度归属（user_id 或 anon_id）。
    :param course_id: 课程 ID。
    :param context: Taskiq 上下文对象，自动注入。
    :return: 新课编号；幂等命中（已存在）时返回 None。
    """
    retry_no = int(context.message.labels.get("_retries", 0))
    logger.bind(
        course_id=course_id, owner=owner, topic=topic, retry=retry_no
    ).info("learning: next-lesson task started")

    try:
        from app.main import app

        learning_svc: LearningService = app.state.services.learning_svc
        next_num = await learning_svc.generate_next_lesson(
            topic=topic, owner=owner, course_id=course_id
        )
    except Exception as exc:
        logger.bind(
            course_id=course_id, owner=owner, retry=retry_no
        ).error(f"learning: next-lesson task failed: {exc!r}")
        # 不标 failed —— 课程主体 ready 状态对用户仍可用；让 SmartRetry 继续重试。
        raise
    else:
        logger.bind(
            course_id=course_id,
            owner=owner,
            next_lesson=next_num,
        ).info("learning: next-lesson task succeeded")
        return next_num


async def _mark_failed(*, course_id: str, owner: str) -> None:
    """把 ``LearningProgress`` 状态置 ``failed``，失败仅记日志不回滚。"""
    try:
        from app.main import app

        repo = app.state.services.learning_svc._repo
        await repo.set_status(owner=owner, course_id=course_id, status="failed")
        logger.bind(course_id=course_id, owner=owner).warning(
            "learning: course progress marked failed"
        )
    except Exception as exc:  # pragma: no cover - 兜底
        logger.bind(course_id=course_id, owner=owner).error(
            f"learning: failed to mark progress as failed: {exc!r}"
        )
