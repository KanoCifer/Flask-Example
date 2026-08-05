"""Service tests for ``app.services.translate.TranslateService``.

不触碰网络 / Redis / LLM：monkeypatch ``create_agent`` 返回 stub agent，
验证 ``translate`` 的 prompt 拼接、``tools=[]``（纯翻译不挂默认搜索工具）、
以及 ``output_schema`` 解析后的返回。
"""

from __future__ import annotations

import pytest

from app.core.llm_prompts import TRANSLATE_INSTRUCTIONS
from app.services.translate import TranslateResult, TranslateService

pytestmark = pytest.mark.asyncio(loop_scope="session")


class _StubRun:
    """模拟 agno ``arun`` 的返回值：output_schema 模式下 ``content`` 即解析结果。"""

    def __init__(self, content):
        self.content = content


class _StubAgent:
    def __init__(self):
        self.prompt = None
        self.output_schema = None

    async def arun(self, prompt, *, output_schema=None, **kwargs):
        self.prompt = prompt
        self.output_schema = output_schema
        return _StubRun(output_schema(text="你好，世界"))


async def test_translate_passes_prompt_and_disables_tools(monkeypatch):
    agent = _StubAgent()
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
