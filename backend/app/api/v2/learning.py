"""v2 learning API — 课程生成 + 进度查询/标记（task-337）+ 渐进产出（task-352）。

端点对应 wayfinder #27 的契约：

- ``POST /v2/learning/courses`` — 提交主题，**先** upsert ``status="pending"``，
  再 ``.kiq()`` 异步任务，立即返回 ``{course_id, status:"pending"}``。
- ``GET  /v2/learning/courses/{course_id}`` — 读取课程包；pending / ready
  由 :meth:`LearningService.get_course` 区分，不存在或 ``failed`` 返回 404。
- ``POST /v2/learning/courses/{course_id}/lessons`` — 渐进产出下一课（task-352）。
  从已有 progress 读 topic，``.kiq()`` 异步任务；幂等命中（已存在）→ 立刻
  返回 ``{status:"already_generated", next_lesson:null}``，避免无谓排队。
- ``GET  /v2/learning/progress`` — 列出 owner 的全部进度。
- ``PATCH /v2/learning/progress/{course_id}`` — 标记 session_done /
  mission_done（幂等）。

owner 解析（``_resolve_learning_owner``）：登录用户用 ``str(user_id)``，
匿名用户优先取 ``X-Anon-Id`` 头（前端 localStorage 自管 UUID），缺则退
回到 ``anon:<client_ip>`` 以保证服务端总有一个稳定归属键，方便登录合并
（``LearningService.merge_progress``）正确收敛。
"""

from __future__ import annotations

import re
from pathlib import Path

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from app.api.des.auth import optional_user
from app.api.des.limiter import client_key
from app.appstate import AppState, get_app_state
from app.core.logger import logger
from app.core.response import APIResponse
from app.plugins.task.tasks.learning import (
    generate_course,
    generate_next_lesson,
)
from app.schemas.learning import CourseGenerateInput
from app.services.learning_service import LearningService, build_course_id

router = APIRouter(prefix="/learning", tags=["learning"])


class ProgressPatch(BaseModel):
    """``PATCH /progress/{course_id}`` 请求体。

    字段均可缺省（调用方可单独更新一项）；具体执行由
    :meth:`LearningService.mark_progress` 按 ``is not None`` 决定是否落库，
    保证不传字段不会清空已有进度。
    """

    session_done: int | None = Field(
        default=None,
        ge=1,
        description="刚完成的 Session 编号（追加幂等）",
    )
    mission_done: bool | None = Field(
        default=None,
        description="练习任务是否全部完成",
    )

# 客户端生成匿名 ID 的请求头，由前端 localStorage 自管 UUID。
ANON_ID_HEADER = "x-anon-id"


def _resolve_learning_owner(user_id: int | None, request: Request) -> str:
    """把 ``Depends(optional_user)`` 的结果映射成 service 层要的 owner。

    解析顺序：
    1. 登录用户：``str(user_id)``；
    2. 匿名用户：优先 ``X-Anon-Id`` 头（client-generated，stable across IP
       变化，便于跨设备合并课程进度）；
    3. 兜底：``anon:<client_ip>``（与 ``llm.py`` 同源，保证服务端始终有归属键）。

    Note:
        登录合并（``LearningService.merge_progress``）依赖 owner 字符串稳定；
        仅依赖 IP 在 NAT / 公司网关上会让同一物理用户的 anon 与 user 桶错位。
        因此匿名 owner 必须以客户端 ID 为主、IP 为兜底，而不是相反。
    """
    if user_id is not None:
        return str(user_id)
    anon_id = request.headers.get(ANON_ID_HEADER)
    if anon_id:
        return f"anon:{anon_id}"
    return f"anon:{client_key(request)}"


@router.post("/courses")
async def create_course(
    payload: CourseGenerateInput,
    request: Request,
    user: int | None = Depends(optional_user),
    state: AppState = Depends(get_app_state),
):
    """提交主题：先落 ``pending`` 记录，再异步生成课程包。

    返回 ``{course_id, status:"pending"}``，前端据此轮询
    ``GET /courses/{course_id}`` 直到 ``status="ready"``。
    """
    learning_svc: LearningService = state.learning_svc
    topic = payload.topic
    owner = _resolve_learning_owner(user, request)
    course_id = build_course_id(topic)

    # 先 upsert pending，失败也能让前端立刻拿到稳定 course_id 进入轮询。
    await learning_svc.create_pending(
        owner=owner, course_id=course_id, topic=topic
    )
    # 再 kiq：worker 端完成两步生成后会把同一条 (owner, course_id) 记录
    # 置 ready；SmartRetryMiddleware 在 3 次重试失败后置 failed。
    await generate_course.kiq(topic=topic, owner=owner, course_id=course_id)

    logger.bind(course_id=course_id, owner=owner).info(
        "learning: course generation queued"
    )
    return APIResponse(
        data={"course_id": course_id, "status": "pending"},
        message="课程生成任务已提交",
    )


@router.get("/courses/{course_id}")
async def get_course(
    course_id: str,
    request: Request,
    user: int | None = Depends(optional_user),
    state: AppState = Depends(get_app_state),
):
    """读取课程包：``pending`` / ``ready`` 直传，不存在 / ``failed`` 返回 404。"""
    learning_svc: LearningService = state.learning_svc
    owner = _resolve_learning_owner(user, request)

    payload = await learning_svc.get_course(owner, course_id)
    if payload is None:
        return APIResponse(
            data={"course_id": course_id, "status": "failed"},
            message="课程不存在或生成失败",
        )

    # ready 时把 CoursePackage 序列化成 dict；pending 时仅含 status。
    if payload["status"] == "ready":
        course = payload["course"]
        data = {
            "status": "ready",
            "course": course.model_dump(mode="json"),
        }
    else:
        data = {"status": "pending", "course_id": course_id}

    return APIResponse(data=data, message="success")


