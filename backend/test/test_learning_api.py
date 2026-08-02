"""Contract tests for the v2 learning API (``app.api.v2.learning``).

We build a lightweight FastAPI app with the learning router registered and
inject mocks for the two split services — ``_MockProgressService``
(``create_pending`` / ``list_progress`` / ``mark_progress``) and
``_MockGeneratorService`` (``get_course`` / ``preview_next_lesson``) — into
``app.state.services`` via the same ``Depends(get_app_state)`` mechanism
production uses.  The Taskiq broker kick (``.kiq()``) is patched to a no-op
so no broker / worker is needed.

Owner resolution rules under test:
  1. Logged-in user → ``str(user_id)``
  2. Anonymous + ``X-Anon-Id`` header → ``anon:<id>``
  3. Anonymous + IP fallback → ``anon:<client.host>``

We do **not** test progress upsert Mongo round-tripping here (covered in
``test_learning_repo.py``); the service is mocked so we only assert HTTP
shape + owner-key wiring.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api.des.auth import manager, optional_user
from app.api.v2.learning import _resolve_learning_owner, router
from app.appstate import AppState, get_app_state
from app.core import register_exception_handlers
from app.repositories.course_package_repo import CoursePackageRepo

pytestmark = pytest.mark.asyncio(loop_scope="session")


# ── mock service ────────────────────────────────────────────────────────


@dataclass
@dataclass
class _MockProgressService:
    """进度领域 mock：``create_pending`` / ``list_progress`` / ``mark_progress``。

    记录调用以便断言顺序 / payload；响应由测试按 key 预置。
    """

    create_pending_calls: list[tuple[str, str, str, str | None]] = field(
        default_factory=list
    )
    list_progress_calls: list[str] = field(default_factory=list)
    mark_progress_calls: list[tuple[str, str, dict[str, Any]]] = field(
        default_factory=list
    )
    # Returns set per-call. Tests configure these.
    list_progress_responses: list[dict[str, Any]] = field(default_factory=list)
    mark_progress_responses: dict[
        tuple[str, str, int | None, bool | None], dict[str, Any] | None
    ] = field(default_factory=dict)

    async def create_pending(
        self,
        owner: str,
        course_id: str,
        topic: str,
        goal: str | None = None,
    ) -> None:
        self.create_pending_calls.append((owner, course_id, topic, goal))

    async def list_progress(self, owner: str) -> list[dict[str, Any]]:
        self.list_progress_calls.append(owner)
        return list(self.list_progress_responses)

    async def mark_progress(
        self,
        owner: str,
        course_id: str,
        *,
        session_done: int | None = None,
        exercise_done: bool | None = None,
    ) -> dict[str, Any] | None:
        self.mark_progress_calls.append(
            (
                owner,
                course_id,
                {"session_done": session_done, "exercise_done": exercise_done},
            )
        )
        return self.mark_progress_responses.get(
            (owner, course_id, session_done, exercise_done)
        )


@dataclass
class _MockGeneratorService:
    """生成编排 mock：``get_course`` / ``preview_next_lesson`` / ``require_ready_course``。

    记录调用以便断言顺序 / payload；响应由测试按 key 预置。
    """

    get_course_calls: list[tuple[str, str]] = field(default_factory=list)
    # Returns set per-call. Tests configure these.
    get_course_responses: dict[tuple[str, str], dict[str, Any] | None] = field(
        default_factory=dict
    )
    # ``POST /courses/{course_id}/lessons`` 只依赖 ``preview_next_lesson``
    # 一个公开方法（C1/C3：handler 不再打穿 _repo / _course_dir）。
    preview_calls: list[tuple[str, str]] = field(default_factory=list)
    preview_responses: dict[tuple[str, str], _MockPreviewResult | None] = (
        field(default_factory=dict)
    )
    # ``require_ready_course``（task-385 下载门）：按 (owner, course_id) 返回
    # 一个指向临时目录的真实仓库，或 None（等价「进度不存在 / failed / pending」）。
    # 未配置 → 默认指向 ``tmp_path / course_id``。
    ready_tmp_dir: Path | None = None
    require_ready_calls: list[tuple[str, str]] = field(default_factory=list)
    require_ready_none: set[tuple[str, str]] = field(default_factory=set)

    async def preview_next_lesson(
        self, owner: str, course_id: str
    ) -> _MockPreviewResult | None:
        """镜像 :meth:`CourseGeneratorService.preview_next_lesson` — 测试用。"""
        self.preview_calls.append((owner, course_id))
        return self.preview_responses.get((owner, course_id))

    async def get_course(
        self, owner: str, course_id: str
    ) -> dict[str, Any] | None:
        self.get_course_calls.append((owner, course_id))
        return self.get_course_responses.get((owner, course_id))

    async def require_ready_course(
        self, owner: str, course_id: str
    ):
        """镜像 :meth:`CourseGeneratorService.require_ready_course` — 测试用。

        未在 ``require_ready_none`` 里的 (owner, course_id) 返回指向
        ``ready_tmp_dir`` 的真实仓库（模拟「已就绪 + 磁盘有包」）。
        """
        from app.repositories.course_package_repo import CoursePackageRepo

        self.require_ready_calls.append((owner, course_id))
        if (owner, course_id) in self.require_ready_none:
            return None
        return CoursePackageRepo(
            course_id=course_id, tmp_dir=self.ready_tmp_dir
        )


@dataclass
class _MockPreviewResult:
    """``preview_next_lesson`` 的返回 stub（C1：一次调用带回预检 + kiq 字段）。

    ``None`` 等价于 service 层「进度不存在 / failed」。
    """

    next_num: int
    already_generated: bool
    topic: str = "Rust 入门"
    goal: str | None = None
    session_id: str | None = None


class _FakeKicker:
    """``kicker().with_labels(...).kiq(...)`` 的桩：捕获 kwargs，不真投递。

    handler 经 kicker 链投递（携带 ``enqueued_at`` 标签做投递时延观测），
    ``.kiq()`` 打桩已拦不住这条链，需把桩挂在 ``kicker`` 层。
    """

    def __init__(self, captured: dict[str, object] | None = None) -> None:
        self.captured = captured
        self.labels: dict[str, object] = {}

    def with_labels(self, **labels: object) -> _FakeKicker:
        self.labels.update(labels)
        return self

    async def kiq(self, *args: object, **kwargs: object) -> None:
        if self.captured is not None:
            self.captured.update(kwargs)
        return None


def _build_test_app(
    progress_mock: _MockProgressService,
    generator_mock: _MockGeneratorService,
    *,
    logged_in_user_id: int | None = None,
) -> FastAPI:
    """Build a FastAPI app with the learning router + auth + service overrides."""
    app = FastAPI()
    # Build a minimal AppState; only ``progress_svc`` / ``course_gen_svc`` are
    # touched by the router, so the other fields are None placeholders.
    state = AppState(
        user_svc=None,  # type: ignore[arg-type]
        passkey_svc=None,  # type: ignore[arg-type]
        github_svc=None,  # type: ignore[arg-type]
        public_svc=None,  # type: ignore[arg-type]
        status_svc=None,  # type: ignore[arg-type]
        gallery_svc=None,  # type: ignore[arg-type]
        weather_analysis_svc=None,  # type: ignore[arg-type]
        rss_svc=None,  # type: ignore[arg-type]
        sub_svc=None,  # type: ignore[arg-type]
        notification_svc=None,  # type: ignore[arg-type]
        device_svc=None,  # type: ignore[arg-type]
        fishing_svc=None,  # type: ignore[arg-type]
        friendlink_svc=None,  # type: ignore[arg-type]
        ai_svc=None,  # type: ignore[arg-type]
        progress_svc=progress_mock,  # type: ignore[arg-type]
        course_gen_svc=generator_mock,  # type: ignore[arg-type]
    )
    app.state.services = state
    app.include_router(router, prefix="/v2")
    register_exception_handlers(app)

    # Override auth: optional_user returns the configured user (or None).
    if logged_in_user_id is not None:
        app.dependency_overrides[optional_user] = lambda: logged_in_user_id
        app.dependency_overrides[manager] = lambda: logged_in_user_id
    else:
        app.dependency_overrides[optional_user] = lambda: None

    # Override get_app_state so Depends(get_app_state) returns our state.
    # The production version reads ``request.app.state.services``; this
    # override ensures we always get the same mock-backed instance.
    app.dependency_overrides[get_app_state] = lambda: state

    return app


@pytest.fixture(autouse=True)
def _patch_kiq(monkeypatch):
    """No-op the broker kick so we don't need a running Taskiq broker.

    task-352 多了 ``generate_next_lesson`` — 也 patch 一下,避免测试里无意触发
    真实的 broker 投递路径。handler 现经 ``kicker().with_labels().kiq()`` 投递
    （携带 enqueued_at 标签做投递时延观测），桩需挂在 ``kicker`` 层；
    ``generate_course`` 仍直接 ``.kiq()``，桩法不变。
    """
    import app.plugins.task.tasks.learning as task_mod

    async def _fake_kiq(*args, **kwargs):
        return None

    monkeypatch.setattr(task_mod.generate_course, "kiq", _fake_kiq)
    monkeypatch.setattr(task_mod.generate_next_lesson, "kiq", _fake_kiq)
    monkeypatch.setattr(
        task_mod.generate_next_lesson, "kicker", lambda: _FakeKicker()
    )
    yield


# ── POST /v2/learning/courses ───────────────────────────────────────────


async def test_post_courses_returns_pending_with_anon_owner():
    mock = _MockProgressService()
    app = _build_test_app(mock, _MockGeneratorService(), logged_in_user_id=None)
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test"
    ) as client:
        resp = await client.post(
            "/v2/learning/courses",
            json={"topic": "Rust 入门"},
            headers={"X-Anon-Id": "anon-uuid-1"},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["status"] == "pending"
    assert "course_id" in body["data"]
    assert body["data"]["course_id"].startswith("rust--")

    # create_pending 收到 anon owner 字符串(anon:uuid)
    assert len(mock.create_pending_calls) == 1
    owner, _course_id, topic, goal = mock.create_pending_calls[0]
    assert owner == "anon:anon-uuid-1"
    assert topic == "Rust 入门"
    # 不传 goal → 为 None
    assert goal is None


async def test_post_courses_passes_goal_to_create_pending_and_kiq(monkeypatch):
    """可选 goal 字段透传:create_pending 收到 goal,generate_course.kiq 也带 goal。"""
    import app.plugins.task.tasks.learning as task_mod

    captured: dict[str, object] = {}

    async def _capturing_kiq(*args, **kwargs):
        captured.update(kwargs)
        return None

    monkeypatch.setattr(task_mod.generate_course, "kiq", _capturing_kiq)

    mock = _MockProgressService()
    app = _build_test_app(mock, _MockGeneratorService(), logged_in_user_id=None)
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test"
    ) as client:
        resp = await client.post(
            "/v2/learning/courses",
            json={"topic": "Rust 入门", "goal": "能独立复述所有权规则"},
            headers={"X-Anon-Id": "anon-uuid-1"},
        )

    assert resp.status_code == 200
    owner, _course_id, topic, goal = mock.create_pending_calls[0]
    assert owner == "anon:anon-uuid-1"
    assert topic == "Rust 入门"
    assert goal == "能独立复述所有权规则"
    # kiq 透传 goal
    assert captured["goal"] == "能独立复述所有权规则"
    assert captured["topic"] == "Rust 入门"
    assert str(captured["course_id"]).startswith(
        "rust--"
    )  # build_course_id 生成


async def test_post_courses_uses_user_id_owner_when_logged_in():
    mock = _MockProgressService()
    app = _build_test_app(mock, _MockGeneratorService(), logged_in_user_id=42)
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test"
    ) as client:
        resp = await client.post(
            "/v2/learning/courses",
            json={"topic": "Go 入门"},
            # 即使带 X-Anon-Id 也应以登录 user_id 优先
            headers={"X-Anon-Id": "should-be-ignored"},
        )

    assert resp.status_code == 200
    owner, _cid, _topic, _goal = mock.create_pending_calls[0]
    assert owner == "42"


async def test_post_courses_validation_error_on_empty_topic():
    mock = _MockProgressService()
    app = _build_test_app(mock, _MockGeneratorService())
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test"
    ) as client:
        resp = await client.post(
            "/v2/learning/courses",
            json={"topic": ""},
            headers={"X-Anon-Id": "x"},
        )
    assert resp.status_code == 422


# ── GET /v2/learning/courses/{course_id} ────────────────────────────────


async def test_get_course_returns_pending_payload():
    mock = _MockGeneratorService()
    mock.get_course_responses[("anon:x", "c--00000001")] = {
        "status": "pending"
    }
    app = _build_test_app(_MockProgressService(), mock)
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test"
    ) as client:
        resp = await client.get(
            "/v2/learning/courses/c--00000001",
            headers={"X-Anon-Id": "x"},
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["status"] == "pending"
    assert body["data"]["course_id"] == "c--00000001"


async def test_get_course_returns_404_when_service_returns_none():
    mock = _MockGeneratorService()
    mock.get_course_responses[("anon:x", "missing--00000000")] = None
    app = _build_test_app(_MockProgressService(), mock)
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test"
    ) as client:
        resp = await client.get(
            "/v2/learning/courses/missing--00000000",
            headers={"X-Anon-Id": "x"},
        )
    # API 没有抛 404,而是包成 data={course_id, status=failed} + message
    # (前端据此展示 failed 态)。我们仅验证 data.status=failed 而非 status_code。
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "failed"


async def test_get_course_returns_ready_payload_with_course_dict():
    """``CoursePackage`` 现在含 ``lessons: list[LessonItem]``（task-351）。

    校验 ready 响应通过 ``course.model_dump(mode='json')`` 后,
    ``lessons[*].exercises`` 也嵌套序列化为数组。
    """
    from app.schemas.learning import CoursePackage, Exercise, LessonItem

    course = CoursePackage(
        course_id="c--00000001",
        topic="T",
        lessons=[
            LessonItem(
                id=1,
                title="第 1 课",
                slug="lesson-1",
                md="# lesson",
                exercises=[
                    Exercise(
                        id=1,
                        type="single_choice",
                        difficulty=1,
                        points=10,
                        prompt="?",
                        options=[{"key": "A", "text": "a"}],
                        answer="A",
                        explanation="x",
                    ),
                ],
            ),
        ],
        resource_md="# resource",
    )
    mock = _MockGeneratorService()
    mock.get_course_responses[("anon:x", "c--00000001")] = {
        "status": "ready",
        "course": course,
    }
    app = _build_test_app(_MockProgressService(), mock)
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test"
    ) as client:
        resp = await client.get(
            "/v2/learning/courses/c--00000001",
            headers={"X-Anon-Id": "x"},
        )
    assert resp.status_code == 200
    payload = resp.json()["data"]
    assert payload["status"] == "ready"
    assert payload["course"]["course_id"] == "c--00000001"
    # task-351:lessons[] 替代顶层 lesson_md / exercises
    assert len(payload["course"]["lessons"]) == 1
    lesson0 = payload["course"]["lessons"][0]
    assert lesson0["id"] == 1
    assert lesson0["title"] == "第 1 课"
    assert lesson0["slug"] == "lesson-1"
    assert lesson0["md"] == "# lesson"
    assert len(lesson0["exercises"]) == 1
    assert payload["course"]["resource_md"] == "# resource"
    # task-365：无 MISSION.md 的课程 → mission_md 为 null（前端隐藏展示）
    assert payload["course"]["mission_md"] is None


# ── POST /v2/learning/courses/{course_id}/lessons (task-352) ────────────


async def test_post_next_lesson_returns_pending_when_no_progress():
    """progress 不存在（preview 返回 None）→ ``{status: "failed", next_lesson: null}``,不入队。"""
    mock = _MockGeneratorService()
    mock.preview_responses[("anon:x", "nope--00000000")] = None
    app = _build_test_app(_MockProgressService(), mock)
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test"
    ) as client:
        resp = await client.post(
            "/v2/learning/courses/nope--00000000/lessons",
            headers={"X-Anon-Id": "x"},
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["status"] == "failed"
    assert body["data"]["course_id"] == "nope--00000000"
    assert body["data"]["next_lesson"] is None


async def test_post_next_lesson_returns_pending_when_disk_empty():
    """progress 存在 + 磁盘上无 lesson 文件 → 同步预检未命中,返回 ``pending``。

    ``next_lesson`` = 预期编号(1,因为 lessons/ 为空),``.kiq()`` 被 patch 为
    no-op,这里只断言响应数据形态。
    """
    mock = _MockGeneratorService()
    mock.preview_responses[("anon:x", "rust--aaaabbbb")] = _MockPreviewResult(
        next_num=1, already_generated=False, topic="Rust 入门"
    )
    app = _build_test_app(_MockProgressService(), mock)
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test"
    ) as client:
        resp = await client.post(
            "/v2/learning/courses/rust--aaaabbbb/lessons",
            headers={"X-Anon-Id": "x"},
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["status"] == "pending"
    assert body["data"]["course_id"] == "rust--aaaabbbb"
    assert body["data"]["next_lesson"] == 1


async def test_post_next_lesson_forwards_session_id_to_kiq(monkeypatch):
    """``POST /courses/{id}/lessons`` 把 preview 的 session_id 透传给
    ``generate_next_lesson.kiq``（task-373 — 渐进产出复用首课锚定的 agno 会话）。
    """
    import app.plugins.task.tasks.learning as task_mod

    captured: dict[str, object] = {}

    monkeypatch.setattr(
        task_mod.generate_next_lesson, "kicker", lambda: _FakeKicker(captured)
    )

    mock = _MockGeneratorService()
    mock.preview_responses[("anon:x", "rust--aaaabbbb")] = _MockPreviewResult(
        next_num=1,
        already_generated=False,
        topic="Rust 入门",
        session_id="sess-test",
    )
    app = _build_test_app(_MockProgressService(), mock)
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test"
    ) as client:
        resp = await client.post(
            "/v2/learning/courses/rust--aaaabbbb/lessons",
            headers={"X-Anon-Id": "x"},
        )
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "pending"
    # kiq 收到的 session_id == progress.session_id
    assert captured["session_id"] == "sess-test"
    assert captured["topic"] == "Rust 入门"
    assert captured["course_id"] == "rust--aaaabbbb"


async def test_post_next_lesson_forwards_goal_to_kiq(monkeypatch):
    """``POST /courses/{id}/lessons`` 也把 preview 的 goal 透传给 kiq（task-352）。

    与 session_id 透传一起练手：保证两层字段都不漏。
    """
    import app.plugins.task.tasks.learning as task_mod

    captured: dict[str, object] = {}

    monkeypatch.setattr(
        task_mod.generate_next_lesson, "kicker", lambda: _FakeKicker(captured)
    )

    mock = _MockGeneratorService()
    mock.preview_responses[("anon:x", "rust--aaaabbbb")] = _MockPreviewResult(
        next_num=1,
        already_generated=False,
        topic="Rust 入门",
        goal="能独立复述所有权规则",
        session_id="sess-goal",
    )
    app = _build_test_app(_MockProgressService(), mock)
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test"
    ) as client:
        resp = await client.post(
            "/v2/learning/courses/rust--aaaabbbb/lessons",
            headers={"X-Anon-Id": "x"},
        )
    assert resp.status_code == 200
    assert captured["goal"] == "能独立复述所有权规则"
    assert captured["session_id"] == "sess-goal"


async def test_post_next_lesson_returns_already_generated_when_next_file_exists():
    """同步预检命中（preview.already_generated=True）→ 立刻 ``already_generated``,不入队。

    幂等预检现在由 ``CourseGeneratorService.preview_next_lesson`` 统一承担（C1/C3）：
    handler 只消费返回的 ``already_generated`` 标记，不再自己扫描磁盘，也不再
    依赖为测试而生的 ``_list_existing_lesson_ids_for_api`` 别名。
    """
    course_id = "rust--aaaabbbb"
    mock = _MockGeneratorService()
    mock.preview_responses[("anon:x", course_id)] = _MockPreviewResult(
        next_num=3, already_generated=True, topic="Rust 入门"
    )
    app = _build_test_app(_MockProgressService(), mock)
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test"
    ) as client:
        resp = await client.post(
            f"/v2/learning/courses/{course_id}/lessons",
            headers={"X-Anon-Id": "x"},
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["status"] == "already_generated"
    assert body["data"]["course_id"] == course_id
    assert body["data"]["next_lesson"] is None
    assert body["message"] == "下一课已生成"


async def test_post_next_lesson_returns_failed_when_progress_failed():
    """progress 状态为 failed（preview 返回 None）→ ``{status: failed, next_lesson: null}``。"""
    mock = _MockGeneratorService()
    mock.preview_responses[("anon:x", "rust--aaaabbbb")] = None
    app = _build_test_app(_MockProgressService(), mock)
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test"
    ) as client:
        resp = await client.post(
            "/v2/learning/courses/rust--aaaabbbb/lessons",
            headers={"X-Anon-Id": "x"},
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["status"] == "failed"
    assert body["data"]["next_lesson"] is None


# ── GET /v2/learning/progress ──────────────────────────────────────────


async def test_list_progress_returns_items_with_owner():
    mock = _MockProgressService()
    mock.list_progress_responses = [
        {
            "course_id": "c1--00000001",
            "topic": "T1",
            "sessions_done": [1],
            "exercise_done": False,
            "status": "ready",
            "next_session": 2,
        }
    ]
    app = _build_test_app(mock, _MockGeneratorService(), logged_in_user_id=7)
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test"
    ) as client:
        resp = await client.get("/v2/learning/progress")

    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["course_id"] == "c1--00000001"
    assert mock.list_progress_calls == ["7"]


async def test_list_progress_anon_uses_x_anon_id():
    mock = _MockProgressService()
    mock.list_progress_responses = []
    app = _build_test_app(mock, _MockGeneratorService())
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test"
    ) as client:
        resp = await client.get(
            "/v2/learning/progress",
            headers={"X-Anon-Id": "abc"},
        )
    assert resp.status_code == 200
    assert mock.list_progress_calls == ["anon:abc"]


# ── PATCH /v2/learning/progress/{course_id} ──────────────────────────


async def test_patch_progress_marks_session_done():
    mock = _MockProgressService()
    mock.mark_progress_responses[("anon:x", "c--00000001", 1, None)] = {
        "course_id": "c--00000001",
        "topic": "T",
        "sessions_done": [1],
        "exercise_done": False,
        "status": "ready",
        "next_session": 2,
    }
    app = _build_test_app(mock, _MockGeneratorService())
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test"
    ) as client:
        resp = await client.patch(
            "/v2/learning/progress/c--00000001",
            json={"session_done": 1},
            headers={"X-Anon-Id": "x"},
        )

    assert resp.status_code == 200
    assert resp.json()["data"]["sessions_done"] == [1]
    call = mock.mark_progress_calls[0]
    assert call[0] == "anon:x"
    assert call[1] == "c--00000001"
    assert call[2] == {"session_done": 1, "exercise_done": None}


async def test_patch_progress_marks_exercise_done():
    mock = _MockProgressService()
    mock.mark_progress_responses[("anon:x", "c--00000001", None, True)] = {
        "course_id": "c--00000001",
        "topic": "T",
        "sessions_done": [],
        "exercise_done": True,
        "status": "ready",
        "next_session": 1,
    }
    app = _build_test_app(mock, _MockGeneratorService())
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test"
    ) as client:
        resp = await client.patch(
            "/v2/learning/progress/c--00000001",
            json={"exercise_done": True},
            headers={"X-Anon-Id": "x"},
        )
    assert resp.status_code == 200
    assert resp.json()["data"]["exercise_done"] is True


async def test_patch_progress_returns_missing_payload_when_not_found():
    mock = _MockProgressService()
    # service.mark_progress 返回 None → API 包裹成 message="进度不存在"
    app = _build_test_app(mock, _MockGeneratorService())
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test"
    ) as client:
        resp = await client.patch(
            "/v2/learning/progress/missing--00000000",
            json={"session_done": 1},
            headers={"X-Anon-Id": "x"},
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["message"] == "进度不存在"
    assert body["data"] == {"course_id": "missing--00000000"}


async def test_patch_progress_validation_on_bad_session():
    mock = _MockProgressService()
    app = _build_test_app(mock, _MockGeneratorService())
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test"
    ) as client:
        resp = await client.patch(
            "/v2/learning/progress/c--00000001",
            json={"session_done": 0},  # ge=1
            headers={"X-Anon-Id": "x"},
        )
    assert resp.status_code == 422


# ── GET bundle.zip / files/{path} (task-387) ────────────────────────────


def _seed_course_package(tmp_path, course_id: str = "rust--aaaabbbb") -> None:
    """在 ``tmp_path/<course_id>`` 落盘一份可下载的课程包（两课 + resource + MISSION）。"""
    from app.repositories.course_package_repo import CoursePackageRepo

    repo = CoursePackageRepo(course_id=course_id, tmp_dir=tmp_path)
    repo.write_lesson(slug="lesson-1", lesson_md="---\ntitle: 第 1 课\n---\n# 1")
    repo.write_lesson(slug="lesson-2", lesson_md="---\ntitle: 第 2 课\n---\n# 2")
    repo.write_resource("# resource")
    repo.write_mission("# mission")


@pytest.fixture
def _learning_root(tmp_path, monkeypatch):
    """把 ``LEARNING_ROOT_DIR`` 指到测试临时目录，使 handler 的
    ``CoursePackageRepo(course_id=...)`` 读到磁盘上的真实课程包。"""
    from app.core.config import settings

    monkeypatch.setattr(settings, "LEARNING_ROOT_DIR", str(tmp_path))
    return tmp_path


async def test_download_bundle_returns_zip_for_owner(_learning_root, tmp_path):
    """owner 且 ready → ZIP 200，Content-Type/Disposition 正确，内含全部 md 制品。"""
    _seed_course_package(tmp_path, course_id="rust--aaaabbbb")

    gen = _MockGeneratorService(ready_tmp_dir=tmp_path)
    app = _build_test_app(_MockProgressService(), gen)
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test"
    ) as client:
        resp = await client.get(
            "/v2/learning/courses/rust--aaaabbbb/bundle.zip",
            headers={"X-Anon-Id": "x"},
        )

    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/zip"
    assert (
        resp.headers["content-disposition"]
        == 'attachment; filename="rust--aaaabbbb.zip"'
    )
    # 校验 ZIP 归档内部结构（保留 lessons/ 子目录 + 顶层 resource/MISSION）
    import io
    import zipfile

    zf = zipfile.ZipFile(io.BytesIO(resp.content))
    names = sorted(zf.namelist())
    assert names == [
        "MISSION.md",
        "lessons/0001-lesson-1.md",
        "lessons/0002-lesson-2.md",
        "resource.md",
    ]
    assert zf.read("lessons/0001-lesson-1.md").startswith(b"---")


async def test_download_bundle_404_when_not_owner(_learning_root):
    """无 token + 无 X-Anon-Id → owner 兜底 IP，无进度 → 统一 404（不泄露存在性）。"""
    gen = _MockGeneratorService()
    gen.require_ready_none.add(("anon:127.0.0.1", "rust--aaaabbbb"))
    app = _build_test_app(_MockProgressService(), gen)
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test"
    ) as client:
        resp = await client.get(
            "/v2/learning/courses/rust--aaaabbbb/bundle.zip"
        )
    assert resp.status_code == 404
    # 响应体走 NotFoundError 信封（message/data）
    assert "data" in resp.json()


async def test_download_bundle_404_when_pending(_learning_root, tmp_path):
    """进度仍 pending → 不可下载，统一 404。"""
    _seed_course_package(tmp_path)
    gen = _MockGeneratorService(ready_tmp_dir=tmp_path)
    gen.require_ready_none.add(("anon:x", "rust--aaaabbbb"))
    app = _build_test_app(_MockProgressService(), gen)
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test"
    ) as client:
        resp = await client.get(
            "/v2/learning/courses/rust--aaaabbbb/bundle.zip",
            headers={"X-Anon-Id": "x"},
        )
    assert resp.status_code == 404


async def test_download_bundle_404_when_course_dir_missing(_learning_root):
    """进度 ready 但磁盘课程包不存在 → 404。"""
    gen = _MockGeneratorService()
    gen.require_ready_none.add(("anon:x", "missing--00000000"))
    app = _build_test_app(_MockProgressService(), gen)
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test"
    ) as client:
        resp = await client.get(
            "/v2/learning/courses/missing--00000000/bundle.zip",
            headers={"X-Anon-Id": "x"},
        )
    assert resp.status_code == 404


async def test_download_single_file_returns_md(_learning_root, tmp_path):
    """owner + 合法 rel_path → 200，Content-Type text/markdown，body 为文件内容。"""
    _seed_course_package(tmp_path)
    gen = _MockGeneratorService(ready_tmp_dir=tmp_path)
    app = _build_test_app(_MockProgressService(), gen)
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test"
    ) as client:
        resp = await client.get(
            "/v2/learning/courses/rust--aaaabbbb/files/lessons/0001-lesson-1.md",
            headers={"X-Anon-Id": "x"},
        )
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("text/markdown")
        assert resp.content.startswith(b"---")

        # 顶层文件（resource.md）同样可下
        resp2 = await client.get(
            "/v2/learning/courses/rust--aaaabbbb/files/resource.md",
            headers={"X-Anon-Id": "x"},
        )
        assert resp2.status_code == 200
        assert resp2.content == b"# resource"


async def test_download_single_file_404_on_path_traversal(_learning_root, tmp_path):
    """``rel_path`` 含 ``..`` 或后缀非 ``.md`` → 404（repo 安全校验）。"""
    _seed_course_package(tmp_path)
    gen = _MockGeneratorService(ready_tmp_dir=tmp_path)
    app = _build_test_app(_MockProgressService(), gen)
    transport = ASGITransport(app=app)
    from urllib.parse import quote

    async with AsyncClient(
        transport=transport, base_url="http://test"
    ) as client:
        for bad in (
            "../etc/passwd",
            "lessons/../../etc/passwd",
            "/etc/passwd",
            "lessons/0001-lesson-1.txt",
            "lessons/9999-nope.md",
        ):
            # URL 编码避开 httpx 对 `..` 段的归一化，让原始 rel_path 到达 handler
            encoded = quote(bad, safe="")
            resp = await client.get(
                f"/v2/learning/courses/rust--aaaabbbb/files/{encoded}",
                headers={"X-Anon-Id": "x"},
            )
            assert resp.status_code == 404, f"expected 404 for {bad}"


async def test_download_single_file_404_when_not_owner(_learning_root):
    """非 owner（无进度）→ 404，即使文件在磁盘上存在。"""
    repo = CoursePackageRepo(
        course_id="rust--aaaabbbb", tmp_dir=_learning_root
    )
    repo.write_lesson(slug="lesson-1", lesson_md="# 1")

    gen = _MockGeneratorService(ready_tmp_dir=_learning_root)
    gen.require_ready_none.add(("anon:127.0.0.1", "rust--aaaabbbb"))
    app = _build_test_app(_MockProgressService(), gen)
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test"
    ) as client:
        resp = await client.get(
            "/v2/learning/courses/rust--aaaabbbb/files/lessons/0001-lesson-1.md"
        )
    assert resp.status_code == 404


async def test_list_course_files_returns_entries(_learning_root, tmp_path):
    """owner 且 ready → GET /courses/{id}/files 返回全部 md 制品（含大小）。"""
    _seed_course_package(tmp_path)
    gen = _MockGeneratorService(ready_tmp_dir=tmp_path)
    app = _build_test_app(_MockProgressService(), gen)
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test"
    ) as client:
        resp = await client.get(
            "/v2/learning/courses/rust--aaaabbbb/files",
            headers={"X-Anon-Id": "x"},
        )

    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    rel_paths = [it["rel_path"] for it in items]
    assert rel_paths == [
        "lessons/0001-lesson-1.md",
        "lessons/0002-lesson-2.md",
        "MISSION.md",
        "resource.md",
    ]
    # 每个条目带大小（字节）——面板据此展示 KB/MB
    assert all(it["size"] > 0 for it in items)
    assert all("name" in it and "mtime" in it for it in items)


async def test_list_course_files_404_when_not_owner(_learning_root):
    """非 owner → GET /courses/{id}/files 404。"""
    gen = _MockGeneratorService()
    gen.require_ready_none.add(("anon:127.0.0.1", "rust--aaaabbbb"))
    app = _build_test_app(_MockProgressService(), gen)
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test"
    ) as client:
        resp = await client.get(
            "/v2/learning/courses/rust--aaaabbbb/files"
        )
    assert resp.status_code == 404


# ── _resolve_learning_owner 单元测试 ──────────────────────────────────


def _dummy_request(headers: dict[str, str], host: str = "1.2.3.4"):
    """构造一个最小 Request stub。无需 starlette/ASGI,直接构造 namespace。"""

    class _Req:
        def __init__(self, headers: dict[str, str], client_host: str):
            self.headers = headers
            self.client = type("Client", (), {"host": client_host})()

    return _Req(headers, host)


async def test_resolve_owner_user_id_wins_over_header():
    req = _dummy_request({"x-anon-id": "ignored"})
    assert _resolve_learning_owner(user_id=123, request=req) == "123"


async def test_resolve_owner_uses_anon_id_header_when_anon():
    req = _dummy_request({"x-anon-id": "abc-uuid"})
    assert (
        _resolve_learning_owner(user_id=None, request=req) == "anon:abc-uuid"
    )


async def test_resolve_owner_falls_back_to_client_ip():
    req = _dummy_request(headers={}, host="9.9.9.9")
    assert _resolve_learning_owner(user_id=None, request=req) == "anon:9.9.9.9"


async def test_resolve_owner_empty_anon_id_header_falls_back_to_ip():
    """X-Anon-Id 存在但为空 → 视为未提供,降级 IP。"""
    req = _dummy_request({"x-anon-id": ""}, host="5.6.7.8")
    # falsy header 应该走 fallback 分支
    assert _resolve_learning_owner(user_id=None, request=req) == "anon:5.6.7.8"
