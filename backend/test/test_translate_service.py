"""Service tests for ``app.services.translate.TranslateService``.

不触碰网络 / Redis / LLM：monkeypatch ``create_agent`` 返回 stub agent，
验证 ``translate`` 的 prompt 拼接、``tools=[]``（纯翻译不挂默认搜索工具）、
``use_json_mode`` + ``output_schema`` 解析后的结构化返回、以及 token 消耗
的 usage 解析与 ``record_llm_usage`` 落库调用。
"""

from __future__ import annotations

import pytest

from app.core.llm_prompts import TRANSLATE_INSTRUCTIONS
from app.schemas.translate import TranslateResult
from app.services.translate import TranslateService

pytestmark = pytest.mark.asyncio(loop_scope="session")


class _StubMetrics:
    """模拟 agno ``RunMetrics``：token 三件套 + duration（秒）。"""

    input_tokens = 10
    output_tokens = 20
    total_tokens = 30
    duration = 0.5


class _StubMetricsNoDuration:
    """duration 缺失（网关不返回耗时）时，``duration_ms`` 应为 None。"""

    input_tokens = 10
    output_tokens = 20
    total_tokens = 30
    duration = None


class _StubRun:
    """模拟 agno ``arun`` 的返回值：output_schema 模式下 ``content`` 即解析结果。"""

    def __init__(self, content, metrics=None):
        self.content = content
        self.metrics = metrics


class _StubAgent:
    def __init__(self, metrics=None):
        self.prompt = None
        self.output_schema = None
        self.metrics = metrics

    async def arun(self, prompt, *, output_schema=None, **kwargs):
        self.prompt = prompt
        self.output_schema = output_schema
        return _StubRun(output_schema(text="你好，世界"), self.metrics)


class _FakeModel:
    id = "Ling-2.6-1T"


async def test_translate_passes_prompt_and_disables_tools(monkeypatch):
    agent = _StubAgent(metrics=None)
    captured: dict = {}

    def _fake_create_agent(*, model, instructions, db=None, tools=None, **kwargs):
        captured["instructions"] = instructions
        captured["tools"] = tools
        return agent

    monkeypatch.setattr("app.services.translate.create_agent", _fake_create_agent)

    result = await TranslateService(model=object()).translate("hello world", "中文")

    assert result == TranslateResult(text="你好，世界")
    assert agent.prompt == "目标语言：中文\n\nhello world"
    assert agent.output_schema is TranslateResult
    assert captured["tools"] == []
    assert captured["instructions"] == TRANSLATE_INSTRUCTIONS


async def test_translate_parses_usage_and_records_usage(monkeypatch):
    agent = _StubAgent(metrics=_StubMetrics())
    captured: dict = {}

    def _fake_create_agent(*, model, instructions, db=None, tools=None, **kwargs):
        return agent

    async def _fake_record_llm_usage(**kwargs):
        captured.update(kwargs)

    monkeypatch.setattr("app.services.translate.create_agent", _fake_create_agent)
    monkeypatch.setattr(
        "app.services.translate.record_llm_usage", _fake_record_llm_usage
    )

    result = await TranslateService(model=_FakeModel()).translate(
        "hello world", "中文", user_id=7
    )

    # usage 随结果返回
    assert result.usage is not None
    assert result.usage.model == "Ling-2.6-1T"
    assert result.usage.input_tokens == 10
    assert result.usage.output_tokens == 20
    assert result.usage.total_tokens == 30
    assert result.usage.duration_ms == 500  # 0.5s → 500ms

    # record_llm_usage 落库参数
    assert captured["source"] == "translate"
    assert captured["model"] == "Ling-2.6-1T"
    assert captured["input_tokens"] == 10
    assert captured["output_tokens"] == 20
    assert captured["total_tokens"] == 30
    assert captured["user_id"] == 7
    assert captured["duration_ms"] == 500
    assert captured["meta"] == {"target_lang": "中文", "text_len": 11}


async def test_translate_without_duration_metrics_duration_ms_none(monkeypatch):
    agent = _StubAgent(metrics=_StubMetricsNoDuration())
    captured: dict = {}

    def _fake_create_agent(*, model, instructions, db=None, tools=None, **kwargs):
        return agent

    async def _fake_record_llm_usage(**kwargs):
        captured.update(kwargs)

    monkeypatch.setattr("app.services.translate.create_agent", _fake_create_agent)
    monkeypatch.setattr(
        "app.services.translate.record_llm_usage", _fake_record_llm_usage
    )

    result = await TranslateService(model=_FakeModel()).translate(
        "hello world", "中文"
    )

    assert result.usage is not None
    assert result.usage.duration_ms is None
    assert captured["duration_ms"] is None


async def test_translate_without_metrics_returns_no_usage(monkeypatch):
    agent = _StubAgent(metrics=None)
    called = False

    def _fake_create_agent(*, model, instructions, db=None, tools=None, **kwargs):
        return agent

    async def _fake_record_llm_usage(**kwargs):
        nonlocal called
        called = True

    monkeypatch.setattr("app.services.translate.create_agent", _fake_create_agent)
    monkeypatch.setattr(
        "app.services.translate.record_llm_usage", _fake_record_llm_usage
    )

    # metrics 缺失（如 stub / 网关不返回 usage）时：翻译正常、usage 兜底、不落库
    result = await TranslateService(model=object()).translate("hello world", "中文")

    assert result.text == "你好，世界"
    assert result.usage is None
    assert called is False
