"""双通道 SSE 信封契约测试（task-185 / task-186）。

agent 层 yield ``{"type": "reasoning"|"content", "content": str}``
service 层透传为 ``{"type", "content", "is_end": bool}``

覆盖三条流：
- thread / summary
- thread / chat
- 天气分析

关键不变式：
1. 不再出现 dict repr / [object Object] 当正文（回归 str(chunk) bug）。
2. reasoning / content 两种 type 严格分流。
3. content 帧累加后仍能驱动钓鱼指数正则提取。
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.core.agent import AiAgent
from app.schemas.aiagent import WeatherAnalysisInput


# ── 通用 mocks ──────────────────────────────────────────────────────── #


def _make_db(sessions: list | None = None) -> MagicMock:
    db = MagicMock()
    db.get_sessions = MagicMock(return_value=sessions or [])
    return db


@pytest.fixture
def mock_factory(monkeypatch):
    """Patch llm_factory 的三个工厂函数。"""
    mocks = {
        "create_redis_db": MagicMock(return_value=_make_db()),
        "create_llm_model": MagicMock(return_value=MagicMock(name="FakeModel")),
        "create_agent": MagicMock(),
    }
    monkeypatch.setattr(
        "app.core.agent.create_redis_db", mocks["create_redis_db"]
    )
    monkeypatch.setattr(
        "app.core.agent.create_llm_model", mocks["create_llm_model"]
    )
    monkeypatch.setattr(
        "app.core.agent.create_agent", mocks["create_agent"]
    )
    return mocks


@pytest.fixture
def api_key_set(monkeypatch):
    """保证 get_settings().API_KEY 非空。"""
    ms = SimpleNamespace(
        API_KEY="test-key", REDIS_URL="redis://localhost:6379"
    )
    monkeypatch.setattr("app.core.agent.get_settings", lambda: ms)


def _attach_arun(mock_factory, arun_fn):
    """把 ``arun`` async generator 挂到 mock_agent 上。"""
    mock_factory["create_agent"].return_value.arun = arun_fn


# ── generate / summary 模式 ──────────────────────────────────────────── #


class TestSummaryEnvelope:
    @pytest.mark.asyncio
    async def test_summary_yields_content_envelopes(
        self, mock_factory, api_key_set
    ):
        from agno.run.agent import RunContentEvent

        async def _arun(*a, **kw):
            yield RunContentEvent(content="要点一")
            yield RunContentEvent(content="要点二")

        _attach_arun(mock_factory, _arun)
        agent = AiAgent(db=_make_db())

        chunks = []
        async for c in agent.generate(
            mode="summary",
            message="",
            user_id="u",
            session_id="",
            article_content="正文内容",
            article_title="标题",
        ):
            chunks.append(c)

        assert all(c.get("event") is None for c in chunks), (
            "旧 event 字段必须移除,仅保留 type/content 双通道"
        )
        assert [c["type"] for c in chunks] == ["content", "content"]
        assert [c["content"] for c in chunks] == ["要点一", "要点二"]

    @pytest.mark.asyncio
    async def test_summary_reasoning_and_content_split(
        self, mock_factory, api_key_set
    ):
        """推理/正文混在同一次流里应被分流为两种 type。"""
        from agno.run.agent import (
            ReasoningContentDeltaEvent,
            RunContentEvent,
        )

        async def _arun(*a, **kw):
            yield ReasoningContentDeltaEvent(reasoning_content="思考中...")
            yield RunContentEvent(content="")
            yield ReasoningContentDeltaEvent(reasoning_content="再想一下")
            yield RunContentEvent(content="结论：A")

        _attach_arun(mock_factory, _arun)
        agent = AiAgent(db=_make_db())

        chunks = []
        async for c in agent.generate(
            mode="summary",
            message="",
            user_id="u",
            session_id="",
            article_content="文章",
            article_title="标题",
        ):
            chunks.append(c)

        # 过滤掉空 content(空 content 帧不写入 envelope —— 见实现)
        nonempty = [c for c in chunks if c["content"]]
        assert [c["type"] for c in nonempty] == [
            "reasoning",
            "reasoning",
            "content",
        ]
        assert "".join(c["content"] for c in nonempty if c["type"] == "reasoning") == (
            "思考中...再想一下"
        )
        assert "".join(c["content"] for c in nonempty if c["type"] == "content") == (
            "结论：A"
        )


# ── generate / chat 模式 ────────────────────────────────────────────── #


class TestChatEnvelope:
    @pytest.mark.asyncio
    async def test_chat_no_bare_string(self, mock_factory, api_key_set):
        """回归保护:chat 分支不再 yield 裸字符串。"""
        from agno.run.agent import RunContentEvent

        async def _arun(*a, **kw):
            yield RunContentEvent(content="Hi")
            yield RunContentEvent(content="!")
            yield RunContentEvent(content="Reply")

        _attach_arun(mock_factory, _arun)
        agent = AiAgent(db=_make_db())

        chunks = []
        async for c in agent.generate(
            mode="chat",
            message="hello",
            user_id="u",
            session_id="s",
        ):
            chunks.append(c)

        assert len(chunks) == 3
        assert all(isinstance(c, dict) for c in chunks), (
            "chat 模式必须 yield dict,不能是 str(regression of task-186)"
        )
        assert all(c["type"] == "content" for c in chunks)
        assert [c["content"] for c in chunks] == ["Hi", "!", "Reply"]

    @pytest.mark.asyncio
    async def test_chat_reasoning_split(self, mock_factory, api_key_set):
        from agno.run.agent import (
            ReasoningContentDeltaEvent,
            RunContentEvent,
        )

        async def _arun(*a, **kw):
            yield ReasoningContentDeltaEvent(reasoning_content="分析中")
            yield RunContentEvent(content="答案")

        _attach_arun(mock_factory, _arun)
        agent = AiAgent(db=_make_db())

        chunks = []
        async for c in agent.generate(
            mode="chat",
            message="为什么",
            user_id="u",
            session_id="s",
        ):
            chunks.append(c)

        nonempty = [c for c in chunks if c["content"]]
        assert [c["type"] for c in nonempty] == ["reasoning", "content"]


# ── analyze_weather_stream ──────────────────────────────────────────── #


class TestWeatherEnvelope:
    @pytest.mark.asyncio
    async def test_weather_content_and_reasoning_split(
        self, mock_factory, api_key_set
    ):
        from agno.run.agent import (
            ReasoningContentDeltaEvent,
            RunContentEvent,
        )

        async def _arun(*a, **kw):
            yield ReasoningContentDeltaEvent(reasoning_content="看天气数据")
            yield RunContentEvent(content="今日天气：晴")
            yield RunContentEvent(content="最终钓鱼指数：88")

        _attach_arun(mock_factory, _arun)
        agent = AiAgent(db=_make_db())
        callback = MagicMock()
        weather_input = WeatherAnalysisInput(weather_data={})

        chunks = []
        async for c in agent.analyze_weather_stream(
            weather_data=weather_input, on_index_calculated=callback
        ):
            chunks.append(c)

        # 全部 dict 且有 type/content
        assert all(isinstance(c, dict) for c in chunks)
        assert all("event" not in c for c in chunks)

        nonempty = [c for c in chunks if c["content"]]
        assert [c["type"] for c in nonempty] == [
            "reasoning",
            "content",
            "content",
        ]

        # 钓鱼指数提取:buffer 累积的是 content 通道的拼接
        callback.assert_called_once()
        assert callback.call_args[0][1] == 88

    @pytest.mark.asyncio
    async def test_weather_index_no_double_buffer(
        self, mock_factory, api_key_set
    ):
        """连续多条 content delta 应拼接进 buffer(不再退化为空字符串)。"""
        from agno.run.agent import RunContentEvent

        async def _arun(*a, **kw):
            # 故意把"最终钓鱼指数：77"拆成三段连续 delta,
            # 验证 buffer 真的把三段拼起来正则才能命中。
            yield RunContentEvent(content="综合评分...")
            yield RunContentEvent(content="最终钓鱼指数：7")
            yield RunContentEvent(content="7")

        _attach_arun(mock_factory, _arun)
        agent = AiAgent(db=_make_db())
        callback = MagicMock()
        weather_input = WeatherAnalysisInput(weather_data={})

        async for _ in agent.analyze_weather_stream(
            weather_data=weather_input, on_index_calculated=callback
        ):
            pass

        callback.assert_called_once_with({}, 77)


# ── service 层：ai_service.thread_stream 去 str() bug 回归 ──────────── #


class TestAiServiceEnvelope:
    """确保 ai_service 把 agent 的 {type,content} 透传成 {type,content,is_end},
    不再对 dict 做 str() 得到 "[object Object]"。
    """

    @pytest.mark.asyncio
    async def test_thread_stream_passes_through_envelope(
        self, mock_factory, api_key_set
    ):
        from agno.run.agent import RunContentEvent

        async def _arun(*a, **kw):
            yield RunContentEvent(content="A")
            yield RunContentEvent(content="B")

        _attach_arun(mock_factory, _arun)

        from app.schemas.aiagent import ThreadRequest
        from app.services.ai_service import AiService

        agent = AiAgent(db=_make_db())
        svc = AiService(agent=agent)
        req = ThreadRequest(mode="summary", article_content="正文")

        frames = []
        async for f in svc.thread_stream(req, user_id="u"):
            frames.append(f)

        # 任何帧都不应包含 dict 的 repr
        for f in frames:
            assert "{" not in str(f["content"]), (
                "content 不应是 dict 的 repr,说明 str(chunk) bug 复发"
            )
            assert f.get("type") in ("reasoning", "content")
            assert isinstance(f["content"], str)
        # 末帧 is_end=True
        assert frames[-1]["is_end"] is True
        assert frames[-1]["content"] == ""
        # 至少一帧 is_end=False
        assert any(f["is_end"] is False for f in frames[:-1])

    @pytest.mark.asyncio
    async def test_thread_stream_error_envelope_keeps_type_content(
        self, mock_factory, api_key_set
    ):
        """ValueError / RuntimeError / Exception 三级错误信封语义保留。"""

        def _raise_valueerror(*a, **kw):
            raise ValueError("bad input")

        # 让 agent 直接抛 ValueError
        mock_factory["create_agent"].return_value.arun = _raise_valueerror

        from app.schemas.aiagent import ThreadRequest
        from app.services.ai_service import AiService

        agent = AiAgent(db=_make_db())
        svc = AiService(agent=agent)
        req = ThreadRequest(mode="chat", message="hi")

        frames = []
        async for f in svc.thread_stream(req, user_id="u"):
            frames.append(f)

        assert len(frames) == 1
        f = frames[0]
        assert f["type"] == "content"
        assert f["is_end"] is True
        assert f["content"].startswith("[ERROR]")
        assert "bad input" in f["content"]


# ── service 层：public_service.analyze_weather 去 dict-塞-content bug ── #


class TestPublicServiceEnvelope:
    @pytest.mark.asyncio
    async def test_analyze_weather_passes_through(
        self, mock_factory, api_key_set
    ):
        from agno.run.agent import RunContentEvent

        async def _arun(*a, **kw):
            yield RunContentEvent(content="天气晴")
            yield RunContentEvent(content="最终钓鱼指数：60")

        _attach_arun(mock_factory, _arun)

        # 构建不带 _on_index_calculated 依赖链的 PublicService:
        # 直接短路 save_ai_analysis_feedback,免得触达 Mongo。
        from app.services.public_service import PublicService

        agent = AiAgent(db=_make_db())
        # 不要走真实 _on_index_calculated:把它的副作用 stub 掉
        async def _ok_repo():
            return None
        agent._on_index_calculated_dummy = _ok_repo  # type: ignore[attr-defined]

        # 让 AiAgent.analyze_weather_stream 跳过 on_index_calculated callback
        # （在没有 callback 时本来就不会触发 Mongo 路径）。
        weather_input = WeatherAnalysisInput(weather_data={})

        svc = PublicService(
            repo=MagicMock(),
            gallery_repo=MagicMock(),
            ai_agent=agent,
        )

        frames = []
        async for f in svc.analyze_weather(weather_input):
            frames.append(f)

        # 不允许把整 dict 塞进 content
        for f in frames:
            assert "{" not in str(f["content"]), (
                "analyze_weather 不要再把 dict 塞进 content(regression of str(chunk) bug)"
            )
            assert f.get("type") == "content"
        # 末帧
        assert frames[-1]["is_end"] is True
        assert frames[-1]["content"] == ""
