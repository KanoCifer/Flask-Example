"""AI agent schemas."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ThreadRequest(BaseModel):
    """统一的 Thread 请求体（总结 / 对话共用）"""

    mode: Literal["summary", "chat"] = Field(description="请求模式：summary=文章总结, chat=对话")
    message: str | None = Field(default=None, description="用户消息（chat 模式必填）")
    session_id: str | None = Field(default=None, description="会话 ID（首轮可为空，由后端生成）")
    article_content: str | None = Field(default=None, description="文章正文")
    article_title: str | None = Field(default=None, description="文章标题")
    model: str | None = Field(default=None, description="模型名称")


class HistoryRequest(BaseModel):
    """缓存查询请求体 - 用于查询历史总结/对话缓存 (POST 代替 GET, 避免 URL 过长导致 431 错误)"""

    article_content: str = Field(min_length=1, description="文章正文")
    article_title: str | None = Field(default=None, description="文章标题")


class SummaryInput(BaseModel):
    """文章总结输入模型 (用于 Agno Agent)"""

    content: str = Field(description="需要总结的文章正文")
    title: str | None = Field(default=None, description="文章标题")


class WeatherAnalysisInput(BaseModel):
    """天气分析输入模型"""

    weather_data: dict = Field(..., description="需要分析的天气数据")
    model_id: str | None = Field(
        default=None, description="AI 模型 ID，默认使用配置中的模型"
    )


# ── 天气分析 Agent 输入 Schema（类型化 Pydantic 模型）──────────────── #


class FishingContextInput(BaseModel):
    """钓鱼指数上下文"""

    expert_score: float | None = Field(default=None, description="专家基准分")
    feature_breakdown: dict | None = Field(
        default=None, description="专家特征分解"
    )


class LiveWeatherInput(BaseModel):
    """实时天气数据"""

    temp: float | None = Field(default=None, description="气温（°C）")
    text: str | None = Field(default=None, description="天气文字描述")
    wind360: str | None = Field(default=None, description="风向角度")
    windDir: str | None = Field(default=None, description="风向文字")
    windSpeed: str | None = Field(default=None, description="风速（km/h）")
    humidity: int | None = Field(default=None, description="湿度（%）")
    pressure: float | None = Field(default=None, description="气压（hPa）")
    precip: float | None = Field(default=None, description="降水量（mm）")


class TideEventInput(BaseModel):
    """潮汐事件（高低潮）"""

    type: Literal["H", "L"] = Field(..., description="H=高潮，L=低潮")
    fxTime: str = Field(..., description="发生时间")
    height: float = Field(..., description="潮高（m）")


class TideHourlyInput(BaseModel):
    """逐时潮高"""

    fxTime: str = Field(..., description="时间")
    height: str = Field(..., description="潮高（m）")


class TideDataInput(BaseModel):
    """潮汐数据"""

    updateTime: str | None = Field(default=None, description="更新时间")
    tideTable: list[TideEventInput] = Field(
        default_factory=list, description="高低潮时刻表"
    )
    tideHourly: list[TideHourlyInput] = Field(
        default_factory=list, description="逐时潮高"
    )


class DayForecastInput(BaseModel):
    """单日天气预报"""

    date: str = Field(..., description="日期")
    day_temp: str = Field(..., description="白天温度（°C）")
    day_weather: str = Field(..., description="白天天气")
    day_wind: str = Field(..., description="白天风向")
    day_power: str = Field(..., description="白天风力")
    night_temp: str = Field(..., description="夜间温度（°C）")
    night_weather: str = Field(..., description="夜间天气")


class WeatherAnalysisInputSchema(BaseModel):
    """天气分析输入 Schema（类型化 Pydantic 模型，替代字符串拼接）"""

    fishing_index: FishingContextInput | None = Field(
        default=None, description="钓鱼指数上下文"
    )
    live_weather: LiveWeatherInput | None = Field(
        default=None, description="实时天气"
    )
    forecasts: list[DayForecastInput] = Field(
        default_factory=list, description="天气预报"
    )
    tide_data: TideDataInput | None = Field(
        default=None, description="潮汐数据"
    )
    tide_spot_name: str | None = Field(
        default=None, description="最近的潮汐站点"
    )
    location_name: str | None = Field(
        default=None, description="用户位置，用于分析和输出建议"
    )