@router.post("/courses/{course_id}/lessons")
async def create_next_lesson(
    course_id: str,
    request: Request,
    user: int | None = Depends(optional_user),
    state: AppState = Depends(get_app_state),
):
    """渐进产出：触发生成下一课（task-352）。

    流程：
    1. 解析 owner（与其它端点一致）。
    2. 读 progress：若不存在 / ``failed`` → 返回 ``{status:"failed"}`` 包（与
       ``GET /courses/{id}`` 404 惯例对称）。
    3. **同步** 根据 progress.topic 算出预期 ``next_lesson_num``（即已有
       lessons 数量 + 1），扫描磁盘上是否已存在该编号文件 → 命中则立刻
       返回 ``{status:"already_generated", next_lesson:null}``，避免重复
       ``.kiq()`` 一个注定会 no-op 的任务。
    4. 否则 ``.kiq()`` 异步任务，返回 ``{course_id, next_lesson:<预期编号>,
       status:"pending"}``；前端继续轮询 ``GET /courses/{id}`` 看 lessons
       列表增长。

    响应信封两层一致：
    - ``{"data": {"course_id": str, "next_lesson": int | null,
       "status": "pending" | "already_generated" | "failed"}, ...}``

    设计依据：
    - 同步幂等预检非常便宜（一次 Mongo 读取 + 一次目录 glob），但可以在
      重复点击 / 网络重试场景下免去一次 LLM 调用排队 —— 商业上很重要。
    - 同步预检与 worker 端再次幂等检查是分层防御：API 端错判只是会
      多排一个任务，worker 端仍以磁盘为准。
    """
    learning_svc: LearningService = state.learning_svc
    owner = _resolve_learning_owner(user, request)

    # 2. progress 必查 — 拿到 topic 与状态
    progress = await learning_svc._repo.get_progress(owner, course_id)
    if progress is None or progress.status == "failed":
        return APIResponse(
            data={"course_id": course_id, "next_lesson": None, "status": "failed"},
            message="课程不存在或生成失败",
        )

    # 3. 同步幂等预检：扫描 lessons/ 找 next_num
    course_dir = learning_svc._course_dir(course_id)
    lessons_dir = course_dir / "lessons"
    existing_ids = _list_existing_lesson_ids_for_api(lessons_dir)
    next_lesson_num = (max(existing_ids) + 1) if existing_ids else 1

    # 4. 同步预检命中：直接返回，不再走 .kiq()
    if _lesson_file_exists(lessons_dir, next_lesson_num):
        return APIResponse(
            data={
                "course_id": course_id,
                "next_lesson": None,
                "status": "already_generated",
            },
            message="下一课已生成",
        )

    # 5. 正常的异步路径
    await generate_next_lesson.kiq(
        topic=progress.topic, owner=owner, course_id=course_id
    )
    logger.bind(course_id=course_id, owner=owner).info(
        "learning: next-lesson generation queued"
    )
    return APIResponse(
        data={
            "course_id": course_id,
            "next_lesson": next_lesson_num,
            "status": "pending",
        },
        message="下一课生成任务已提交",
    )


@router.get("/progress")
async def list_progress(
    request: Request,
    user: int | None = Depends(optional_user),
    state: AppState = Depends(get_app_state),
):
    """列出 owner 的课程进度，每条带派生 ``next_session``。"""
    learning_svc: LearningService = state.learning_svc
    owner = _resolve_learning_owner(user, request)
    items = await learning_svc.list_progress(owner)
    return APIResponse(
        data={"items": items},
        message="success",
    )


@router.patch("/progress/{course_id}")
async def patch_progress(
    course_id: str,
    payload: ProgressPatch,
    request: Request,
    user: int | None = Depends(optional_user),
    state: AppState = Depends(get_app_state),
):
    """标记进度：``session_done`` / ``mission_done`` 可独立更新（幂等）。"""
    learning_svc: LearningService = state.learning_svc
    owner = _resolve_learning_owner(user, request)
    progress = await learning_svc.mark_progress(
        owner,
        course_id,
        session_done=payload.session_done,
        mission_done=payload.mission_done,
    )
    if progress is None:
        return APIResponse(
            data={"course_id": course_id},
            message="进度不存在",
        )
    return APIResponse(data=progress, message="success")


# ── 教程幂等预检 helpers ──────────────────────────────────────────────── #
#
# 与 ``learning_service._list_existing_lesson_ids`` 镜像，但放 API 层
# 是为了避免在路由里直接 ``from app.services.learning_service import ...``
# 单点行为函数；只暴露必要的两个 helper 给 API 用于同步预检。
# Worker 端仍以 :func:`LearningService.generate_next_lesson` 内部递归扫描
# 为准，**不**依赖此处的预检结果。

_LESSON_FILE_RE = re.compile(r"^(\d{4})-([a-z0-9][a-z0-9-]*)\.md$")


def _list_existing_lesson_ids_for_api(lessons_dir: Path) -> list[int]:
    """扫描 ``lessons/`` 抽取已存在的课编号（不含 ``.exercise.md``）。"""
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


def _lesson_file_exists(lessons_dir: Path, lesson_num: int) -> bool:
    """判断 ``<num>-<slug>.md`` 形文件是否已存在（同一编号任一 slug 都算）。"""
    if not lessons_dir.exists():
        return False
    prefix = f"{lesson_num:04d}-"
    return any(p.name.startswith(prefix) for p in lessons_dir.glob(f"{prefix}*.md"))
