"""共享 LLM Agent 工厂 — 为 AiAgent 提供统一的 model / agent / db 创建。"""

from __future__ import annotations

from agno.agent import Agent
from agno.db.redis import RedisDb
from agno.models.openai.like import OpenAILike
from agno.tools.websearch import WebSearchTools

from app.core.config import get_settings


def create_redis_db() -> RedisDb:
    """创建共享 RedisDb 实例。"""
    return RedisDb(db_url=get_settings().REDIS_URL)


def create_llm_model(
    model_id: str = "Ling-2.6-1T",
    *,
    temperature: float = 0.3,
    timeout: int = 60,
) -> OpenAILike:
    """创建 OpenAILike 模型实例。"""
    return OpenAILike(
        id=model_id,
        api_key=get_settings().API_KEY,
        base_url="https://api.tbox.cn/api/llm/v1",
        temperature=temperature,
        timeout=timeout,
    )


def create_web_search_tools() -> WebSearchTools:
    """创建 WebSearchTools 实例。"""
    return WebSearchTools(backend="bing")


def create_agent(
    *,
    model: OpenAILike,
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
        num_history_runs=10,
        **kwargs,
    )
