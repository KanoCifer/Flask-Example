"""AiAgent 单元测试 — 验证外部契约，mock 掉 llm_factory 与 RedisDb。

统一 SSE 信封（task-185 / task-186）：
    - agent 层 yield ``{"type": "reasoning"|"content", "content": str}``
    - service 层透传为 ``{"type", "content", "is_end"}``
"""

from __future__ import annotations

import asyncio
import sys
import types
from collections.abc import AsyncIterator
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.core.agent import AiAgent
from app.schemas.aiagent import WeatherAnalysisInput


# ── Helpers ────────────────────────────────────────────────────────── #


def _make_async_gen(chunks: list[str]):
    """返回一个 async generator 函数，产出真实的 RunContentEvent。"""
    from agno.run.agent import RunContentEvent

    async def _arun(*args, **kwargs):
        for c in chunks:
            yield RunContentEvent(content=c)

    return _arun


def _make_agent(arun_chunks: list[str] | None = None) -> MagicMock:
    """创建 mock agent，arun 是 async generator 函数。"""
    if arun_chunks is None:
        arun_chunks = ["chunk1", "chunk2", "最终钓鱼指数：75"]
    agent = MagicMock()
    agent.arun = _make_async_gen(arun_chunks)
    return agent


def _make_model() -> MagicMock:
    return MagicMock(name="FakeModel")


def _make_db(sessions: list | None = None) -> MagicMock:
    db = MagicMock()
    db.get_sessions = MagicMock(return_value=sessions or [])
    return db


def _content_frames(texts: list[str]) -> list[dict]:
    """把裸字符串列表转成新信封的 content 帧(便于断言)。"""
    return [{"type": "content", "content": t} for t in texts]  # type: ignore[list-item]  # noqa: E501


@pytest.fixture
def mock_factory(monkeypatch) -> dict[str, MagicMock]:
    """Patch llm_factory 的三个创建函数，返回 mock 引用供断言。"""
    mocks = {
        "create_redis_db": MagicMock(return_value=_make_db()),
        "create_llm_model": MagicMock(return_value=_make_model()),
        "create_agent": MagicMock(return_value=_make_agent()),
    }
    monkeypatch.setattr("app.core.agent.create_redis_db", mocks["create_redis_db"])
    monkeypatch.setattr("app.core.agent.create_llm_model", mocks["create_llm_model"])
    monkeypatch.setattr("app.core.agent.create_agent", mocks["create_agent"])
    return mocks


@pytest.fixture
def api_key_set(monkeypatch) -> None:
    """确保 get_settings().API_KEY 非空，避免 RuntimeError。"""
    mock_settings = SimpleNamespace(API_KEY="test-key", REDIS_URL="redis://localhost:6379")
    monkeypatch.setattr("app.core.agent.get_settings", lambda: mock_settings)


# ── 初始化 ─────────────────────────────────────────────────────────── #


class TestInit:
    def test_uses_create_redis_db_when_no_db_provided(self, mock_factory):
        AiAgent()
        mock_factory["create_redis_db"].assert_called_once()

    def test_uses_provided_db_directly(self, mock_factory):
        db = _make_db()
        agent = AiAgent(db=db)
        mock_factory["create_redis_db"].assert_not_called()
        assert agent._db is db

    def test_default_weights_build_prompt(self, mock_factory):
        agent = AiAgent()
        assert "w1_temp=" in agent._weather_system_prompt

    def test_custom_weights_override(self, mock_factory):
        custom = {f"w{i}": 0.1 for i in range(1, 10)}
        agent = AiAgent(expert_weights=custom)
        assert "w1_temp=0.1000" in agent._weather_system_prompt


# ── generate (summary mode) ────────────────────────────────────────── #


