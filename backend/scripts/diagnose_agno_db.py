"""诊断 agno 会话库为何为空（临时脚本，用完可删）。

复现 agno `AsyncPostgresDb.upsert_session` 的建表 + 写入路径，
但**不吞异常**——把被 `upsert_session` 静默吞掉的真实错误打出来。

用法（在 backend 目录，用 `uv` 跑）：
    uv run python scripts/diagnose_agno_db.py

会依次检查：
  1. db_url 能否被 SQLAlchemy 解析
  2. 能否建立连接（数据库/主机/密码是否正确）
  3. 能否创建 agno 默认 schema（agno 2.8.5 默认 "ai"）下的会话表
  4. 能否 upsert 一条 dummy 会话并读回
"""

from __future__ import annotations

import asyncio
import traceback

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from agno.db.postgres import AsyncPostgresDb
from agno.utils.log import set_log_level_to_info  # type: ignore[attr-defined]

from app.core.config import get_settings


async def main() -> None:
    url = get_settings().LEARNING_DATABASE_URL
    print(f"[1] db_url = {url!r}")
    if not url:
        print("    ❌ LEARNING_DATABASE_URL 未配置（config.py 默认空串）")
        return

    # 1. URL 解析
    try:
        engine = create_async_engine(url)
        print("    ✅ URL 可解析")
    except Exception:
        print("    ❌ URL 解析失败：")
        traceback.print_exc()
        return

    # 2. 连接 + SELECT 1（数据库是否存在、密码/主机是否正确）
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        print("    ✅ 连接成功（数据库存在、密码正确）")
    except Exception:
        print("    ❌ 连接失败（数据库不存在 / 主机不对 / 密码错误 / 权限不足）：")
        traceback.print_exc()
        return

    # 3. 走 agno 自己的建表路径（与 upsert_session 第一步相同，但不吞异常）
    db = AsyncPostgresDb(db_url=url)
    print(f"    db_schema = {db.db_schema!r}, session_table = {db.session_table_name!r}")
    try:
        table = await db._get_or_create_table(
            db.session_table_name, "sessions", create_table_if_not_found=True
        )
        print(f"    ✅ 建表成功: schema={table.schema}, name={table.name}")
    except Exception:
        print("    ❌ 建表失败（schema 创建 / 建表语句报错）：")
        traceback.print_exc()
        return

    # 4. dummy upsert + read back
    try:
        from agno.agent import AgentSession

        session = AgentSession(
            session_id="diagnose-probe-0001",
            agent_id="diagnose",
            created_at=0,
        )
        await db.upsert_session(session)
        got = await db.get_session(session_id="diagnose-probe-0001")
        print(f"    ✅ upsert + read 回环成功，读回 session_id={getattr(got, 'session_id', None)!r}")
        # 清理 probe 行
        await db.delete_session(session_id="diagnose-probe-0001")
        print("    ✅ 已删除 probe 行")
    except Exception:
        print("    ❌ upsert/read 回环失败：")
        traceback.print_exc()
        return

    print("\n结论：若上面全部通过，说明 agno 持久化本身正常，问题在别处；")
    print("若某一步报错，那条异常就是被 upsert_session 吞掉、导致库一直为空的原因。")


if __name__ == "__main__":
    asyncio.run(main())
