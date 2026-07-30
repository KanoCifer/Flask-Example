"""一次性迁移脚本：把 readinglist.fish 集合的 kind 字段按名称启发式回填

背景：
  task-278 在 ``@readinglist/types`` 新增 ``FishingSpotKind = 'lake' | 'river' | 'reservoir'``
  与 ``MapMarker.kind`` 同一组字面量。task-280 同步到 Go document/seed，task-281
  这一头处理历史遗留行：

  - 旧钓点的 ``name`` 字段经用户手动 / 旧版 seed 写入，``kind`` 字段缺失或 ``None``
  - 本脚本根据 ``name`` 含中文关键字做一次启发式回填
  - 已存在的 ``kind`` 值（包括 ``None``）一律保留 —— 不覆盖用户/前端显式设置

启发式规则（按优先级短路）：
  1. name 包含 ``湖``                → ``lake``
  2. name 包含 ``江`` 或 ``河``      → ``river``
  3. name 包含 ``水库``              → ``reservoir``
  4. 其它                             → 保持 ``None``，人工确认

操作：
  1. 遍历 ``readinglist.fish`` 集合
  2. 对缺失 ``kind`` 或 ``kind is None`` 的文档尝试启发式推断
  3. ``$set`` 写入 ``kind``（仅命中规则的文档）
  4. 结束后 ``createIndex({kind: 1})``
  5. 打印 scanned / updated-by-heuristic / left-null 计数

用法（dry-run 默认开启）：
  uv run python scripts/migrate_fishing_spot_kind.py                 # dry-run，只读
  uv run python scripts/migrate_fishing_spot_kind.py --apply         # 实际写入 + 索引
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path
from typing import Literal

# 让脚本能从 backend/ 根目录直接 import app
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pymongo import ASCENDING, AsyncMongoClient

from app.core.config import settings

DB_NAME = "readinglist"
COLLECTION = "fish"

FishingSpotKind = Literal["lake", "river", "reservoir"]


def infer_kind(name: object) -> FishingSpotKind | None:
    """根据钓点名称启发式推断 ``kind`` —— 纯函数，便于单元测试。

    优先级：湖泊 (``湖``) > 江河 (``江``/``河``) > 水库 (``水库``)。
    无法推断或输入为空 / 非字符串 → ``None``（不覆盖用户曾显式设置）。
    """
    if not isinstance(name, str) or not name:
        return None
    if "湖" in name:
        return "lake"
    if "江" in name or "河" in name:
        return "river"
    if "水库" in name:
        return "reservoir"
    return None


async def run(apply: bool) -> None:
    if not settings.MONGO_URI:
        raise RuntimeError("MONGO_URI 未设置")
    client = AsyncMongoClient(settings.MONGO_URI)
    db = client[DB_NAME]
    coll = db[COLLECTION]

    scanned = 0
    updated = 0
    left_null = 0

    async for doc in coll.find({}):
        scanned += 1
        # 已有 kind（含 None）一律保留 —— 不覆盖
        if "kind" in doc:
            if doc["kind"] is None:
                left_null += 1
            continue

        inferred = infer_kind(doc.get("name"))
        if inferred is None:
            left_null += 1
            continue

        name_preview = doc.get("name", "<unnamed>")
        if apply:
            await coll.update_one({"_id": doc["_id"]}, {"$set": {"kind": inferred}})
            updated += 1
        else:
            updated += 1  # dry-run 也计数，方便排错
        print(f"  · {name_preview!r} → {inferred}")

    if apply:
        # ensure index — 已存在则 no-op
        await coll.create_index([("kind", ASCENDING)], name="kind_1")
        print("✅ 已 ensure {kind: 1} 索引")
    else:
        print("(dry-run 模式，未写入、未建索引)")

    print(
        f"[summary] scanned={scanned} updated_by_heuristic={updated} "
        f"left_null={left_null} apply={apply}"
    )

    await client.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--apply",
        action="store_true",
        help="实际写入 kind 字段并 ensure 索引（默认 dry-run）",
    )
    args = parser.parse_args()
    asyncio.run(run(apply=args.apply))


if __name__ == "__main__":
    main()
