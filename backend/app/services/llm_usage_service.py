"""LLM usage 记录 —— 共享写库 helper。

仿 ``event_service.record_event`` 的直写模式：独立 async 函数，调用点少且
fire-and-forget 语义，经 ``get_async_session()`` 开独立 session 落生产库。

共享表 ``llm_usage`` 用判别列 ``source`` 区分服务（translate / weather /
course_gen…），服务专属上下文塞 ``meta`` JSONB 列——新服务接入只加 source
值，零表结构改动。
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.des.db import get_async_session
from app.core.logger import logger
from app.core.logging_context import trace_id_ctx
from app.models.llm_usage import LlmUsage


async def record_llm_usage(
    source: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    total_tokens: int,
    user_id: int | None = None,
    duration_ms: int | None = None,
    trace_id: str | None = None,
    meta: dict | None = None,
    *,
    session: AsyncSession | None = None,
) -> None:
    """持久化一条 LLM 调用 token 消耗记录。

    记录失败**绝不**抛出——调用方（翻译主流程等）不应因 usage 落库失败受影响。
    写库异常吞掉并记 WARNING 留痕（对齐 logging.md service 层吞异常留痕规约）。

    ``session`` 可选：传入时复用该 session（测试场景，用 rollback-isolated
    session），否则经 ``get_async_session()`` 开独立 session 落生产库。
    """

    payload = {
        "source": source,
        "model": model,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": total_tokens,
        "user_id": user_id,
        "duration_ms": duration_ms,
        "trace_id": trace_id or trace_id_ctx.get(),
        "meta": meta or {},
    }
    log = logger.bind(
        source=source,
        model=model,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=total_tokens,
        user_id=user_id,
        duration_ms=duration_ms,
    )

    try:
        if session is not None:
            session.add(LlmUsage(**payload))
            await session.flush()
            return

        async with get_async_session() as prod_session:
            prod_session.add(LlmUsage(**payload))
            # get_async_session 退出时统一 commit，这里无需手动提交
    except Exception as e:
        log.warning("failed to record llm usage", error=str(e))
