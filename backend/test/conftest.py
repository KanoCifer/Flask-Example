"""Shared pytest fixtures for backend test suite."""

from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings
from app.models import Base

# ── Test database (isolated from production) ──────────────────────
# Tests run against a dedicated schema so `drop_all` / `create_all`
# never touch the production tables.  Alembic migrations are applied
# instead of `create_all` so the schema matches what the app actually uses.
TEST_DATABASE_URL = "postgresql+asyncpg://liudetao:root@localhost/postgres_test"


@pytest.fixture(scope="session")
def settings():
    """Return settings with a deterministic secret for tests."""
    get_settings.cache_clear()
    return get_settings()


@pytest_asyncio.fixture(scope="session")
async def db_engine():
    """Ensure the test database exists, then return a session-scoped engine."""
    import asyncpg

    # Connect to the default `postgres` db to create `postgres_test` if missing
    conn = await asyncpg.connect(
        "postgresql://liudetao:root@localhost/postgres"
    )
    exists = await conn.fetchval(
        "SELECT 1 FROM pg_database WHERE datname = $1", "postgres_test"
    )
    if not exists:
        await conn.execute("CREATE DATABASE postgres_test")
    await conn.close()

    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(scope="session")
async def tables(db_engine):
    """Create all tables from ORM models (test DB is ephemeral).

    使用 ``Base.metadata.create_all`` 而非 Alembic migration，因为
    init migration 是空操作（pass），migration 链假设表已由外部创建。
    测试库每次都是全新的，直接建表更可靠。
    """
    async with db_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with db_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session(db_engine, tables) -> AsyncGenerator[AsyncSession]:
    """Function-scoped async session with rollback-based isolation.

    Opens a session with autocommit=False so SQLAlchemy starts a
    transaction automatically.  After the test we roll it back,
    undoing all flushes without ever issuing a SAVEPOINT — which
    would conflict with asyncpg's single-operation-per-connection
    model when ``selectinload`` triggers a second query.
    """
    session_factory = async_sessionmaker(
        bind=db_engine,
        expire_on_commit=False,
        autocommit=False,
    )
    async with session_factory() as session:
        try:
            yield session
        finally:
            await session.rollback()


# ─────────────────────────────────────────────────────────────────
# Phase 5 — API test fixtures (AppState DI) ─────────────────────
# ─────────────────────────────────────────────────────────────────


@pytest_asyncio.fixture
async def api_app(db_session) -> AsyncGenerator:
    """Lightweight FastAPI app for API tests — Phase 5 AppState 模式.

    不经过 main.py lifespan（无 Mongo/Redis/Taskiq 依赖），
    手动构造 AppState 单例并挂载到 ``app.state.services``。

    注意：httpx ASGITransport 在当前版本不触发 FastAPI lifespan，
    因此直接在 fixture 中设置 ``services``，而非依赖 lifespan 回调。
    router 通过 ``Depends(get_app_state)`` 获取 ``state``、
    通过 ``Depends(get_session)`` 获取请求级 session —— 这里覆盖
    ``get_session`` 让它始终返回 rollback-isolated ``db_session``。
    """
    from fastapi import FastAPI

    from app.api.des.db import get_session
    from app.api.des.auth import manager
    from app.appstate import new_app_state
    from app.core import register_exception_handlers
    from app.router import register_router

    test_app = FastAPI()
    test_app.state.services = new_app_state(None)  # type: ignore[arg-type]
    register_router(test_app)
    register_exception_handlers(test_app)

    # Inject the rollback-isolated session into the DI graph.
    async def _session_override():
        yield db_session

    test_app.dependency_overrides[get_session] = _session_override

    # Auth: return the test user's ID (set by ``api_user`` fixture).
    test_app.dependency_overrides[manager] = lambda: _get_api_user_id()

    yield test_app

    test_app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def api_client(api_app) -> AsyncGenerator[AsyncClient]:
    """Async HTTP client bound to the test app."""
    transport = ASGITransport(app=api_app)
    async with AsyncClient(
        transport=transport, base_url="http://test"
    ) as client:
        yield client


_api_user_id: int | None = None


def _get_api_user_id() -> int:
    assert _api_user_id is not None, "api_user fixture must be used first"
    return _api_user_id


@pytest_asyncio.fixture
async def api_user(db_session) -> AsyncGenerator:
    """Create a test user and expose its ID to the auth override."""
    from app.models.models import User

    global _api_user_id
    user = User(username="apiuser", password="pass123")
    db_session.add(user)
    await db_session.flush()
    _api_user_id = user.id
    yield user
    _api_user_id = None
