from __future__ import annotations

from collections.abc import AsyncIterator

from app.core import logger
from app.core.agent import AiAgent
from app.schemas.aiagent import ThreadRequest


class AiService:
    """AiService — 薄封装层，仅负责 try/except + SSE 包装。"""

    def __init__(self, agent: AiAgent) -> None:
        self.agent = agent

    async def thread_stream(
        self,
        payload: ThreadRequest,
        user_id: str,
        model: str | None = None,
    ) -> AsyncIterator[dict]:
        """统一的流式生成入口，产出 {content, is_end} 信封。

        mode=summary: 文章总结
        mode=chat: 对话
        """
        try:
            async for chunk in self.agent.generate(
                mode=payload.mode,
                message=payload.message or "",
                session_id=payload.session_id or "",
                user_id=user_id,
                article_content=payload.article_content,
                article_title=payload.article_title,
                model_name=model or payload.model,
            ):
                yield {"content": str(chunk), "is_end": False}
            yield {"content": "", "is_end": True}
        except ValueError as exc:
            yield {"content": f"[ERROR] {exc!r}", "is_end": True}
        except RuntimeError as exc:
            yield {"content": f"[ERROR] {exc!r}", "is_end": True}
        except Exception as exc:
            logger.error(f"❌ AI 服务调用失败: {exc!r}")
            yield {"content": "[ERROR] AI 服务调用失败,请稍后重试", "is_end": True}
