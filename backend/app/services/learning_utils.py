"""Learning 模块的自由函数与纯工具（从 ``learning_service`` 提取，独立可测）。

与 :class:`CourseGeneratorService` / :class:`LearningProgressService` 无实例状态
关联的纯函数集中于此，便于独立单测与复用：

- 响应解析：:func:`_unwrap_model` — agent run 响应 → Pydantic 模型
  （``isinstance`` 命中 / dict 兜底 / str 失败）。
- 进度序列化：:func:`_progress_to_dict` — ``LearningProgress`` → API 响应 dict。
- 课程 ID：:func:`build_course_id` / :func:`_slugify` — ``<topic-slug>--<8hex>``。

C1 深化（CoursePackageStore）后，本模块**不再**拥有任何磁盘课程包知识：
布局 / 命名约定 / 扫描 / 原子写 / 装配 / 练习解析渲染已全部迁入
:class:`app.repositories.course_package_repo.CoursePackageRepo`，本模块只留
纯文本与身份工具，被 ``course_generator_service`` / ``learning_progress_service``
与测试共同引用；不 import 上层模块（无循环依赖）。
"""

from __future__ import annotations

import hashlib
import re
from typing import Any

from pydantic import BaseModel

from app.models.learning import LearningProgress

# ── 响应解析 ──────────────────────────────────────────────────────────── #


def _unwrap_model(
    response: Any, model_cls: type[BaseModel], label: str
) -> Any:
    """解析 agent 响应：``isinstance`` 命中 / dict 兜底 / str 失败。

    ``label`` 仅用于错误信息。
    """
    content = getattr(response, "content", None)
    if isinstance(content, model_cls):
        return content
    if isinstance(content, dict):
        try:
            return model_cls.model_validate(content)
        except Exception as exc:
            raise RuntimeError(
                f"{label} dict 校验失败: {exc}; raw={content!r}"
            ) from exc
    raise RuntimeError(
        f"{label} 解析失败：content 不是 {model_cls.__name__}（type="
        f"{type(content).__name__}）；raw={content!r}"
    )


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
    """``course_id = <topic-slug>--<8hex>``，8hex 是 topic 文本的 sha1 前 8 位。

    使用 sha1 而非 md5 以避免历史碰撞顾虑；截断到 8 字符是 prototype
    约定的格式。slug 用 kebab-case（ASCII 小写 + 数字 + 连字符，合并
    连续分隔符）。
    """
    slug = _slugify(topic)
    digest = hashlib.sha1(topic.strip().encode("utf-8")).hexdigest()[:8]
    return f"{slug}--{digest}"


def _slugify(topic: str) -> str:
    """kebab-case 化：保留 ASCII 字母数字，其余折成 '-'，合并连续 '-'。"""
    raw = topic.strip().lower()
    slug = re.sub(r"[^a-z0-9]+", "-", raw)
    slug = slug.strip("-")
    return slug or "course"


__all__ = ["build_course_id"]
