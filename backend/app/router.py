from __future__ import annotations

from typing import TYPE_CHECKING

from app.api.v2 import (
    device,
    fishing,
    friendlinks,
    learning,
    llm,
    rss,
    subscriptions,
    translate,
)
from app.api.v2 import public as public_v2

if TYPE_CHECKING:
    from fastapi import FastAPI


def register_router(app: FastAPI):
    # Include routers
    # v2 版本API
    app.include_router(router=subscriptions.router, prefix="/v2")
    app.include_router(router=llm.router, prefix="/v2")
    app.include_router(router=device.router, prefix="/v2")
    app.include_router(router=fishing.router, prefix="/v2")
    app.include_router(router=public_v2.router, prefix="/v2")
    app.include_router(router=friendlinks.router, prefix="/v2")
    app.include_router(router=rss.router, prefix="/v2")
    app.include_router(router=learning.router, prefix="/v2")
    app.include_router(router=translate.router, prefix="/v2")