class TestGenerateSummary:
    @pytest.mark.asyncio
    async def test_normal_flow(self, mock_factory, api_key_set):
        agent = AiAgent(db=_make_db())
        chunks = []
        async for chunk in agent.generate(
            mode="summary",
            message="",
            user_id="user-1",
            session_id="",
            article_content="这是一篇测试文章",
            article_title="标题",
        ):
            chunks.append(chunk)
        # 新信封:content 通道的统一 dict 形态
        assert chunks == _content_frames(
            ["chunk1", "chunk2", "最终钓鱼指数：75"]
        )
        mock_factory["create_agent"].assert_called_once()
        mock_factory["create_llm_model"].assert_called_once()

    @pytest.mark.asyncio
    async def test_resolves_model_by_name(self, mock_factory, api_key_set):
        agent = AiAgent(db=_make_db())
        async for _ in agent.generate(
            mode="summary",
            message="",
            user_id="u",
            session_id="",
            article_content="test",
            model_name="Ling 2.6",
        ):
            pass
        mock_factory["create_llm_model"].assert_called_once_with(
            model_id="Ling-2.6-1T"
        )

    @pytest.mark.asyncio
    async def test_raises_valueerror_on_empty_content(
        self, mock_factory, api_key_set
    ):
        agent = AiAgent(db=_make_db())
        with pytest.raises(ValueError, match="文章内容不能为空"):
            async for _ in agent.generate(
                mode="summary",
                message="",
                user_id="u",
                session_id="",
                article_content="   ",
            ):
                pass

    @pytest.mark.asyncio
    async def test_raises_runtimeerror_without_api_key(self, mock_factory, monkeypatch):
        monkeypatch.setattr(
            "app.core.agent.get_settings",
            lambda: SimpleNamespace(API_KEY=""),
        )
        agent = AiAgent(db=_make_db())
        with pytest.raises(RuntimeError, match="API_KEY"):
            async for _ in agent.generate(
                mode="summary",
                message="",
                user_id="u",
                session_id="",
                article_content="test",
            ):
                pass

    @pytest.mark.asyncio
    async def test_raises_on_unknown_model(self, mock_factory, api_key_set):
        agent = AiAgent(db=_make_db())
        with pytest.raises(ValueError, match="Unsupported model"):
            async for _ in agent.generate(
                mode="summary",
                message="",
                user_id="u",
                session_id="",
                article_content="test",
                model_name="Unknown",
            ):
                pass


# ── generate (chat mode) ───────────────────────────────────────────── #


class TestGenerateChat:
    @pytest.mark.asyncio
    async def test_normal_flow(self, mock_factory, api_key_set):
        agent = AiAgent(db=_make_db())
        chunks = []
        async for chunk in agent.generate(
            mode="chat",
            message="什么是 async？",
            user_id="u",
            session_id="sess-1",
        ):
            chunks.append(chunk)
        # chat 分支现在也 yield dict(不再裸字符串),3 帧均为 content 通道
        assert len(chunks) == 3
        assert all(c["type"] == "content" for c in chunks)
        assert all(isinstance(c["content"], str) for c in chunks)
        mock_factory["create_agent"].assert_called_once()

    @pytest.mark.asyncio
    async def test_raises_valueerror_on_empty_message(
        self, mock_factory, api_key_set
    ):
        agent = AiAgent(db=_make_db())
        with pytest.raises(ValueError, match="消息不能为空"):
            async for _ in agent.generate(
                mode="chat",
                message="  ",
                user_id="u",
                session_id="s",
            ):
                pass

    @pytest.mark.asyncio
    async def test_includes_article_context_when_provided(
        self, mock_factory, api_key_set
    ):
        """验证 chat 模式在传入文章上下文时，arun 收到包含上下文的输入。"""
        from agno.run.agent import RunContentEvent

        captured = {}

        async def _capturing_arun(*args, **kwargs):
            captured["input"] = args[0] if args else kwargs.get("input", "")
            yield RunContentEvent(content="reply")

        mock_factory["create_agent"].return_value.arun = _capturing_arun
        agent = AiAgent(db=_make_db())
        async for _ in agent.generate(
            mode="chat",
            message="test",
            user_id="u",
            session_id="s",
            article_content="<p>正文</p>",
            article_title="文章",
        ):
            pass
        assert "文章上下文" in captured["input"]
        assert "正文" in captured["input"]

    @pytest.mark.asyncio
    async def test_raises_on_unsupported_mode(self, mock_factory, api_key_set):
        agent = AiAgent(db=_make_db())
        with pytest.raises(ValueError, match="Unsupported mode"):
            async for _ in agent.generate(
                mode="bogus",
                message="test",
                user_id="u",
                session_id="s",
            ):
                pass


