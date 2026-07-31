import asyncio
import os
from logging.config import fileConfig
from pathlib import Path

from dotenv import load_dotenv
import sqlalchemy as sa
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context
from app.models import Base

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config


"""新增：加载环境变量并配置数据库连接"""
# 加载环境变量
dotenv_path: Path = Path(__file__).resolve().parent.parent / ".env"
if dotenv_path.exists():
    load_dotenv(dotenv_path)

# 仅在未通过命令行/set_main_option 显式配置 URL 时，才从 .env 读取。
# 这样 pytest conftest 传入的测试库 URL 不会被 .env 的 DATABASE_URL 覆盖。
if not config.get_main_option("sqlalchemy.url"):
    database_url: str | None = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL environment variable is not set.")
    """将数据库 URL 配置到 Alembic 中"""
    config.set_main_option("sqlalchemy.url", database_url)
# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
"""修改：直接使用 app.models 中定义的 Base.metadata，确保 Alembic 能正确识别所有 ORM 模型"""
target_metadata = Base.metadata

# 所有 Python ORM 管理的表名。
# 不在这个集合里的表被视为「孤儿表」——比如 visitor_track（由 Go 端直写 PostgreSQL），
# Alembic 既不为其生成迁移、也不在 autogenerate 时把它们当作待删除表。
_orm_tables: frozenset[str] = frozenset(Base.metadata.tables)

# 生成“从数据库快照”基线时使用：ALEMBIC_BUILD_ALL_FROM_DB=1 时，
# 把 target_metadata 换成从数据库反射出来的真实元数据，以“空库 + 真实库”的对比
# 生成覆盖全部现有表（含 visitor_track 等孤儿表）的 CREATE TABLE 基线迁移。
# 一次性使用，日常迁移不开启。
_build_all_from_db = os.getenv("ALEMBIC_BUILD_ALL_FROM_DB", "0") == "1"
if _build_all_from_db:
    from sqlalchemy import MetaData

    target_metadata = MetaData()  # 稍后在 run_migrations_online() 里用同步引擎填充


def include_object(
    object_: sa.SchemaItem,
    name: str | None,
    type_: str,
    reflected: bool,
    compare_to: sa.SchemaItem | None,
) -> bool:
    """过滤 autogenerate 的对比范围。

    - 仅比较 ORM 管理的表（其余表视为合法的“孤儿表”，不生成迁移、不作为待删除项）。
    - 只对表级对象（表、索引、唯一约束）生效；列级对象的开关由
      env.py 顶部 _orm_tables 的反射结果决定（见 build_all_from_db）。
    """
    del reflected, compare_to  # 与当前过滤逻辑无关
    if _build_all_from_db:
        return True  # 基线模式要包含全部表（含 visitor_track 等孤儿表）
    if type_ == "table":
        return name in _orm_tables
    return True

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        include_object=include_object,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """In this scenario we need to create an Engine
    and associate a connection with the context.

    """

    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    if _build_all_from_db:
        # 基线模式：用同步引擎反射真实库结构，填充顶层的空 MetaData，
        # 再走“空库 vs 真实库”的对比生成 CREATE TABLE 基线。
        import sqlalchemy as sync_sa

        url = config.get_main_option("sqlalchemy.url")
        engine = sync_sa.create_engine(url)
        try:
            with engine.connect() as conn:
                target_metadata.reflect(bind=conn)
                context.configure(
                    connection=conn,
                    target_metadata=target_metadata,
                    include_object=include_object,
                )
                with context.begin_transaction():
                    context.run_migrations()
        finally:
            engine.dispose()
        return

    import concurrent.futures

    try:
        asyncio.get_running_loop()
    except RuntimeError:
        # No running loop — safe to use asyncio.run().
        asyncio.run(run_async_migrations())
    else:
        # Already inside a running loop (e.g. pytest-asyncio) — run in a
        # dedicated thread with its own event loop to avoid
        # "asyncio.run() cannot be called from a running event loop".
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            pool.submit(asyncio.run, run_async_migrations()).result()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
