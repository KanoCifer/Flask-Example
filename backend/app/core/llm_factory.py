"""共享 LLM Agent 工厂 — 为 AiAgent 提供统一的 model / agent / db 创建。"""

from __future__ import annotations

from agno.agent import Agent
from agno.db.redis import RedisDb
from agno.models.openai import OpenAIChat
from agno.tools.websearch import WebSearchTools

from app.core.config import get_settings


def create_redis_db() -> RedisDb:
    """创建共享 RedisDb 实例。"""
    return RedisDb(db_url=get_settings().REDIS_URL)


def create_llm_model(
    model_id: str = "Ling-2.6-1T",
    *,
    temperature: float = 1,
    timeout: int = 60,
) -> OpenAIChat:
    """创建 OpenAILike 模型实例。

    注意：
    - role_map 强制 system 角色不走 developer 路线，避免 tbox.cn 等
      OpenAI-compatible provider 报 400 "developer role is not valid"。
    - reasoning 走 extra_body 而非 reasoning_effort，因为 reasoning_effort
      会触发 Agno 将 system prompt 改用 developer role（仅 o1/o3 原生支持）。
      AntLLM 的 Ring 模型接受 extra_body={"reasoning": {"effort": "high"}}。
    """
    extra_body = {"reasoning": {"effort": "high"}}

    return OpenAIChat(
        id=model_id,
        api_key=get_settings().API_KEY,
        base_url="https://api.ant-ling.com/v1",
        temperature=temperature,
        timeout=timeout,
        role_map={
            "system": "system",
            "user": "user",
            "assistant": "assistant",
            "tool": "tool",
            "model": "assistant",
        },
        extra_body=extra_body,
    )


def create_web_search_tools() -> WebSearchTools:
    """创建 WebSearchTools 实例。"""
    return WebSearchTools(backend="bing")


def create_agent(
    *,
    model: OpenAIChat,
    instructions: str,
    db: RedisDb,
    tools: list | None = None,
    **kwargs,
) -> Agent:
    """创建 Agno Agent 实例。"""
    return Agent(
        model=model,
        instructions=instructions,
        tools=tools or [create_web_search_tools()],
        db=db,
        markdown=True,
        add_history_to_context=True,
        num_history_runs=20,
        **kwargs,
    )
