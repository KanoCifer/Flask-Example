"""Learning 模块的自由函数与纯工具（从 ``learning_service`` 提取，独立可测）。

与 :class:`CourseGeneratorService` / :class:`LearningProgressService` 无实例状态
关联的纯函数集中于此，便于独立单测与复用：

- 进度序列化：:func:`_progress_to_dict` — ``LearningProgress`` → API 响应 dict。
- 课程 ID：:func:`build_course_id` / :func:`_slugify` — ``<topic-slug>--<8hex>``，
  后缀为随机 uuid（同 topic 每次调用都生成新课，不再幂等复用）。

C1 深化（CoursePackageStore）后，本模块**不再**拥有任何磁盘课程包知识：
布局 / 命名约定 / 扫描 / 原子写 / 装配 / 练习解析渲染已全部迁入
:class:`app.repositories.course_package_repo.CoursePackageRepo`，本模块只留
纯文本与身份工具，被 ``course_generator_service`` / ``learning_progress_service``
与测试共同引用；不 import 上层模块（无循环依赖）。
"""

from __future__ import annotations

import re
from typing import Any
from uuid import uuid4

from app.models.learning import LearningProgress

# ── 进度序列化 ──────────────────────────────────────────────────────── #


def _progress_to_dict(doc: LearningProgress) -> dict[str, Any]:
    """``LearningProgress`` → API 响应 dict（``list_progress`` / ``mark_progress`` 共用）。"""
    return {
        "course_id": doc.course_id,
        "topic": doc.topic,
        "sessions_done": doc.sessions_done,
        "exercise_done": doc.exercise_done,
        "status": doc.status,
        "next_session": doc.next_session,
    }


# ── 课程 ID ───────────────────────────────────────────────────────────── #


def build_course_id(topic: str) -> str:
    """``course_id = <topic-slug>--<8hex>``，8hex 是**随机** uuid 前 8 位。

    同 topic 每次调用都返回不同 course_id（不幂等）——每次生成都是一门新课，
    不再按 topic 复用同一课程目录。slug 用 kebab-case（ASCII 小写 + 数字 +
    连字符，合并连续分隔符）。
    """
    slug = _slugify(topic)
    digest = uuid4().hex[:8]
    return f"{slug}--{digest}"


def _slugify(topic: str) -> str:
    """kebab-case 化：保留 ASCII 字母数字，其余折成 '-'，合并连续 '-'。"""
    raw = topic.strip().lower()
    slug = re.sub(r"[^a-z0-9]+", "-", raw)
    slug = slug.strip("-")
    return slug or "course"


__all__ = ["build_course_id"]
