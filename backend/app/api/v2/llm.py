from __future__ import annotations

from collections.abc import AsyncIterable

from fastapi import APIRouter, Body, Depends, Request
from fastapi.sse import EventSourceResponse, ServerSentEvent

from app.api.des.appstate import get_app_state
from app.api.des.auth import optional_user
from app.api.des.limiter import client_key, limiter
from app.appstate import AppState
from app.schemas.aiagent import (
    ArticleSummaryRequest,
    ChatRequest,
    WeatherAnalysisInput,
)

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


# ── 文章摘要 ──────────────────────────────────────────────


@router.post("/summary/stream", response_class=EventSourceResponse)
@limiter.limit("5/minute")
async def summary_article_stream(
    request: Request,
    payload: ArticleSummaryRequest,
    user: int | None = Depends(optional_user),
    state: AppState = Depends(get_app_state),
) -> AsyncIterable[ServerSentEvent]:
    async for chunk in state.ai_svc.summary_stream(
        payload, _resolve_user_id(user, request), model=payload.model
    ):
        yield ServerSentEvent(data={"content": chunk})


# ── 对话 ──────────────────────────────────────────────────


@router.post("/chat/stream", response_class=EventSourceResponse)
@limiter.limit("20/minute")
async def chat_stream(
    request: Request,
    payload: ChatRequest,
    user: int | None = Depends(optional_user),
    state: AppState = Depends(get_app_state),
) -> AsyncIterable[ServerSentEvent]:
    async for chunk in state.ai_svc.chat_stream(
        payload, _resolve_user_id(user, request), model=payload.model
    ):
        yield ServerSentEvent(data=chunk)


# ── 天气分析 ──────────────────────────────────────────────


@router.post("/weather-analysis", response_class=EventSourceResponse)
@limiter.limit("50/hour")
async def analyze_weather(
    request: Request,  # limiter 需要
    weather_data: WeatherAnalysisInput = Body(
        ..., description="Weather data to analyze"
    ),
    state: AppState = Depends(get_app_state),
) -> AsyncIterable[ServerSentEvent]:
    """根据天气数据进行分析并生成报告。"""
    async for chunk in state.public_svc.analyze_weather(
        weather_data, model_id=weather_data.model_id
    ):
        yield ServerSentEvent(data=chunk)
