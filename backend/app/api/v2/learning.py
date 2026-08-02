"""v2 learning API — 课程生成 + 进度查询/标记（task-337）+ 渐进产出（task-352）。

端点对应 wayfinder #27 的契约：

- ``POST /v2/learning/courses`` — 提交主题，**先** upsert ``status="pending"``，
  再 ``.kiq()`` 异步任务，立即返回 ``{course_id, status:"pending"}``。
- ``GET  /v2/learning/courses/{course_id}`` — 读取课程包；pending / ready
  由 :meth:`CourseGeneratorService.get_course` 区分，不存在或 ``failed`` 返回 404。
- ``POST /v2/learning/courses/{course_id}/lessons`` — 渐进产出下一课（task-352）。
  从已有 progress 读 topic，``.kiq()`` 异步任务；幂等命中（已存在）→ 立刻
  返回 ``{status:"already_generated", next_lesson:null}``，避免无谓排队。
- ``GET  /v2/learning/progress`` — 列出 owner 的全部进度。
- ``PATCH /v2/learning/progress/{course_id}`` — 标记 session_done /
  exercise_done（幂等）。
- ``GET  /v2/learning/courses/{course_id}/bundle.zip`` — 下载整门课程的
  原始 md 制品为 ``<course_id>.zip``（task-385，流式 ZIP）。
- ``GET  /v2/learning/courses/{course_id}/files/{path:path}`` — 下载课程内
  单个原始 md 文件（task-385，越界 / 后缀不符 → 404）。

owner 解析（``_resolve_learning_owner``）：登录用户用 ``str(user_id)``，
匿名用户优先取 ``X-Anon-Id`` 头（前端 localStorage 自管 UUID），缺则退
回到 ``anon:<client_ip>`` 以保证服务端总有一个稳定归属键，方便登录合并
（``LearningProgressService.merge_progress``）正确收敛。

下载端点鉴权（task-385）：owner 校验统一走
:meth:`LearningProgressService.get_progress_or_expire`，进度不存在 / 过期 /
``failed`` / 仍 ``pending`` → 统一 404（不区分 401/403，避免泄露 course_id
是否存在）。磁盘路径越界 / 后缀校验全部下沉到
:class:`CoursePackageRepo`，handler 只透传 ``rel_path``。
"""

from __future__ import annotations

import asyncio
import io
import time
import zipfile
from dataclasses import asdict

from fastapi import APIRouter, Depends, Request
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field

from app.api.des.auth import optional_user
from app.api.des.limiter import client_key
from app.appstate import AppState, get_app_state
from app.core.exceptions import NotFoundError
from app.core.logger import logger
from app.core.response import APIResponse
from app.plugins.task.tasks.learning import (
    generate_course,
    generate_next_lesson,
)
from app.repositories.course_package_repo import CoursePackageRepo
from app.schemas.learning import CourseGenerateInput, FileEntry
from app.services.course_generator_service import CourseGeneratorService
from app.services.learning_progress_service import LearningProgressService
from app.services.learning_utils import build_course_id

router = APIRouter(prefix="/learning", tags=["learning"])


