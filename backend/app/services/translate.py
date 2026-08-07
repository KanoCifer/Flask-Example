"""通用翻译服务 — 单发无状态翻译，复用共享 LLM 工厂，不挂工具。"""

from app.core.llm_factory import create_agent
from app.core.llm_prompts import TRANSLATE_INSTRUCTIONS
from app.core.logger import logger
from app.schemas.translate import TranslateResult, UsageMetrics
from app.services.llm_usage_service import record_llm_usage


class TranslateService:
    """通用翻译服务（无状态）：一次调用翻一段文本。"""

    def __init__(self, model):
        self.model = model

    async def translate(
        self, text: str, target_lang: str, user_id: int | None = None
    ) -> TranslateResult:
        """把 ``text`` 翻译成 ``target_lang``，返回 ``TranslateResult`` 结构化对象。

        目标语言随 user message 下发（系统指令是共享常量，按请求变化的参数
        只能走消息）；``tools=[]`` 关闭 factory 默认的搜索工具——纯翻译不需要。

        ``use_json_mode=True`` + ``output_schema`` 组合：agno 会为
        ``OpenAIChat`` 走 json_schema 分支设置 ``response_format``，让 Ling
        网关原生结构化输出，拿到干净的 ``{"text": ...}`` 而非自由文本。

        token 消耗：从 ``response.metrics``（``RunMetrics``）解析 input/output/
        total token 与耗时，填进 ``usage`` 随结果返回，同时经
        ``record_llm_usage`` 落 ``llm_usage`` 表（``source="translate"``，meta
        带目标语言与原文长度）。落库失败由 helper 内部吞掉记 WARNING，不阻断
        翻译。
        """
        agent = create_agent(
            model=self.model,
            instructions=TRANSLATE_INSTRUCTIONS,
            db=None,
            tools=[],
            use_json_mode=True,
        )
        response = await agent.arun(
            f"目标语言：{target_lang}\n\n{text}",
            output_schema=TranslateResult,
        )
        result: TranslateResult = response.content  # pyright: ignore[reportAssignmentType]

        metrics = getattr(response, "metrics", None)
        usage = None
        if metrics is not None:
            input_tokens = getattr(metrics, "input_tokens", 0) or 0
            output_tokens = getattr(metrics, "output_tokens", 0) or 0
            total_tokens = getattr(metrics, "total_tokens", 0) or 0
            duration = getattr(metrics, "duration", None)
            duration_ms = (
                round(duration * 1000) if duration is not None else None
            )
            usage = UsageMetrics(
                model=self.model.id,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                total_tokens=total_tokens,
                duration_ms=duration_ms,
            )
            result = result.model_copy(update={"usage": usage})
            await record_llm_usage(
                source="translate",
                model=self.model.id,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                total_tokens=total_tokens,
                user_id=user_id,
                duration_ms=duration_ms,
                meta={"target_lang": target_lang, "text_len": len(text)},
            )

        logger.bind(text=text, target_lang=target_lang).info(
            "translate", response=response.content
        )
        return result
