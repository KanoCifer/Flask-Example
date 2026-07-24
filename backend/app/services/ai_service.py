from __future__ import annotations

from collections.abc import AsyncIterator

from app.core import logger
from app.core.agent import AiAgent
from app.schemas.aiagent import (
    ArticleSummaryRequest,
    ChatRequest,
)


class AiService:
    """AiService — 薄封装层，仅负责 try/except + SSE 包装。"""

    def __init__(self, agent: AiAgent) -> None:
        self.agent = agent

    async def summary_stream(
        self,
        payload: ArticleSummaryRequest,
        user_id: str,
        model: str | None = None,
    ) -> AsyncIterator[str]:
        try:
            async for chunk in self.agent.summarize(
                content=payload.content,
                title=payload.title,
                user_id=user_id,
                model_name=model,
            ):
                yield str(chunk)
        except Exception as exc:
            logger.error(f"❌ 文章总结失败: {exc!r}")
            yield "[ERROR] 文章总结失败,请稍后重试"

    async def chat_stream(
        self,
        payload: ChatRequest,
        user_id: str,
        model: str | None = None,
    ) -> AsyncIterator[dict]:
        try:
            async for chunk in self.agent.chat(
                message=payload.message,
                session_id=payload.session_id,
                user_id=user_id,
                article_content=payload.article_content,
                article_title=payload.article_title,
                model_name=model,
            ):
                yield {"content": str(chunk), "is_end": False}
            yield {"content": "", "is_end": True}
        except ValueError as exc:
            yield {"content": f"[ERROR] {exc!r}", "is_end": True}
        except RuntimeError as exc:
            yield {"content": f"[ERROR] {exc!r}", "is_end": True}
        except Exception as exc:
            logger.error(f"❌ 对话失败: {exc!r}")
            yield {"content": "[ERROR] 对话失败,请稍后重试", "is_end": True}