class ProgressPatch(BaseModel):
    """``PATCH /progress/{course_id}`` 请求体。

    字段均可缺省（调用方可单独更新一项）；具体执行由
    :meth:`LearningProgressService.mark_progress` 按 ``is not None`` 决定是否落库，
    保证不传字段不会清空已有进度。
    """

    session_done: int | None = Field(
        default=None,
        ge=1,
        description="刚完成的 Session 编号（追加幂等）",
    )
    exercise_done: bool | None = Field(
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
        登录合并（``LearningProgressService.merge_progress``）依赖 owner 字符串稳定；
        仅依赖 IP 在 NAT / 公司网关上会让同一物理用户的 anon 与 user 桶错位。
        因此匿名 owner 必须以客户端 ID 为主、IP 为兜底，而不是相反。
    """
    if user_id is not None:
        return str(user_id)
    anon_id = request.headers.get(ANON_ID_HEADER)
    if anon_id:
        return f"anon:{anon_id}"
    return f"anon:{client_key(request)}"


async def _require_ready_repo(
    state: AppState,
    user: int | None,
    request: Request,
    course_id: str,
) -> CoursePackageRepo | None:
    """owner 校验 + 课程就绪门 + 课程包根目录（task-385）。

    委托 :meth:`CourseGeneratorService.require_ready_course`——它复用进度侧
    的 ``get_progress_or_expire`` 判定「不存在 / ``failed`` / pending 过期 /
    仍 pending」并返回 None，同时用 service 的 ``_tmp_dir`` 定位根目录，与
    ``get_course`` 等生成侧端点同源。返回 None 时 handler 统一 404。
    """
    owner = _resolve_learning_owner(user, request)
    course_gen_svc: CourseGeneratorService = state.course_gen_svc
    return await course_gen_svc.require_ready_course(owner, course_id)


def _build_course_zip(
    repo: CoursePackageRepo, entries: list[FileEntry]
) -> io.BytesIO:
    """把课程包的 md 制品压成一个内存 ZIP（在 ``asyncio.to_thread`` 里跑）。

    保留 ``lessons/`` 子目录；纯同步磁盘 + 压缩 I/O，从 handler 的事件循环
    挪到线程池执行，避免阻塞其他 in-flight 请求。
    """
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for entry in entries:
            zf.write(repo.root / entry.rel_path, arcname=entry.rel_path)
    return buf


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
    progress_svc: LearningProgressService = state.progress_svc
    topic = payload.topic
    goal = payload.goal
    owner = _resolve_learning_owner(user, request)
    course_id = build_course_id(topic)

    # 先 upsert pending，失败也能让前端立刻拿到稳定 course_id 进入轮询。
    await progress_svc.create_pending(
        owner=owner, course_id=course_id, topic=topic, goal=goal
    )
    # 再 kiq：worker 端完成两步生成后会把同一条 (owner, course_id) 记录
    # 置 ready；失败由 service 内部重试一次，再失败由任务层 _mark_failed
    # 把状态置 failed（让前端轮询体现终态）。
    await generate_course.kiq(
        topic=topic, owner=owner, course_id=course_id, goal=goal
    )

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
    course_gen_svc: CourseGeneratorService = state.course_gen_svc
    owner = _resolve_learning_owner(user, request)

    payload = await course_gen_svc.get_course(owner, course_id)
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


@router.get("/courses/{course_id}/files")
async def list_course_files(
    course_id: str,
    request: Request,
    user: int | None = Depends(optional_user),
    state: AppState = Depends(get_app_state),
):
    """列出课程包内的全部原始 md 制品（task-385，「原始文件」面板的数据源）。

    委托 :meth:`CoursePackageRepo.list_course_files` 扫描磁盘，返回
    :class:`FileEntry` 列表（``lessons/*.md`` 含 ``.exercise.md`` + 顶层
    ``resource.md`` / ``MISSION.md``，带大小 / mtime）。owner 校验统一走
    ``_require_ready_repo`` → 404。
    """
    repo = await _require_ready_repo(state, user, request, course_id)
    if repo is None:
        raise NotFoundError("课程不存在或未就绪")

    entries = repo.list_course_files()
    return APIResponse(
        data={"items": [asdict(entry) for entry in entries]},
        message="success",
    )


@router.get("/courses/{course_id}/bundle.zip")
async def download_course_bundle(
    course_id: str,
    request: Request,
    user: int | None = Depends(optional_user),
    state: AppState = Depends(get_app_state),
):
    """下载整门课程的原始 md 制品为 ``<course_id>.zip``（task-385）。

    课程包预期 1–5MB < 10MB，整包在内存中构建（``zipfile`` 写
    :class:`io.BytesIO`，经 ``asyncio.to_thread`` 挪出事件循环，避免阻塞其他
    请求）后以 :class:`Response` 下发，自动带 ``Content-Length``。归档内部保留
    ``lessons/`` 子目录，与磁盘原貌对齐；文件名 ``<course_id>.zip`` 由服务端
    ``Content-Disposition`` 决定，前端 ``<a download>`` 同名兜底。鉴权统一走
    ``_require_ready_repo`` → 404。
    """
    repo = await _require_ready_repo(state, user, request, course_id)
    if repo is None:
        raise NotFoundError("课程不存在或未就绪")

    entries = repo.list_course_files()
    if not entries:
        raise NotFoundError("课程不存在或未就绪")

    buf = await asyncio.to_thread(_build_course_zip, repo, entries)

    logger.bind(
        course_id=course_id,
        owner=_resolve_learning_owner(user, request),
        kind="bundle",
        file_count=len(entries),
    ).info("learning course artifact downloaded")

    return Response(
        content=buf.getvalue(),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{course_id}.zip"'
        },
    )


@router.get("/courses/{course_id}/files/{path:path}")
async def download_course_file(
    course_id: str,
    path: str,
    request: Request,
    user: int | None = Depends(optional_user),
    state: AppState = Depends(get_app_state),
):
    """下载课程内单个原始 md 文件（task-385）。

    ``path`` 为 FastAPI 通配参数（如 ``lessons/0001-foo.md``），防越界 /
    后缀白名单全部由 :meth:`CoursePackageRepo.read_course_file` 校验，handler
    只透传；返回 None（越界 / 非 ``.md`` / 缺失）→ 统一 404。成功用
    :class:`FileResponse` 下发，``filename=`` 自动带 ``Content-Disposition:
    attachment``，浏览器内嵌预览亦可，前端用 ``<a download>`` 强制下载。
    """
    repo = await _require_ready_repo(state, user, request, course_id)
    if repo is None:
        raise NotFoundError("课程不存在或未就绪")

    result = repo.read_course_file(path)
    if result is None:
        raise NotFoundError("课程不存在或未就绪")

    abs_path, display_name = result
    logger.bind(
        course_id=course_id,
        owner=_resolve_learning_owner(user, request),
        kind="file",
        rel_path=path,
        display_name=display_name,
    ).info("learning course artifact downloaded")

    return FileResponse(
        abs_path,
        filename=display_name,
        media_type="text/markdown",
    )


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
    2+3. **同步预检**委托 ``CourseGeneratorService.preview_next_lesson``（C3 吸收进
       C1）：progress 不存在 / ``failed`` → 返回 ``{status:"failed"}`` 包（与
       ``GET /courses/{id}`` 404 惯例对称）；否则得到预期 ``next_lesson_num``
       与幂等命中标记——命中则立刻返回 ``{status:"already_generated",
       next_lesson:null}``，避免重复 ``.kiq()`` 一个注定会 no-op 的任务。
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
    - 预检的磁盘规则（``next_lesson_num`` / ``lesson_file_exists``）与
      :meth:`CourseGeneratorService.generate_next_lesson` 共用
      :class:`CoursePackageRepo` 同一份逻辑，handler 不再打穿 service 私有属性。
    """
    course_gen_svc: CourseGeneratorService = state.course_gen_svc
    owner = _resolve_learning_owner(user, request)

    # 2+3. 同步预检：一次调用带回进度状态 + 预期 next_num + 幂等命中标记 +
    #      kiq 转发所需字段（topic / goal / session_id）。
    ctx = await course_gen_svc.preview_next_lesson(owner, course_id)
    if ctx is None:
        return APIResponse(
            data={
                "course_id": course_id,
                "next_lesson": None,
                "status": "failed",
            },
            message="课程不存在或生成失败",
        )

    # 4. 同步预检命中：直接返回，不再走 .kiq()
    if ctx.already_generated:
        return APIResponse(
            data={
                "course_id": course_id,
                "next_lesson": None,
                "status": "already_generated",
            },
            message="下一课已生成",
        )

    # 5. 正常的异步路径（goal / session_id 随 ctx 转发，让后续课 prompt 与
    #    MISSION.md 目标保持一致、渐进产出复用首课锚定的 agno 会话（task-373））
    #    enqueued_at 标签随消息投递，worker 侧 TraceMiddleware 据此打印
    #    "投递→收到" 端到端时延（delivery_ms），定位 kiq 后迟迟不执行的问题。
    enqueued_at = time.time()
    await generate_next_lesson.kicker().with_labels(enqueued_at=enqueued_at).kiq(
        topic=ctx.topic,
        owner=owner,
        course_id=course_id,
        goal=ctx.goal,
        session_id=ctx.session_id,
    )
    logger.bind(
        course_id=course_id,
        owner=owner,
        enqueue_ms=round((time.time() - enqueued_at) * 1000, 1),
    ).info("learning: next-lesson generation queued")
    return APIResponse(
        data={
            "course_id": course_id,
            "next_lesson": ctx.next_num,
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
    progress_svc: LearningProgressService = state.progress_svc
    owner = _resolve_learning_owner(user, request)
    items = await progress_svc.list_progress(owner)
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
    """标记进度：``session_done`` / ``exercise_done`` 可独立更新（幂等）。"""
    progress_svc: LearningProgressService = state.progress_svc
    owner = _resolve_learning_owner(user, request)
    progress = await progress_svc.mark_progress(
        owner,
        course_id,
        session_done=payload.session_done,
        exercise_done=payload.exercise_done,
    )
    if progress is None:
        return APIResponse(
            data={"course_id": course_id},
            message="进度不存在",
        )
    return APIResponse(data=progress, message="success")
