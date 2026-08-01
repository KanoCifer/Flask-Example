"""Contract tests for the v2 learning API (``app.api.v2.learning``).

We build a lightweight FastAPI app with the learning router registered and
inject a mock ``LearningService`` into ``app.state.services`` via the same
``Depends(get_app_state)`` mechanism production uses.  The Taskiq broker
kick (``.kiq()``) is patched to a no-op so no broker / worker is needed.

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

pytestmark = pytest.mark.asyncio(loop_scope="session")


# ── mock service ────────────────────────────────────────────────────────


@dataclass
class _MockLearningService:
    """Records calls so tests can assert ordering / payloads."""

    create_pending_calls: list[tuple[str, str, str, str | None]] = field(
        default_factory=list
    )
    get_course_calls: list[tuple[str, str]] = field(default_factory=list)
    list_progress_calls: list[str] = field(default_factory=list)
    mark_progress_calls: list[tuple[str, str, dict[str, Any]]] = field(
        default_factory=list
    )
    # Returns set per-call. Tests configure these.
    get_course_responses: dict[tuple[str, str], dict[str, Any] | None] = field(
        default_factory=dict
    )
    list_progress_responses: list[dict[str, Any]] = field(default_factory=list)
    mark_progress_responses: dict[str, dict[str, Any] | None] = field(
        default_factory=dict
    )
    # ``POST /courses/{course_id}/lessons`` 直接访问 ``_repo.get_progress`` 与
    # ``_course_dir``;测试在构造时注入 mock,避免触碰 mongo / 磁盘。
    _repo: _MockLearningRepo | None = None
    # 课程根目录(供 API 层 ``_list_existing_lesson_ids_for_api`` 扫描);
    # 测试置 ``None`` → 路径解析为不存在的目录,等价于「磁盘空」。
    _course_dir_root: Path | None = None

    def _course_dir(self, course_id: str) -> Path:
        """镜像 :meth:`LearningService._course_dir` 的签名 — 测试用。"""
        root = self._course_dir_root or Path("/nonexistent")
        return root / course_id

    async def create_pending(
        self,
        owner: str,
        course_id: str,
        topic: str,
        goal: str | None = None,
    ) -> None:
        self.create_pending_calls.append((owner, course_id, topic, goal))

    async def get_course(
        self, owner: str, course_id: str
    ) -> dict[str, Any] | None:
        self.get_course_calls.append((owner, course_id))
        return self.get_course_responses.get((owner, course_id))

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
class _MockLearningProgress:
    """最小化的 progress stub,匹配 ``learning_svc._repo.get_progress`` 形状。"""

    topic: str
    status: str = "ready"


@dataclass
class _MockLearningRepo:
    """``_MockLearningService._repo`` 代理(API ``POST /lessons`` 经此读 progress)。

    提供 ``get_progress`` 一个最小方法足以让 ``POST /courses/{course_id}/lessons``
    走完整路径(预检 topic 与状态)。
    """

    progress: dict[tuple[str, str], _MockLearningProgress] = field(
        default_factory=dict
    )

    async def get_progress(
        self, owner: str, course_id: str
    ) -> _MockLearningProgress | None:
        return self.progress.get((owner, course_id))


def _build_test_app(
    mock_svc: _MockLearningService,
    *,
    logged_in_user_id: int | None = None,
) -> FastAPI:
    """Build a FastAPI app with the learning router + auth + service overrides."""
    app = FastAPI()
    # Build a minimal AppState; only ``learning_svc`` is touched by the router,
    # so the other fields are None placeholders.
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
        learning_svc=mock_svc,  # type: ignore[arg-type]
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
    真实的 broker 投递路径。
    """
    import app.plugins.task.tasks.learning as task_mod

    async def _fake_kiq(*args, **kwargs):
        return None

    monkeypatch.setattr(task_mod.generate_course, "kiq", _fake_kiq)
    monkeypatch.setattr(task_mod.generate_next_lesson, "kiq", _fake_kiq)
    yield


# ── POST /v2/learning/courses ───────────────────────────────────────────


async def test_post_courses_returns_pending_with_anon_owner():
    mock = _MockLearningService()
    app = _build_test_app(mock, logged_in_user_id=None)
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

    mock = _MockLearningService()
    app = _build_test_app(mock, logged_in_user_id=None)
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
    assert str(captured["course_id"]).startswith("rust--")  # build_course_id 生成


async def test_post_courses_uses_user_id_owner_when_logged_in():
    mock = _MockLearningService()
    app = _build_test_app(mock, logged_in_user_id=42)
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
    mock = _MockLearningService()
    app = _build_test_app(mock)
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
    mock = _MockLearningService()
    mock.get_course_responses[("anon:x", "c--00000001")] = {"status": "pending"}
    app = _build_test_app(mock)
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
    mock = _MockLearningService()
    mock.get_course_responses[("anon:x", "missing--00000000")] = None
    app = _build_test_app(mock)
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
    mock = _MockLearningService()
    mock.get_course_responses[("anon:x", "c--00000001")] = {
        "status": "ready",
        "course": course,
    }
    app = _build_test_app(mock)
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
    """progress 不存在 → ``{status: "failed", next_lesson: null}``,不入队。"""
    mock = _MockLearningService()
    mock._repo = _MockLearningRepo()  # 空的 progress 字典
    app = _build_test_app(mock)
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


