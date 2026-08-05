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


class TranslateResult(BaseModel):
    """``POST /v2/translate`` 响应体（``data`` 字段）"""

    text: str = Field(..., description="翻译后的文本")
