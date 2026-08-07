"""翻译 API schemas."""

from pydantic import BaseModel, Field


class TranslateRequest(BaseModel):
    """``POST /v2/translate`` 请求体"""

    text: str = Field(min_length=1, description="待翻译文本")
    target_lang: str = Field(
        alias="targetLanguage",
        min_length=1,
        description="目标语言（如：英语 / 日语 / en）",
    )


class UsageMetrics(BaseModel):
    """单次 LLM 调用的 token 消耗（随翻译结果返回，供调用方展示/统计）。"""

    model: str = Field(..., description="模型 id")
    input_tokens: int = Field(..., description="本次请求的输入 token")
    output_tokens: int = Field(..., description="模型生成的输出 token")
    total_tokens: int = Field(..., description="输入 + 输出 token")
    duration_ms: int | None = Field(None, description="本次调用耗时（毫秒）")


class TranslateResult(BaseModel):
    """``POST /v2/translate`` 响应体（``data`` 字段）"""

    text: str = Field(..., description="翻译后的文本")
    usage: UsageMetrics | None = Field(
        None, description="本次调用的 token 消耗（可选，向后兼容）"
    )
