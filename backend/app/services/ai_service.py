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
        """统一的流式生成入口，产出 ``{type, content, is_end}`` 信封。

        - ``type="reasoning"``: 推理/思考过程的 delta。
        - ``type="content"``:   正常正文 delta；末帧与错误帧也归为该通道。
        - 末尾帧 ``is_end=True`` + 空 content，标识流结束。

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
                yield {
                    "type": chunk["type"],
                    "content": chunk["content"],
                    "is_end": False,
                }
            yield {"type": "content", "content": "", "is_end": True}
        except ValueError as exc:
            yield {
                "type": "content",
                "content": f"[ERROR] {exc!r}",
                "is_end": True,
            }
        except RuntimeError as exc:
            yield {
                "type": "content",
                "content": f"[ERROR] {exc!r}",
                "is_end": True,
            }
        except Exception as exc:
            logger.error(f"❌ AI 服务调用失败: {exc!r}")
            yield {
                "type": "content",
                "content": "[ERROR] AI 服务调用失败,请稍后重试",
                "is_end": True,
            }
