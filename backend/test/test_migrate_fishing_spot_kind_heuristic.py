"""Unit tests for ``infer_kind`` —— ``backend/scripts/migrate_fishing_spot_kind.py`` 的纯函数。

覆盖以下场景：
  - 名字含 ``湖``                 → lake
  - 名字含 ``江`` / ``河``        → river
  - 名字含 ``水库``              → reservoir
  - 名字不含任何关键字 → None
  - 空字符串 / 非字符串 → None
  - 优先级：``湖`` 优先于 ``水库`` / ``江``
"""

from __future__ import annotations

import importlib.util
import os
from pathlib import Path

import pytest

# Migration 脚本模块级 ``from app.core.config import settings`` 会触发
# MailConfig 的 pydantic validation —— 在加载脚本前 stub 必要的 env，
# 否则 CI/test 环境无 ``.env`` 时 ValidationError 直接中断采集。
os.environ.setdefault("MAIL_FROM", "noreply@example.com")
os.environ.setdefault("MAIL_USERNAME", "tester@example.com")
os.environ.setdefault("MAIL_PASSWORD", "ignored")
os.environ.setdefault("SECRET_KEY", "test-secret-for-migration-heuristic-only")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://x:y@localhost/z")
os.environ.setdefault("WEBAUTHN_RP_ID", "localhost")
os.environ.setdefault("WEBAUTHN_ORIGIN", "http://localhost:5173")

# 直接导入 migration 脚本的 ``infer_kind`` —— 脚本位于 scripts/，不在包内，
# 通过 importlib 路径加载以避免污染 backend/test 的包结构。
SCRIPT_PATH = (
    Path(__file__).resolve().parent.parent / "scripts" / "migrate_fishing_spot_kind.py"
)


def _load_infer_kind():
    spec = importlib.util.spec_from_file_location(
        "migrate_fishing_spot_kind", SCRIPT_PATH
    )
    assert spec is not None and spec.loader is not None, "migration 脚本加载失败"
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.infer_kind


infer_kind = _load_infer_kind()


@pytest.mark.parametrize(
    "name, expected",
    [
        # ── 湖 ──
        ("湖北东湖", "lake"),
        ("千岛湖", "lake"),
        ("西湖", "lake"),
        # ── 江 / 河 ──
        ("长江", "river"),
        ("珠江", "river"),
        ("新安江", "river"),
        ("黄河", "river"),
        ("松花江", "river"),
        # ── 水库 ──
        ("三亚水库", "reservoir"),
        ("密云水库", "reservoir"),
        # ── 无法推断 —— None ──
        ("神秘岩礁", None),
        ("无名钓位", None),
        # ── 边界：空 / 非字符串 ──
        ("", None),
    ],
)
def test_infer_kind_classic_cases(name: str, expected):
    assert infer_kind(name) == expected


@pytest.mark.parametrize("bad_input", [None, 123, 1.5, ["湖"], {"name": "湖"}, b"lakes"])
def test_infer_kind_non_string_returns_none(bad_input):
    """非字符串输入不应抛错，统一返回 ``None``（保持原值不被覆盖）。"""
    assert infer_kind(bad_input) is None


def test_lake_takes_priority_over_reservoir():
    """``湖`` 优先于 ``水库``（避免「某某湖水库」误判为水库）。"""
    assert infer_kind("三岔口湖水库") == "lake"


def test_lake_takes_priority_over_river():
    """``湖`` 优先于 ``河``（避免「西湖河」误判为河）。"""
    assert infer_kind("西湖河段") == "lake"


def test_is_idempotent():
    """``infer_kind`` 是纯函数 —— 同样的输入两次结果一致。"""
    names = ["湖北东湖", "长江", "神秘岩礁", "三亚水库", ""]
    first = [infer_kind(n) for n in names]
    second = [infer_kind(n) for n in names]
    assert first == second
