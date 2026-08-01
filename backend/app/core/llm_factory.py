"""共享 LLM Agent 工厂 — 为 AiAgent 提供统一的 model / agent / db 创建。"""

from __future__ import annotations

from agno.agent import Agent
from agno.db.postgres import AsyncPostgresDb
from agno.models.base import Model
from agno.models.deepseek import DeepSeek
from agno.models.openai import OpenAIChat
from agno.tools.websearch import WebSearchTools

from app.core.config import get_settings


def create_postgres_db() -> AsyncPostgresDb:
    """创建共享 AsyncPostgresDb 实例。"""
    try:
        return AsyncPostgresDb(db_url=get_settings().LEARNING_DATABASE_URL)
    except Exception as exc:
        raise RuntimeError(f"Failed to create Redis DB: {exc!r}") from exc


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


# DeepSeek 模型 id 白名单（V4 系列）。deepseek-chat / deepseek-reasoner 已
# 弃用，不再允许直接传入，避免后续下线路由漂移。
_DEEPSEEK_MODEL_IDS = frozenset({"deepseek-v4-pro", "deepseek-v4-flash"})


def create_deepseek_model(
    model_id: str = "deepseek-v4-flash",
    *,
    timeout: int = 60,
    use_thinking: bool | None = None,
) -> DeepSeek:
    """创建 DeepSeek 模型实例（用于 Learning 模块）。

    与 AntLLM 的 ``create_llm_model`` 完全独立：
    - 不读 ``API_KEY``，只读 ``DEEPSEEK_API_KEY``；为空时立即抛
      :class:`RuntimeError`（部署期可一眼定位缺失配置）。
    - 走 agno 内置 ``agno.models.deepseek.DeepSeek``，自动按 JSON 模式处理
      structured output（DeepSeek 不支持原生 ``json_schema``，仅 ``json_object``）。
    - 默认 ``base_url=https://api.deepseek.com``；``thinking`` 由 ``use_thinking``
      显式控制：``None`` 用模型自身默认（v4-pro/v4-flash 开），``False`` 关闭。

    Args:
        model_id: 必须落在 :data:`_DEEPSEEK_MODEL_IDS` 白名单内。
        timeout: HTTP 超时秒数。
        use_thinking: 透传给 DeepSeek 的 ``use_thinking``。``None`` 走模型默认。

    Returns:
        已配置好 api_key / base_url / role_map 的 :class:`DeepSeek` 实例。

    Raises:
        RuntimeError: ``DEEPSEEK_API_KEY`` 未配置。
        ValueError: ``model_id`` 不在白名单内。
    """
    if model_id not in _DEEPSEEK_MODEL_IDS:
        raise ValueError(
            f"Unsupported DeepSeek model_id: {model_id!r}. "
            f"Allowed: {sorted(_DEEPSEEK_MODEL_IDS)}"
        )

    api_key = get_settings().DEEPSEEK_API_KEY
    if not api_key:
        raise RuntimeError(
            "AI 服务未配置 DEEPSEEK_API_KEY（Learning 模块依赖）"
        )

    return DeepSeek(
        id=model_id,
        api_key=api_key,
        reasoning_effort="high",
    )


def create_web_search_tools() -> WebSearchTools:
    """创建 WebSearchTools 实例。"""
    return WebSearchTools(backend="bing")


def create_agent(
    *,
    model: Model,
    instructions: str,
    db: AsyncPostgresDb,
    tools: list | None = None,
    **kwargs,
) -> Agent:
    """创建 Agno Agent 实例。

    ``model`` 接受任一 :class:`agno.models.base.Model` 子类 ——
    既支持原 AntLLM 路径下的 :class:`OpenAIChat`，也支持 Learning 模块
    新增的 :class:`DeepSeek`。调用方按需传入对应工厂产物即可。
    """
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
