"""
导入钓点数据到 MongoDB。

目标库/集合与 Go 后端对齐：database=`readinglist`，collection=`fish`
（参见 go-backend/internal/db/db.go:77 与 go-backend/internal/repository/mongodb/fish.go:16）。

运行：
    cd go-backend/internal/mongo/document
    uv run python fishing_spot.py            # 需设置 MONGO_URI 环境变量，复用 backend/.env

钓点坐标来源：用户实测点（广州周边）。
"""

from __future__ import annotations

import os
import sys
from datetime import UTC, datetime, timezone

from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, PyMongoError

# —— 配置：与 Go 后端 InitMongo() 对齐 ——
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DATABASE_NAME = "readinglist"
COLLECTION_NAME = "fish"

# —— 待导入的钓点坐标 ——
SPOTS: list[dict[str, object]] = [
    {"position": [113.399705, 23.067563]},
    {"position": [113.401591, 23.06482]},
    {"position": [113.402591, 23.075127]},
    {"position": [113.424257, 23.065673]},
    {"position": [113.393567, 23.050138]},
    {"position": [113.387874, 23.04868]},
    {"position": [113.413389, 23.044658]},
    {"position": [113.401986, 23.065574]},
    {"position": [113.397902, 23.066994]},
    {"position": [113.39866, 23.067592]},
    {"position": [113.395682, 23.068859]},
    {"position": [113.401471, 23.053448]},
]


def build_doc(
    position: list[float],
    name: str = "",
    description: str = "",
    kind: str | None = None,
) -> dict[str, object]:
    """构造与 go-backend/internal/mongo/document/fishing_spot.go:FishingSpot 对齐的文档。

    ``kind`` 是水体类型（``lake``/``river``/``reservoir``），与
    ``@readinglist/types`` 的 ``FishingSpotKind`` 同一组字面量。
    seed 阶段没有用户输入，固定为 ``None``；遗留行经
    ``backend/scripts/migrate_fishing_spot_kind.py`` 启发式回填。
    """
    now = datetime.now(UTC)
    return {
        "location": position,
        "name": name,
        "description": description,
        "kind": kind,
        "tags": [],
        "createdAt": now,
        "updatedAt": now,
        "deletedAt": None,
        "rating": 0.0,
        "images": [],
    }


def main() -> int:
    if not MONGO_URI:
        print(
            "[error] MONGO_URI 未设置。可在 backend/.env 中配置后 "
            "通过 `MONGO_URI=... uv run python fishing_spot.py` 传入。",
            file=sys.stderr,
        )
        return 1

    try:
        client: MongoClient = MongoClient(MONGO_URI)
        # 连通性验证
        client.admin.command("ping")
    except ConnectionFailure as exc:
        print(f"[error] 连接 MongoDB 失败：{exc}", file=sys.stderr)
        return 1

    db = client[DATABASE_NAME]
    coll = db[COLLECTION_NAME]

    docs = [build_doc(spot["position"]) for spot in SPOTS]

    try:
        result = coll.insert_many(docs, ordered=False)
    except PyMongoError as exc:
        print(f"[error] 插入失败：{exc}", file=sys.stderr)
        client.close()
        return 1

    inserted = len(result.inserted_ids)
    print(
        f"[ok] 成功导入 {inserted} 条钓点 → {DATABASE_NAME}.{COLLECTION_NAME}"
    )
    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