# ── analyze_weather_stream ─────────────────────────────────────────── #


class TestAnalyzeWeather:
    @pytest.mark.asyncio
    async def test_index_extraction_success(self, mock_factory, api_key_set):
        agent = AiAgent(db=_make_db())
        callback = MagicMock()
        weather_input = WeatherAnalysisInput(weather_data={"liveWeather": {"temp": 20}})

        chunks = []
        async for chunk in agent.analyze_weather_stream(
            weather_data=weather_input, on_index_calculated=callback
        ):
            chunks.append(chunk)

        # 抽取 content 通道的拼接串,验证钓鱼指数正则能匹配
        concat = "".join(
            c["content"] for c in chunks if c["type"] == "content"
        )
        assert "最终钓鱼指数" in concat
        assert "75" in concat
        callback.assert_called_once()
        # 回调参数: (weather_data_dict, ai_score)
        call_args = callback.call_args[0]
        assert call_args[0] == {"liveWeather": {"temp": 20}}
        assert call_args[1] == 75

    @pytest.mark.asyncio
    async def test_index_extraction_failure_no_callback(
        self, mock_factory, api_key_set
    ):
        """输出中无指数时，不调用回调，也不报错。"""

        from agno.run.agent import RunContentEvent

        async def _no_index_arun(*args, **kwargs):
            yield RunContentEvent(content="今天天气不错，适合钓鱼。")

        mock_factory["create_agent"].return_value.arun = _no_index_arun
        agent = AiAgent(db=_make_db())
        callback = MagicMock()
        weather_input = WeatherAnalysisInput(weather_data={})

        chunks = []
        async for chunk in agent.analyze_weather_stream(
            weather_data=weather_input, on_index_calculated=callback
        ):
            chunks.append(chunk)

        # 信封化:content 通道,正文累加进 buffer,但因无指数不会触发回调
        assert chunks == _content_frames(
            ["今天天气不错，适合钓鱼。"]
        )
        callback.assert_not_called()

    @pytest.mark.asyncio
    async def test_uses_default_model_without_model_id(
        self, mock_factory, api_key_set
    ):
        agent = AiAgent(db=_make_db())
        weather_input = WeatherAnalysisInput(weather_data={})
        async for _ in agent.analyze_weather_stream(weather_data=weather_input):
            pass
        mock_factory["create_llm_model"].assert_called_once_with(
            model_id="Ling-2.6-1T", temperature=1, timeout=30
        )

    @pytest.mark.asyncio
    async def test_uses_custom_model_id(self, mock_factory, api_key_set):
        agent = AiAgent(db=_make_db())
        weather_input = WeatherAnalysisInput(weather_data={})
        async for _ in agent.analyze_weather_stream(
            weather_data=weather_input, model_id="Ling-3.0-flash"
        ):
            pass
        mock_factory["create_llm_model"].assert_called_once_with(
            model_id="Ling-3.0-flash", temperature=1, timeout=30
        )


# ── get_cached_summary ─────────────────────────────────────────────── #


# ── 内部方法 ───────────────────────────────────────────────────────── #


class TestInternal:
    def test_normalize_content_strips_html(self, mock_factory):
        agent = AiAgent(db=_make_db())
        result = agent._normalize_content("<p>Hello</p> <b>World</b>")
        assert result == "Hello World"

    def test_normalize_content_truncates(self, mock_factory):
        agent = AiAgent(db=_make_db())
        long = "x" * 200_000
        result = agent._normalize_content(long)
        assert len(result) == 128_000

    def test_hash_article_deterministic(self, mock_factory):
        agent = AiAgent(db=_make_db())
        h1 = agent._hash_article("title", "content")
        h2 = agent._hash_article("title", "content")
        assert h1 == h2
        assert len(h1) == 16

    def test_article_session_id_format(self, mock_factory):
        agent = AiAgent(db=_make_db())
        sid = agent._article_session_id("user-1", "abc123", "summary")
        assert sid == "summary:user-1:abc123"

