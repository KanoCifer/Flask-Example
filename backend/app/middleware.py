from __future__ import annotations

import time
from typing import TYPE_CHECKING

from fastapi import Request
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.core import get_settings

if TYPE_CHECKING:
    from fastapi import FastAPI

origins: list[str] = [
    "http://localhost",
    "http://localhost:5173",
    "http://localhost:5174",
    "https://kanocifer.chat",
    "https://m.kanocifer.chat",
    "https://api.kanocifer.chat",
]


def register_middleware(app: FastAPI) -> None:
    app.add_middleware(SessionMiddleware, secret_key=get_settings().SECRET_KEY)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Set-Cookie", "X-Cache"],
    )

    @app.middleware("http")
    async def add_process_time_header(request: Request, call_next):
        from app.core import logger as app_logger
        from app.core.logging_context import (
            reset_trace_id,
            set_trace_id,
            trace_id_ctx,
        )

        token = set_trace_id()
        trace_id = trace_id_ctx.get()
        start_time: float = time.perf_counter()
        try:
            response = await call_next(request)
        finally:
            process_time: float = round(time.perf_counter() - start_time, 6)

        # 在 reset 前 emit —— contextvar 仍持有本次请求的 trace_id，
        # _add_trace_id 处理器自动注入正确值；reset 后再 inject 会拿到入口旧值。
        app_logger.info("http request completed")
        reset_trace_id(token)

        response.headers["X-Process-Time"] = f"{process_time}s"
        response.headers["X-Trace-Id"] = trace_id
        return response
