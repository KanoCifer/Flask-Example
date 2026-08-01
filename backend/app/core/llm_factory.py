"""共享 LLM Agent 工厂 — 为 AiAgent 提供统一的 model / agent / db 创建。"""

from __future__ import annotations

from agno.agent import Agent
from agno.db.postgres import AsyncPostgresDb
from agno.models.base import Model
from agno.models.deepseek import DeepSeek
from agno.models.openai import OpenAIChat
from agno.tools.websearch import WebSearchTools

from app.core.config import get_settings
from app.core.llm_prompts import RESEARCH_INSTRUCTIONS_TEMPLATE


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
        base_url="https://api.deepseek.com",
        timeout=timeout,
        use_thinking=use_thinking,
        role_map={
            "system": "system",
            "user": "user",
            "assistant": "assistant",
            "tool": "tool",
            "model": "assistant",
        },
    )


def create_web_search_tools() -> WebSearchTools:
    """创建 WebSearchTools 实例。"""
    return WebSearchTools(backend="bing")


# ExaTools 的搜索/取内容/找相似/生成回答子工具集合。"all=True" 把
# ``search_exa`` / ``get_contents`` / ``find_similar`` / ``exa_answer`` 全部
# 打开；研究步骤需要"搜 + 抓正文 + 总结回答"全链路，少一个都拼不出可用的
# markdown 摘要。"show_results=True" 在服务端日志打印每轮搜索 query，便于
# 排查 LLM 是否把 sub-query 拆得合理。
_RESEARCH_TOOLS_KWARGS = {"all": True, "show_results": True}


def create_research_agent(
    topic: str,
    *,
    model: Model | None = None,
    db: AsyncPostgresDb | None = None,
) -> Agent:
    """创建主题研究 Agent（Learning 编排前调研一步专用）。

    与 :func:`create_agent` 同阶的 factory，但用途不同：

    - **复用** :func:`create_deepseek_model` 拿模型；允许调用方注入 ``model``
      覆盖（测试 / 切到 AntLLM 路径均可）。
    - **专属工具** :class:`agno.tools.exa.ExaTools`，全子工具打开，让 LLM
      能搜 / 取正文 / 找相似 / 给出基于源的总结回答。
    - **Session 持久化**：注入 ``db`` 则直接复用；否则走 :func:`create_redis_db`
      —— 调研一般跨多 sub-query，保留会话能让 LLM 回顾前几轮抓到的源。
    - **静默失败策略**：``EXA_API_KEY`` 为空字符串时直接抛
      :class:`RuntimeError`，与 :func:`create_deepseek_model` 对齐 —— 部署期
      一眼定位缺失配置，不静默退化返回"无证据"的研究结果。

    Args:
        topic: 研究主题。会被拼入 instructions 作为 LLM 的任务陈述。
        model: 可选模型覆盖；默认 :func:`create_deepseek_model`。
        db: 可选 RedisDb 覆盖；默认 :func:`create_redis_db`。

    Returns:
        已绑定 ExaTools + instructions 的 :class:`Agent`。工厂自身不持久化
        任何状态 —— 是否落库由调用方传入的 ``db`` 决定。

    Raises:
        RuntimeError: ``EXA_API_KEY`` 未配置；或 :func:`create_deepseek_model`
            转发的 ``DEEPSEEK_API_KEY`` 未配置。
    """
    api_key = get_settings().EXA_API_KEY
    if not api_key:
        raise RuntimeError(
            "AI 服务未配置 EXA_API_KEY（Learning 模块研究步骤依赖）"
        )

    from agno.tools.exa import ExaTools
    from agno.tools.mcp import MCPTools

    context7 = MCPTools(
        transport="streamable-http",
        url="https://mcp.context7.com/mcp",
    )
    exa_tools = ExaTools(api_key=api_key, **_RESEARCH_TOOLS_KWARGS)

    instructions = RESEARCH_INSTRUCTIONS_TEMPLATE.format(topic=topic)

    return Agent(
        model=model or create_deepseek_model(),
        instructions=instructions,
        tools=[exa_tools, context7],
        db=db or create_postgres_db(),
        markdown=True,
        add_history_to_context=True,
        num_history_runs=20,
    )


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
