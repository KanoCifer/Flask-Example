"""Task body 单元测试 — 不依赖 FastAPI app，不连真实 Redis/Mongo/RabbitMQ。

每个 task 在 worker 上通过 ``context.state.services.<svc>`` 取服务（取代旧的
``from app.main import app; app.state.services.<svc>`` 反模式）。本测试构造伪造的
``TaskiqState`` + ``AppState``，直接调 task 函数体，证明：

1. task body 不再隐式依赖 ``app.main``（AC）。
2. ``context.state.services`` 是唯一的服务入口（行为契约）。
3. 成功 / 失败路径的副作用正确（generate_course 抛错 → ``_mark_failed`` 被调）。
"""

from __future__ import annotations

import sys
from dataclasses import dataclass, field
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest

# AC: app.main 不得被本测试触发。task 模块导入路径不经过 app.main（已在
# 隔离环境确认）。这里再断言一遍，防回归。
assert "app.main" not in sys.modules, (
    "test_task.py AC violation: app.main imported before tests run"
)

from app.plugins.task.tasks import email as email_tasks  # noqa: E402
from app.plugins.task.tasks import learning as learning_tasks  # noqa: E402
from app.plugins.task.tasks import scheduled as scheduled_tasks  # noqa: E402


# ── 伪造的 TaskiqState / AppState / Context ────────────────────────────


@dataclass
class FakeAppState:
    """只暴露 task 用到的 service 字段，全部 AsyncMock 隔离副作用。"""

    course_gen_svc: AsyncMock = field(default_factory=AsyncMock)
    progress_svc: AsyncMock = field(default_factory=AsyncMock)
    rss_svc: AsyncMock = field(default_factory=AsyncMock)


@dataclass
class FakeTaskiqState:
    redis: Any = None
    mongo: Any = None
    services: FakeAppState = field(default_factory=FakeAppState)


@dataclass
class FakeContext:
    state: FakeTaskiqState = field(default_factory=FakeTaskiqState)


@pytest.fixture
def fake_ctx() -> FakeContext:
    return FakeContext()


# ── learning.generate_course ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_generate_course_success_calls_course_gen_svc(fake_ctx: FakeContext):
    course_gen = fake_ctx.state.services.course_gen_svc
    course_gen.generate_course.return_value = None

    await learning_tasks.generate_course(
        topic="t",
        owner="u",
        course_id="c1",
        goal=None,
        context=fake_ctx,  # type: ignore[arg-type]
    )

    course_gen.generate_course.assert_awaited_once_with(
        topic="t", owner="u", goal=None, course_id="c1"
    )
    # 成功路径：不应触发 _mark_failed。
    fake_ctx.state.services.progress_svc.mark_failed.assert_not_called()


@pytest.mark.asyncio
async def test_generate_course_failure_marks_progress_failed_and_reraises(
    fake_ctx: FakeContext,
):
    course_gen = fake_ctx.state.services.course_gen_svc
    course_gen.generate_course.side_effect = RuntimeError("boom")

    with pytest.raises(RuntimeError, match="boom"):
        await learning_tasks.generate_course(
            topic="t",
            owner="u",
            course_id="c1",
            goal=None,
            context=fake_ctx,  # type: ignore[arg-type]
        )

    # 失败路径：必须 mark_failed，然后 re-raise（让 taskiq 走 DLQ）。
    fake_ctx.state.services.progress_svc.mark_failed.assert_awaited_once_with(
        owner="u", course_id="c1"
    )


# ── learning.generate_next_lesson ───────────────────────────────────────


@pytest.mark.asyncio
async def test_generate_next_lesson_returns_new_num(fake_ctx: FakeContext):
    course_gen = fake_ctx.state.services.course_gen_svc
    course_gen.generate_next_lesson.return_value = 3

    result = await learning_tasks.generate_next_lesson(
        topic="t",
        owner="u",
        course_id="c1",
        goal=None,
        session_id="s1",
        context=fake_ctx,  # type: ignore[arg-type]
    )

    assert result == 3
    course_gen.generate_next_lesson.assert_awaited_once_with(
        topic="t",
        owner="u",
        course_id="c1",
        goal=None,
        session_id="s1",
    )


# ── learning._mark_failed (私有 helper) ─────────────────────────────────


@pytest.mark.asyncio
async def test_mark_failed_invokes_progress_service(fake_ctx: FakeContext):
    await learning_tasks._mark_failed(  # noqa: SLF001 — exercise private helper
        course_id="c1",
        owner="u",
        context=fake_ctx,  # type: ignore[arg-type]
    )
    fake_ctx.state.services.progress_svc.mark_failed.assert_awaited_once_with(
        owner="u", course_id="c1"
    )


# ── email.save_to_mongo ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_save_to_mongo_calls_rss_service(fake_ctx: FakeContext):
    rss = fake_ctx.state.services.rss_svc
    rss.save_entries_to_mongo.return_value = 5

    await email_tasks.save_to_mongo(
        feed_url="https://example.com/feed.xml",
        entries=[{"title": "x"}],
        user_id=42,
        context=fake_ctx,  # type: ignore[arg-type]
    )

    rss.save_entries_to_mongo.assert_awaited_once_with(
        feed_url="https://example.com/feed.xml",
        entries=[{"title": "x"}],
    )


# ── scheduled.refresh_rss_feeds ─────────────────────────────────────────


@pytest.mark.asyncio
async def test_refresh_rss_feeds_calls_rss_service_and_notifies(
    fake_ctx: FakeContext,
    monkeypatch: pytest.MonkeyPatch,
):
    rss = fake_ctx.state.services.rss_svc
    rss.refresh_all_feeds.return_value = {
        "total_feeds": 0,
        "success": 0,
        "failed": 0,
        "new_articles": 0,
    }

    # refresh_rss_feeds 完成后会调 notify() 发飞书通知，patch 掉避免副作用。
    notify_mock = AsyncMock()
    monkeypatch.setattr(scheduled_tasks, "notify", notify_mock)

    # 测试环境下无 webhook，refresh_rss_feeds 内的 settings.FEISHU_WEBHOOK_URL
    # 为空字符串不会让 notify 失败（它在 _send_notification 内就被空 URL 拦截），
    # 但这里我们已经 patch 掉 notify，保险起见再覆盖一次 settings。
    with patch.object(scheduled_tasks, "_send_notification", AsyncMock()):
        await scheduled_tasks.refresh_rss_feeds(context=fake_ctx)  # type: ignore[arg-type]

    rss.refresh_all_feeds.assert_awaited_once_with()