"""Pure-mock tests for ``app.services.learning_progress_service`` (task-375, C2).

Mocking strategy：进度侧测试**完全不触碰 Mongo / beanie**——构造
``LearningProgressService(repo=<FakeRepo>)``，其中 ``FakeRepo`` 是手写的
async 方法桩：记录每次调用的参数、返回预置结果，不含任何持久化 IO。

进度文档用 :class:`types.SimpleNamespace` 鸭子类型替身（避开 beanie
``Document`` 构造需要 ``init_beanie`` 的约束），字段与
``LearningProgress`` 一致；序列化仍走真实
:func:`learning_utils._progress_to_dict`（纯函数，只读属性）。

覆盖 C2 拆出的全部公开面：
``create_pending``（status=pending + goal 传参）、``list_progress``
（经真实 :func:`_progress_to_dict` 序列化）、``mark_progress``
（session_done / exercise_done 分支 + None 兜底补读）、``merge_progress``
（empty-owner / self-merge 双 guard + repo 委托）、``mark_ready``（断言
status="ready" + topic + goal + session_id 传参）、``mark_failed``（断言
set_status("failed")）、``get_progress``（透传 repo）。
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest

from app.repositories.learning_repo import LearningRepo
from app.services.learning_progress_service import LearningProgressService
from app.services.learning_utils import _progress_to_dict

pytestmark = pytest.mark.asyncio(loop_scope="session")


class _FakeRepo:
    """进度侧 repo 桩：async 方法记录调用并返回预置结果，无任何 Mongo 依赖。"""

    def __init__(self) -> None:
        self.upsert_calls: list[dict] = []
        self.set_status_calls: list[tuple[str, str, str]] = []
        self.add_session_done_calls: list[tuple[str, str, int]] = []
        self.set_exercise_done_calls: list[tuple[str, str, bool]] = []
        self.merge_calls: list[tuple[str, str]] = []
        self.list_docs: list[Any] = []
        self.get_returns: dict[tuple[str, str], Any | None] = {}
        self.add_session_done_result: Any | None = None
        self.set_exercise_done_result: Any | None = None
        self.merge_result: int = 0

    async def upsert_progress(
        self,
        *,
        owner: str,
        course_id: str,
        topic: str,
        status: str,
        goal: str | None = None,
        session_id: str | None = None,
    ) -> None:
        self.upsert_calls.append(
            {
                "owner": owner,
                "course_id": course_id,
                "topic": topic,
                "status": status,
                "goal": goal,
                "session_id": session_id,
            }
        )

    async def list_progress(self, owner: str) -> list[Any]:
        return list(self.list_docs)

    async def add_session_done(
        self, owner: str, course_id: str, session_num: int
    ) -> Any | None:
        self.add_session_done_calls.append((owner, course_id, session_num))
        return self.add_session_done_result

    async def set_exercise_done(
        self, owner: str, course_id: str, done: bool = True
    ) -> Any | None:
        self.set_exercise_done_calls.append((owner, course_id, done))
        return self.set_exercise_done_result

    async def set_status(
        self, owner: str, course_id: str, status: str
    ) -> None:
        self.set_status_calls.append((owner, course_id, status))

    async def merge_anon_into_user(
        self, anon_owner: str, user_owner: str
    ) -> int:
        self.merge_calls.append((anon_owner, user_owner))
        return self.merge_result

    async def get_progress(
        self, owner: str, course_id: str
    ) -> Any | None:
        return self.get_returns.get((owner, course_id))


def _doc(
    *,
    owner: str = "u1",
    course_id: str = "c--00000001",
    topic: str = "T",
    goal: str | None = None,
    session_id: str | None = None,
    sessions_done: list[int] | None = None,
    exercise_done: bool = False,
    status: str = "pending",
) -> SimpleNamespace:
    """构造进度文档的鸭子类型替身（避开 beanie 构造需 init，纯 mock 无 Mongo）。

    字段与 :class:`LearningProgress` 一致，``next_session`` 按模型属性同语义
    推导（1..max_done+1 内最小未完成的编号；全完成则 None）。
    """
    done = sessions_done or []

    def _next_session() -> int | None:
        upper = (max(done) + 1) if done else 1
        for n in range(1, upper + 1):
            if n not in done:
                return n
        return None

    return SimpleNamespace(
        owner=owner,
        course_id=course_id,
        topic=topic,
        goal=goal,
        session_id=session_id,
        sessions_done=done,
        exercise_done=exercise_done,
        status=status,
        next_session=_next_session(),
    )


# ── create_pending ────────────────────────────────────────────────────────


async def test_create_pending_passes_status_pending_and_goal():
    repo = _FakeRepo()
    svc = LearningProgressService(repo=repo)

    await svc.create_pending(
        owner="u1", course_id="c--00000001", topic="T", goal="g1"
    )

    assert repo.upsert_calls == [
        {
            "owner": "u1",
            "course_id": "c--00000001",
            "topic": "T",
            "status": "pending",
            "goal": "g1",
            "session_id": None,
        }
    ]


async def test_create_pending_without_goal_passes_goal_none():
    repo = _FakeRepo()
    svc = LearningProgressService(repo=repo)

    await svc.create_pending(owner="u1", course_id="c--00000001", topic="T")

    assert len(repo.upsert_calls) == 1
    assert repo.upsert_calls[0]["status"] == "pending"
    assert repo.upsert_calls[0]["goal"] is None


# ── list_progress ─────────────────────────────────────────────────────────


async def test_list_progress_serializes_via_progress_to_dict():
    repo = _FakeRepo()
    docs = [
        _doc(course_id="c--00000001", sessions_done=[1, 2]),
        _doc(course_id="c--00000002", status="ready", exercise_done=True),
    ]
    repo.list_docs = docs
    svc = LearningProgressService(repo=repo)

    items = await svc.list_progress(owner="u1")

    assert items == [_progress_to_dict(d) for d in docs]
    assert items[0]["next_session"] == 3
    assert items[0]["sessions_done"] == [1, 2]
    assert items[1]["status"] == "ready"
    assert items[1]["exercise_done"] is True


# ── mark_progress ─────────────────────────────────────────────────────────


async def test_mark_progress_session_done_branch():
    repo = _FakeRepo()
    doc = _doc(sessions_done=[1])
    repo.add_session_done_result = doc
    svc = LearningProgressService(repo=repo)

    out = await svc.mark_progress(
        owner="u1", course_id="c--00000001", session_done=2
    )

    assert repo.add_session_done_calls == [("u1", "c--00000001", 2)]
    assert repo.set_exercise_done_calls == []
    assert out == _progress_to_dict(doc)


async def test_mark_progress_exercise_done_branch():
    repo = _FakeRepo()
    doc = _doc(exercise_done=True)
    repo.set_exercise_done_result = doc
    svc = LearningProgressService(repo=repo)

    out = await svc.mark_progress(
        owner="u1", course_id="c--00000001", exercise_done=True
    )

    assert repo.set_exercise_done_calls == [("u1", "c--00000001", True)]
    assert repo.add_session_done_calls == []
    assert out == _progress_to_dict(doc)


async def test_mark_progress_none_fallback_re_reads():
    repo = _FakeRepo()
    doc = _doc()
    repo.get_returns[("u1", "c--00000001")] = doc
    svc = LearningProgressService(repo=repo)

    out = await svc.mark_progress(owner="u1", course_id="c--00000001")

    # 无 mutation：既不 add_session_done 也不 set_exercise_done，直接补读
    assert repo.add_session_done_calls == []
    assert repo.set_exercise_done_calls == []
    assert out == _progress_to_dict(doc)


async def test_mark_progress_returns_none_when_progress_missing():
    repo = _FakeRepo()
    svc = LearningProgressService(repo=repo)

    assert (
        await svc.mark_progress(owner="ghost", course_id="x--00000000")
    ) is None


# ── merge_progress ────────────────────────────────────────────────────────


async def test_merge_progress_empty_owner_returns_zero():
    repo = _FakeRepo()
    svc = LearningProgressService(repo=repo)

    assert await svc.merge_progress("", "u1") == 0
    assert await svc.merge_progress("anon:x", "") == 0
    assert repo.merge_calls == []


async def test_merge_progress_self_merge_returns_zero():
    repo = _FakeRepo()
    svc = LearningProgressService(repo=repo)

    assert await svc.merge_progress("u1", "u1") == 0
    assert repo.merge_calls == []


async def test_merge_progress_delegates_to_repo():
    repo = _FakeRepo()
    repo.merge_result = 3
    svc = LearningProgressService(repo=repo)

    assert await svc.merge_progress("anon:x", "u1") == 3
    assert repo.merge_calls == [("anon:x", "u1")]


# ── mark_ready ────────────────────────────────────────────────────────────


async def test_mark_ready_passes_ready_topic_goal_session_id():
    repo = _FakeRepo()
    svc = LearningProgressService(repo=repo)

    await svc.mark_ready(
        owner="u1",
        course_id="c--00000001",
        topic="T",
        goal="g1",
        session_id="sess-1",
    )

    assert repo.upsert_calls == [
        {
            "owner": "u1",
            "course_id": "c--00000001",
            "topic": "T",
            "status": "ready",
            "goal": "g1",
            "session_id": "sess-1",
        }
    ]


async def test_mark_ready_defaults_goal_and_session_id_none():
    repo = _FakeRepo()
    svc = LearningProgressService(repo=repo)

    await svc.mark_ready(owner="u1", course_id="c--00000001", topic="T")

    assert len(repo.upsert_calls) == 1
    assert repo.upsert_calls[0]["status"] == "ready"
    assert repo.upsert_calls[0]["topic"] == "T"
    assert repo.upsert_calls[0]["goal"] is None
    assert repo.upsert_calls[0]["session_id"] is None


# ── mark_failed ───────────────────────────────────────────────────────────


async def test_mark_failed_calls_set_status_failed():
    repo = _FakeRepo()
    svc = LearningProgressService(repo=repo)

    await svc.mark_failed(owner="u1", course_id="c--00000001")

    assert repo.set_status_calls == [("u1", "c--00000001", "failed")]


# ── get_progress ──────────────────────────────────────────────────────────


async def test_get_progress_passthrough():
    repo = _FakeRepo()
    doc = _doc()
    repo.get_returns[("u1", "c--00000001")] = doc
    svc = LearningProgressService(repo=repo)

    assert await svc.get_progress("u1", "c--00000001") is doc
    assert await svc.get_progress("u1", "c--missing") is None


# ── 默认 repo 构造 ────────────────────────────────────────────────────────


async def test_default_repo_is_real_learning_repo():
    """不注入 repo → 默认用真实 :class:`LearningRepo`（构造不触碰 Mongo）。"""
    svc = LearningProgressService()
    assert isinstance(svc._repo, LearningRepo)
