"""Unit tests for the tool-call timing hook in ``app.core.llm_factory``.

- 同步 / 异步 ``function_call`` 都能被 :func:`_log_tool_call` 正确调用并透传
  结果（middleware 契约）。
- 断言 ``create_agent`` 默认把 hook 挂到 ``agent.tool_hooks``（全部 agent 经
  共享工厂创建，一处挂载全覆盖）。
- 不在此处断言日志文本——structlog 输出由 ``app.core.logger`` 配置决定，与
  测试环境 TTY / LOG_LEVEL 相关；结果透传即覆盖 hook 的行为契约。
"""

from __future__ import annotations

from agno.models.openai import OpenAIChat

from app.core.llm_factory import _log_tool_call, create_agent


async def test_log_tool_call_wraps_sync_function_call():
    def add(a: int, b: int) -> int:
        return a + b

    assert await _log_tool_call("add", add, {"a": 1, "b": 2}) == 3


async def test_log_tool_call_wraps_async_function_call():
    async def double(n: int) -> int:
        return n * 2

    assert await _log_tool_call("double", double, {"n": 21}) == 42


def test_create_agent_defaults_to_timing_hook():
    agent = create_agent(
        model=OpenAIChat(id="test", api_key="sk-test"),
        instructions="test",
        db=None,
        tools=None,
    )
    assert _log_tool_call in agent.tool_hooks


def test_create_agent_allows_opt_out_via_empty_list():
    agent = create_agent(
        model=OpenAIChat(id="test", api_key="sk-test"),
        instructions="test",
        db=None,
        tools=None,
        tool_hooks=[],
    )
    assert agent.tool_hooks == []
