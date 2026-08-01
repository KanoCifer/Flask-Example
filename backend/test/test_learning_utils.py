"""``build_course_id`` 纯函数单测（从原 ``test_learning_service`` 迁移，task-378）。

C2 拆分后 ``build_course_id`` 独立于服务层，作为纯工具收在
:mod:`app.services.learning_utils`；本文件只测其字符串/散列行为，
不触碰任何磁盘、DB 或 event loop（纯同步测试）。
"""

from __future__ import annotations

import re

from app.services.learning_utils import build_course_id

# ── build_course_id ────────────────────────────────────────────────────


def test_build_course_id_is_stable_and_slugified():
    a = build_course_id("Rust 入门!")
    b = build_course_id("Rust 入门!")
    # 同输入 → 同输出
    assert a == b
    # 格式: <slug>--<8hex>
    assert re.fullmatch(r"[a-z0-9-]+--[0-9a-f]{8}", a) is not None
    # 非 ASCII 字符被剥离,只剩 ascii 字符后变成 "rust"
    assert a.startswith("rust--")
    # hash 部分基于 topic.strip() 而非 slug:大小写不同则 hash 不同
    c = build_course_id("rust 入门!")
    assert a != c


def test_build_course_id_different_topic_different_hash():
    a = build_course_id("Rust 入门")
    b = build_course_id("Go 入门")
    assert a != b


def test_build_course_id_empty_topic_falls_back_to_default():
    # 纯标点 / 空串 / 纯空白 → slug 默认 "course"
    assert build_course_id("!!!").startswith("course--")
    assert build_course_id("").startswith("course--")
    assert build_course_id("   ").startswith("course--")
