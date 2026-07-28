from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

from fastapi.staticfiles import StaticFiles

from app.api.v1 import (
    public,
    rss,
)
from app.api.v2 import (
    device,
    fishing,
    friendlinks,
    llm,
    subscriptions,
)
from app.api.v2 import public as public_v2
from app.utils.media import _get_media_root

if TYPE_CHECKING:
    from fastapi import FastAPI


def register_router(app: FastAPI):
    # Include routers
    # v1 版本API
    app.include_router(router=public.router, prefix="/v1")
    app.include_router(router=rss.router, prefix="/v1")

    # v2 版本API
    app.include_router(router=subscriptions.router, prefix="/v2")
    app.include_router(router=llm.router, prefix="/v2")
    app.include_router(router=device.router, prefix="/v2")
    app.include_router(router=fishing.router, prefix="/v2")
    app.include_router(router=public_v2.router, prefix="/v2")
    app.include_router(router=friendlinks.router, prefix="/v2")


def setup_media(app: FastAPI) -> None:
    media_dir: Path = _get_media_root()
    app.mount(
        path="/v1/media/",
        app=StaticFiles(directory=media_dir),
        name="media",
    )
