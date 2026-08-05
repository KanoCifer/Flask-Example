"""通用翻译服务 — 单发无状态翻译，复用共享 LLM 工厂，不挂工具。"""

from pydantic import BaseModel

from app.core.llm_factory import create_agent
from app.core.llm_prompts import TRANSLATE_INSTRUCTIONS


class TranslateResult(BaseModel):
    """翻译输出（约束模型只回译文本身）。"""

    text: str


class TranslateService:
    """通用翻译服务（无状态）：一次调用翻一段文本。"""

    def __init__(self, model):
        self.model = model

    async def translate(self, text: str, target_lang: str) -> TranslateResult:
        """把 ``text`` 翻译成 ``target_lang``。

        目标语言随 user message 下发（系统指令是共享常量，按请求变化的参数
        只能走消息）；``tools=[]`` 关闭 factory 默认的搜索工具——纯翻译不需要。
        """
        agent = create_agent(
            model=self.model,
            instructions=TRANSLATE_INSTRUCTIONS,
            db=None,
            tools=[],
        )
        response = await agent.arun(
            f"目标语言：{target_lang}\n\n{text}",
            output_schema=TranslateResult,
        )
        return response.content  # pyright: ignore[reportReturnType]
