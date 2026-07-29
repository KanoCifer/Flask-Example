from __future__ import annotations

from fastapi import APIRouter, Body, Depends, Request
from fastapi.sse import EventSourceResponse

from app.api.des.auth import optional_user
from app.api.des.limiter import check_mode_rate_limit, client_key, limiter
from app.appstate import AppState, get_app_state
from app.schemas.aiagent import ThreadRequest, WeatherAnalysisInput

router = APIRouter(prefix="/llm", tags=["llm"])


def _resolve_user_id(user_id: int | None, request: Request) -> str:
    """把 `Depends(optional_user)` 的结果映射成 service 层要的 user_id 字符串。

    登录用户用真实 id；匿名用户退回到 `anon:<ip>`，IP 取自 `client_key`：
    反代下读 `X-Forwarded-For` 末段（真实访客 IP），直连退化到 `request.client.host`。
    同 IP 共享同一访客桶（被限流时也会被命中）。
    """
    if user_id is not None:
        return str(user_id)
    return f"anon:{client_key(request)}"


# ── Thread（总结 / 对话共用）──────────────────────────────


@router.post("/thread/stream", response_class=EventSourceResponse)
async def thread_stream(
    request: Request,
    payload: ThreadRequest,
    user: int | None = Depends(optional_user),
    state: AppState = Depends(get_app_state),
):
    # 按 mode 分别限流：summary 5/min、chat 20/min。
    # 注意：限流检查必须在返回 EventSourceResponse 之前完成 —— Starlette 会先
    # 发 ``http.response.start``（200）再迭代 body，若把检查放生成器内部，超限
    # 时状态码已无法改为 429。
    check_mode_rate_limit(payload.mode, client_key(request))

    async for chunk in state.ai_svc.thread_stream(
        payload, _resolve_user_id(user, request), model=payload.model
    ):
        yield chunk


# ── 天气分析 ──────────────────────────────────────────────


@router.post("/weather-analysis", response_class=EventSourceResponse)
@limiter.limit("50/hour")
async def analyze_weather(
    request: Request,  # limiter 需要
    weather_data: WeatherAnalysisInput = Body(
        ..., description="Weather data to analyze"
    ),
    state: AppState = Depends(get_app_state),
):
    """根据天气数据进行分析并生成报告。"""
    async for chunk in state.weather_analysis_svc.analyze_weather(
        weather_data, model_id=weather_data.model_id
    ):
        yield chunk
