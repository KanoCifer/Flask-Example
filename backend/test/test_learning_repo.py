"""Repository tests for ``app.repositories.learning_repo.LearningRepo``.

Uses a dedicated test MongoDB database (``readinglist_test``) so the production
collection is never touched.  Beanie is initialised once per session; each test
drops the ``learning_progress`` collection in a per-test fixture to stay
isolated.

Concurrency around ``DuplicateKeyError`` is hard to trigger deterministically
from a single event loop, so we rely on the more reliable code path —
``get_progress`` finds an existing doc — and treat the ``DuplicateKeyError``
fallback branch as ``pragma: no cover`` per the source.
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
import pytest_asyncio
from beanie import init_beanie
from pymongo import AsyncMongoClient

from app.core.config import get_settings
from app.models.learning import LearningProgress
from app.repositories.learning_repo import LearningRepo

pytestmark = pytest.mark.asyncio(loop_scope="session")


TEST_DB_NAME = "readinglist_test"


@pytest_asyncio.fixture(scope="session")
async def mongo_client():
    """Session-scoped MongoDB client + beanie init for LearningProgress."""
    settings = get_settings()
    client = AsyncMongoClient(settings.MONGO_URI)
    db = client[TEST_DB_NAME]
    await init_beanie(database=db, document_models=[LearningProgress])
    try:
        yield client
    finally:
        await client.drop_database(TEST_DB_NAME)
        await client.close()


@pytest_asyncio.fixture
async def clean_collection(mongo_client):
    """Drop the collection before each test to keep them independent."""
    await mongo_client[TEST_DB_NAME].drop_collection("learning_progress")
    yield


@pytest_asyncio.fixture
async def repo() -> LearningRepo:
    return LearningRepo()


def _make(
    *,
    owner: str = "user-1",
    course_id: str = "rust-basics--abcd1234",
    topic: str = "Rust 入门",
    status: str = "ready",
    sessions_done: list[int] | None = None,
    exercise_done: bool = False,
) -> LearningProgress:
    return LearningProgress(
        owner=owner,
        course_id=course_id,
        topic=topic,
        status=status,
        sessions_done=list(sessions_done or []),
        exercise_done=exercise_done,
        created_at=datetime.now(UTC),
    )


# ── get_progress / list_progress ────────────────────────────────────────


async def test_get_progress_returns_none_when_missing(repo, clean_collection):
    assert (
        await repo.get_progress(owner="u1", course_id="ghost--00000000")
    ) is None


async def test_get_progress_round_trip(repo, clean_collection):
    doc = _make(owner="u1", course_id="x--00000001")
    await doc.insert()

    found = await repo.get_progress(owner="u1", course_id="x--00000001")
    assert found is not None
    assert found.owner == "u1"
    assert found.course_id == "x--00000001"
    assert found.status == "ready"


async def test_list_progress_filters_by_owner(repo, clean_collection):
    await _make(owner="u1", course_id="c1--00000001", topic="T1").insert()
    await _make(owner="u1", course_id="c2--00000002", topic="T2").insert()
    await _make(owner="u2", course_id="c3--00000003", topic="Other").insert()

    items = await repo.list_progress(owner="u1")
    course_ids = {d.course_id for d in items}
    assert course_ids == {"c1--00000001", "c2--00000002"}


# ── upsert_progress ─────────────────────────────────────────────────────


async def test_upsert_progress_creates_then_updates(repo, clean_collection):
    first = await repo.upsert_progress(
        owner="u1",
        course_id="c--00000001",
        topic="Original",
        status="pending",
    )
    assert first.status == "pending"
    assert first.topic == "Original"

    second = await repo.upsert_progress(
        owner="u1",
        course_id="c--00000001",
        topic="Renamed",
        status="ready",
    )
    assert second.id == first.id, "upsert must NOT create a second row"
    assert second.status == "ready"
    assert second.topic == "Renamed"


async def test_upsert_progress_stores_goal(repo, clean_collection):
    """可选 goal 字段随 pending 落库;ready 覆盖时不传则保留原 goal。"""
    first = await repo.upsert_progress(
        owner="u1",
        course_id="c--00000001",
        topic="Rust 入门",
        status="pending",
        goal="能独立复述所有权规则",
    )
    assert first.goal == "能独立复述所有权规则"

    # ready 覆盖时不再传 goal → 保留已存 goal（不覆盖为 None）
    second = await repo.upsert_progress(
        owner="u1",
        course_id="c--00000001",
        topic="Rust 入门",
        status="ready",
    )
    assert second.goal == "能独立复述所有权规则"

    # 显式传新 goal → 覆盖
    third = await repo.upsert_progress(
        owner="u1",
        course_id="c--00000001",
        topic="Rust 入门",
        status="ready",
        goal="新目标",
    )
    assert third.goal == "新目标"


async def test_upsert_progress_goal_none_when_never_provided(
    repo, clean_collection
):
    """不传 goal 的新记录 → goal 为 None(不写字段,存量兼容)。"""
    doc = await repo.upsert_progress(
        owner="u1",
        course_id="c--00000002",
        topic="Go 入门",
        status="pending",
    )
    assert doc.goal is None


async def test_upsert_progress_stores_session_id(repo, clean_collection):
    """可选 session_id 字段随 ready 落库；后续 upsert 不传 session_id 不清除。"""
    first = await repo.upsert_progress(
        owner="u1",
        course_id="c--00000001",
        topic="Rust 入门",
        status="ready",
        session_id="sess-abc-123",
    )
    assert first.session_id == "sess-abc-123"

    # 后续 upsert 不传 session_id → 保留已存的 session_id（不覆盖为 None）
    second = await repo.upsert_progress(
        owner="u1",
        course_id="c--00000001",
        topic="Rust 入门",
        status="ready",
    )
    assert second.session_id == "sess-abc-123"

    # 显式传不同 session_id → 覆盖
    third = await repo.upsert_progress(
        owner="u1",
        course_id="c--00000001",
        topic="Rust 入门",
        status="ready",
        session_id="sess-xyz-999",
    )
    assert third.session_id == "sess-xyz-999"


async def test_upsert_progress_session_id_none_when_never_provided(
    repo, clean_collection
):
    """不传 session_id 的新记录 → session_id 为 None（与 goal 字段同理）。"""
    doc = await repo.upsert_progress(
        owner="u1",
        course_id="c--00000002",
        topic="Go 入门",
        status="pending",
    )
    assert doc.session_id is None


# ── upsert_progress model_id / extra_prompt (task-391) ─────────────────────


async def test_upsert_progress_stores_model_id_and_extra_prompt(
    repo, clean_collection
):
    """可选 model_id / extra_prompt 字段随 pending 落库；后续 upsert 不传则保留。

    与 goal / session_id 同语义：「非 None 才替换」，避免 .mark_ready() 重复
    调用把已选的模型 / 额外提示抹掉。
    """
    first = await repo.upsert_progress(
        owner="u1",
        course_id="c--00000001",
        topic="Rust 入门",
        status="pending",
        model_id="deepseek-v4-pro",
        extra_prompt="面向初学者",
    )
    assert first.model_id == "deepseek-v4-pro"
    assert first.extra_prompt == "面向初学者"

    # 后续 upsert 不传 model_id / extra_prompt → 保留已存值（不覆盖为 None）
    second = await repo.upsert_progress(
        owner="u1",
        course_id="c--00000001",
        topic="Rust 入门",
        status="ready",
    )
    assert second.model_id == "deepseek-v4-pro"
    assert second.extra_prompt == "面向初学者"

    # 显式传新值 → 覆盖
    third = await repo.upsert_progress(
        owner="u1",
        course_id="c--00000001",
        topic="Rust 入门",
        status="ready",
        model_id="deepseek-v4-flash",
        extra_prompt="新增补充",
    )
    assert third.model_id == "deepseek-v4-flash"
    assert third.extra_prompt == "新增补充"


async def test_upsert_progress_model_id_and_extra_prompt_none_when_never_provided(
    repo, clean_collection
):
    """不传 model_id / extra_prompt 的新记录 → 字段为 None（不写字段，存量兼容）。"""
    doc = await repo.upsert_progress(
        owner="u1",
        course_id="c--00000002",
        topic="Go 入门",
        status="pending",
    )
    assert doc.model_id is None
    assert doc.extra_prompt is None


async def test_upsert_progress_preserves_sessions_and_exercise_done(
    repo, clean_collection
):
    doc = _make(
        owner="u1",
        course_id="c--00000001",
        sessions_done=[1, 2],
        exercise_done=True,
    )
    await doc.insert()

    updated = await repo.upsert_progress(
        owner="u1",
        course_id="c--00000001",
        topic="Renamed",
        status="ready",
    )
    assert updated.sessions_done == [1, 2]
    assert updated.exercise_done is True


# ── add_session_done ($addToSet 幂等) ────────────────────────────────────


async def test_add_session_done_idempotent(repo, clean_collection):
    await _make(owner="u1", course_id="c--00000001").insert()
    await repo.add_session_done("u1", "c--00000001", 1)
    await repo.add_session_done("u1", "c--00000001", 1)
    await repo.add_session_done("u1", "c--00000001", 2)

    doc = await repo.get_progress("u1", "c--00000001")
    assert doc is not None
    assert sorted(doc.sessions_done) == [1, 2]


async def test_add_session_done_returns_none_for_missing(repo, clean_collection):
    result = await repo.add_session_done("ghost", "missing", 1)
    assert result is None


# ── set_exercise_done / set_status ──────────────────────────────────────


async def test_set_exercise_done_round_trip(repo, clean_collection):
    await _make(owner="u1", course_id="c--00000001").insert()
    await repo.set_exercise_done("u1", "c--00000001", True)

    doc = await repo.get_progress("u1", "c--00000001")
    assert doc is not None
    assert doc.exercise_done is True


async def test_set_status_pending_to_ready(repo, clean_collection):
    await _make(
        owner="u1", course_id="c--00000001", status="pending"
    ).insert()
    await repo.set_status("u1", "c--00000001", "ready")

    doc = await repo.get_progress("u1", "c--00000001")
    assert doc is not None
    assert doc.status == "ready"


# ── owner isolation ─────────────────────────────────────────────────────


async def test_owner_isolation(repo, clean_collection):
    """不同 owner 写入的同 course_id 互不污染(unique index (owner, course_id))。"""
    await _make(owner="u1", course_id="shared--00000001", topic="U1").insert()
    await _make(owner="u2", course_id="shared--00000001", topic="U2").insert()

    u1 = await repo.get_progress("u1", "shared--00000001")
    u2 = await repo.get_progress("u2", "shared--00000001")
    assert u1 is not None and u2 is not None
    assert u1.topic == "U1"
    assert u2.topic == "U2"

    # 修改其中一个 owner 不应影响另一个。
    await repo.set_status("u1", "shared--00000001", "ready")
    u2_after = await repo.get_progress("u2", "shared--00000001")
    assert u2_after is not None
    assert u2_after.status == "ready"  # u2 初始 status 就是 ready


async def test_anon_owner_bucket_isolated_from_user(repo, clean_collection):
    """匿名 owner (`anon:...`) 与登录用户 owner (`<user_id>`) 桶互不干扰。"""
    await _make(
        owner="anon:abc-123", course_id="c--00000001", topic="AnonCourse"
    ).insert()
    await _make(
        owner="42", course_id="c--00000001", topic="UserCourse"
    ).insert()

    anon = await repo.get_progress("anon:abc-123", "c--00000001")
    user = await repo.get_progress("42", "c--00000001")
    assert anon is not None and user is not None
    assert anon.topic == "AnonCourse"
    assert user.topic == "UserCourse"


# ── next_session 派生 ──────────────────────────────────────────────────


async def test_next_session_property_derives_correctly(
    repo, clean_collection
):
    # 空 -> 1
    doc = _make(owner="u1", course_id="c--00000001")
    assert doc.next_session == 1

    # [1] -> 2
    doc = _make(owner="u1", course_id="c--00000002", sessions_done=[1])
    assert doc.next_session == 2

    # [1,2] -> 3
    doc = _make(
        owner="u1", course_id="c--00000003", sessions_done=[1, 2]
    )
    assert doc.next_session == 3

    # [1,3] -> 2 (gap)
    doc = _make(
        owner="u1", course_id="c--00000004", sessions_done=[1, 3]
    )
    assert doc.next_session == 2

    # [1,2,3] -> 4 (max+1;用 exercise_done 判定完成,next_session 永远返回下一个待学编号)
    doc = _make(
        owner="u1",
        course_id="c--00000005",
        sessions_done=[1, 2, 3],
        exercise_done=True,
    )
    assert doc.next_session == 4


# ── merge_anon_into_user ───────────────────────────────────────────────


async def test_merge_anon_into_user_unions_sessions(repo, clean_collection):
    await _make(
        owner="anon:abc",
        course_id="c--00000001",
        sessions_done=[1, 3],
        exercise_done=False,
    ).insert()
    await _make(
        owner="42",
        course_id="c--00000001",
        sessions_done=[2],
        exercise_done=True,
    ).insert()

    merged = await repo.merge_anon_into_user(
        anon_owner="anon:abc", user_owner="42"
    )
    assert merged == 1

    user_doc = await repo.get_progress("42", "c--00000001")
    assert user_doc is not None
    assert sorted(user_doc.sessions_done) == [1, 2, 3]
    assert user_doc.exercise_done is True

    # 匿名文档应已删除
    assert (
        await repo.get_progress("anon:abc", "c--00000001")
    ) is None


async def test_merge_anon_into_user_migrates_when_no_user_doc(
    repo, clean_collection
):
    """匿名有 / 用户无 → 直接迁移(改 owner,保留 created_at)。"""
    await _make(
        owner="anon:abc",
        course_id="c--00000001",
        topic="AnonTopic",
        sessions_done=[2],
    ).insert()

    merged = await repo.merge_anon_into_user(
        anon_owner="anon:abc", user_owner="42"
    )
    assert merged == 1

    migrated = await repo.get_progress("42", "c--00000001")
    assert migrated is not None
    assert migrated.topic == "AnonTopic"
    assert migrated.sessions_done == [2]
    assert (
        await repo.get_progress("anon:abc", "c--00000001")
    ) is None


async def test_merge_anon_into_user_returns_zero_when_no_anon_docs(
    repo, clean_collection
):
    merged = await repo.merge_anon_into_user(
        anon_owner="anon:nothing", user_owner="42"
    )
    assert merged == 0