async def test_post_next_lesson_returns_pending_when_disk_empty(tmp_path):
    """progress 存在 + 磁盘上无 lesson 文件 → 同步预检未命中,返回 ``pending``。

    ``next_lesson`` = 预期编号(1,因为 lessons/ 为空),``.kiq()`` 被 patch 为
    no-op,这里只断言响应数据形态。
    """
    mock = _MockLearningService()
    mock._repo = _MockLearningRepo(
        progress={("anon:x", "rust--aaaabbbb"): _MockLearningProgress(
            topic="Rust 入门", status="ready"
        )},
    )
    mock._course_dir_root = tmp_path
    app = _build_test_app(mock)
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


async def test_post_next_lesson_returns_already_generated_when_next_file_exists(
    tmp_path, monkeypatch,
):
    """同步预检命中 → 立刻 ``already_generated``,不入队。

    该分支只覆盖一种 race:kiq 已落地 next_num 文件但 progress 状态尚未被改
    变(罕见)。直接构造「next_num 文件已存在」比较繁琐(因为 existing_ids
    会把 next_num 也算进去),这里 monkeypatch ``_list_existing_lesson_ids_for_api``
    强制返回一个**不含** next_num 的列表,然后让 ``_lesson_file_exists`` 自然
    命中。
    """
    import app.api.v2.learning as api_mod

    course_id = "rust--aaaabbbb"
    lessons_dir = tmp_path / course_id / "lessons"
    lessons_dir.mkdir(parents=True)
    # 让 next_num = 3 的文件存在,但 monkeypatch 让 existing_ids 看不到它
    (lessons_dir / "0003-foo.md").write_text("# l3", encoding="utf-8")

    # 强制 existing_ids=[1,2] → next_num=3 → file_exists(3) 命中
    monkeypatch.setattr(
        api_mod, "_list_existing_lesson_ids_for_api", lambda d: [1, 2]
    )

    mock = _MockLearningService()
    mock._repo = _MockLearningRepo(
        progress={("anon:x", course_id): _MockLearningProgress(
            topic="Rust 入门", status="ready"
        )},
    )
    mock._course_dir_root = tmp_path
    app = _build_test_app(mock)
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


async def test_post_next_lesson_returns_failed_when_progress_failed(tmp_path):
    """progress 状态为 failed → ``{status: failed, next_lesson: null}``。"""
    mock = _MockLearningService()
    mock._repo = _MockLearningRepo(
        progress={("anon:x", "rust--aaaabbbb"): _MockLearningProgress(
            topic="Rust 入门", status="failed"
        )},
    )
    mock._course_dir_root = tmp_path
    app = _build_test_app(mock)
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
    mock = _MockLearningService()
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
    app = _build_test_app(mock, logged_in_user_id=7)
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
    mock = _MockLearningService()
    mock.list_progress_responses = []
    app = _build_test_app(mock)
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
    mock = _MockLearningService()
    mock.mark_progress_responses[
        ("anon:x", "c--00000001", 1, None)
    ] = {
        "course_id": "c--00000001",
        "topic": "T",
        "sessions_done": [1],
        "exercise_done": False,
        "status": "ready",
        "next_session": 2,
    }
    app = _build_test_app(mock)
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
    mock = _MockLearningService()
    mock.mark_progress_responses[
        ("anon:x", "c--00000001", None, True)
    ] = {
        "course_id": "c--00000001",
        "topic": "T",
        "sessions_done": [],
        "exercise_done": True,
        "status": "ready",
        "next_session": 1,
    }
    app = _build_test_app(mock)
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
    mock = _MockLearningService()
    # service.mark_progress 返回 None → API 包裹成 message="进度不存在"
    app = _build_test_app(mock)
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
    mock = _MockLearningService()
    app = _build_test_app(mock)
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
    assert _resolve_learning_owner(user_id=None, request=req) == "anon:abc-uuid"


async def test_resolve_owner_falls_back_to_client_ip():
    req = _dummy_request(headers={}, host="9.9.9.9")
    assert _resolve_learning_owner(user_id=None, request=req) == "anon:9.9.9.9"


async def test_resolve_owner_empty_anon_id_header_falls_back_to_ip():
    """X-Anon-Id 存在但为空 → 视为未提供,降级 IP。"""
    req = _dummy_request({"x-anon-id": ""}, host="5.6.7.8")
    # falsy header 应该走 fallback 分支
    assert _resolve_learning_owner(user_id=None, request=req) == "anon:5.6.7.8"
