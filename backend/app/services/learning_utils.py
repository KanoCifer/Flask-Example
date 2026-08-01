"""Learning 模块的自由函数与磁盘 helpers（从 ``learning_service`` 提取，独立可测）。

与 :class:`LearningService` 无实例状态关联的纯函数集中于此，便于独立单测与复用：

- 响应解析：:func:`_unwrap_model` — agent run 响应 → Pydantic 模型
  （``isinstance`` 命中 / dict 兜底 / str 失败）。
- 进度序列化：:func:`_progress_to_dict` — ``LearningProgress`` → API 响应 dict。
- 课程 ID：:func:`build_course_id` / :func:`_slugify` — ``<topic-slug>--<8hex>``。
- 磁盘扫描 / 文件名：``_parse_lesson_filename`` / ``list_existing_lesson_ids`` /
  ``lesson_file_exists`` / ``_lesson_slug_for_num`` / ``_last_lesson_md``。
- 课程装配 / 练习：``_assemble_lessons`` / ``_parse_exercises`` / ``_render_exercise_md``
  及 YAML front matter 解析（``_parse_front_matter`` / ``_extract_title_from_front_matter``）。

被 ``learning_service``、``learning_tools``、``api/v2/learning`` 与测试共同引用；
本模块**不** import 上述模块（无循环依赖）。
"""

from __future__ import annotations

import hashlib
import re
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel

from app.core.llm_prompts import LANGUAGE
from app.models.learning import LearningProgress
from app.schemas.learning import Exercise, LessonItem

# ── 响应解析 ──────────────────────────────────────────────────────────── #


def _unwrap_model(response: Any, model_cls: type[BaseModel], label: str) -> Any:
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


# ── 磁盘扫描 helpers ─────────────────────────────────────────────────── #


_LESSON_FILE_RE = re.compile(r"^(\d{4})-([a-z0-9][a-z0-9-]*)\.md$")


def _parse_lesson_filename(
    name: str,
) -> tuple[int, str] | None:
    """解析 ``0001-<slug>.md`` → ``(1, "<slug>")``；不匹配返回 None。"""
    if name.endswith(".exercise.md"):
        return None
    m = _LESSON_FILE_RE.match(name)
    if not m:
        return None
    return int(m.group(1)), m.group(2)


def list_existing_lesson_ids(lessons_dir: Path) -> list[int]:
    """扫描 ``lessons/`` 目录，提取所有 lesson body 文件（不含 .exercise.md）
    的前导编号。返回的编号已排序。
    """
    if not lessons_dir.exists():
        return []
    return sorted(
        parsed[0]
        for path in lessons_dir.glob("*.md")
        if (parsed := _parse_lesson_filename(path.name)) is not None
    )


def lesson_file_exists(lessons_dir: Path, lesson_num: int) -> bool:
    """判断 ``<num>-<slug>.md`` 形文件是否已存在（同一编号任一 slug 都算）。"""
    if not lessons_dir.exists():
        return False
    prefix = f"{lesson_num:04d}-"
    return any(
        p.name.startswith(prefix)
        for p in lessons_dir.glob(f"{prefix}*.md")
    )


def _lesson_slug_for_num(lessons_dir: Path, lesson_num: int) -> str | None:
    """取 ``<num>-<slug>.md`` 中该编号 lesson body 的 slug；无则返回 None。

    跳过 ``.exercise.md``（``_parse_lesson_filename`` 已过滤）与其它非
    ``\\d{4}-<slug>.md`` 形文件，只认 lesson body 命名约定。
    """
    prefix = f"{lesson_num:04d}-"
    for path in lessons_dir.glob(f"{prefix}*.md"):
        parsed = _parse_lesson_filename(path.name)
        if parsed is not None:
            return parsed[1]
    return None


def _last_lesson_md(
    lessons_dir: Path, existing_ids: list[int]
) -> str | None:
    """取**最大编号** lesson 的 md 全文作为上一课上下文。"""
    if not existing_ids:
        return None
    last_id = existing_ids[-1]
    for path in lessons_dir.glob(f"{last_id:04d}-*.md"):
        if path.name.endswith(".exercise.md"):
            continue
        return path.read_text(encoding="utf-8")
    return None


def _assemble_lessons(lessons_dir: Path) -> list[LessonItem]:
    """扫描 ``lessons/`` 装配 :class:`LessonItem` 列表：按编号排序；
    每个 lesson body 从 front matter 抽 ``title``，否则回退到 slug 美化。
    练习题从同名 ``.exercise.md`` 解析（缺失则空 list）。
    """
    items: list[LessonItem] = []
    for path in sorted(lessons_dir.glob("*.md")):
        parsed = _parse_lesson_filename(path.name)
        if parsed is None:
            continue
        lesson_id, slug = parsed
        body = path.read_text(encoding="utf-8")
        title = _extract_title_from_front_matter(body) or slug.replace(
            "-", " "
        )

        exercise_path = lessons_dir / f"{lesson_id:04d}-{slug}.exercise.md"
        exercises: list[Exercise] = []
        if exercise_path.exists():
            exercises = _parse_exercises(
                exercise_path.read_text(encoding="utf-8")
            )

        items.append(
            LessonItem(
                id=lesson_id,
                title=title,
                slug=slug,
                md=body,
                exercises=exercises,
            )
        )
    return items


def _parse_front_matter(md_text: str) -> dict | None:
    """解析 md 顶部 YAML front matter；缺失 / 非法返回 None。"""
    if not md_text.startswith("---"):
        return None
    end = md_text.find("\n---", 3)
    if end == -1:
        return None
    try:
        payload = yaml.safe_load(md_text[3:end])
    except yaml.YAMLError:
        return None
    return payload if isinstance(payload, dict) else None


def _extract_title_from_front_matter(md_text: str) -> str | None:
    """从 lesson md 顶部 YAML front matter 抽 ``title``。容错优先。"""
    payload = _parse_front_matter(md_text)
    if payload is None:
        return None
    title = payload.get("title")
    if isinstance(title, str) and title.strip():
        return title.strip()
    return None


def _parse_exercises(md_text: str) -> list[Exercise]:
    """从 exercise.md 的 YAML front matter 解析出 ``exercises`` 列表。

    找不到 front matter 或字段缺失时返回空列表（不抛错，便于容错）。
    """
    payload = _parse_front_matter(md_text) or {}
    exercises = payload.get("exercises", [])
    if not isinstance(exercises, list):
        return []
    parsed: list[Exercise] = []
    for item in exercises:
        if isinstance(item, dict):
            try:
                parsed.append(Exercise.model_validate(item))
            except Exception:
                continue
    return parsed


def _render_exercise_md(
    *,
    title: str,
    course_id: str,
    exercises: list[Exercise],
) -> str:
    """渲染 exercise.md：YAML front matter（exercises 列表原样序列化）+ 正文模板。

    YAML front matter 用 ``yaml.safe_dump`` 序列化，``exercises`` 列表通过
    ``Exercise.model_dump(mode="json")`` 转成原生 Python 对象，避免 ``!!python/object`` 标签。
    """
    payload = {
        "title": title,
        "course_id": course_id,
        "language": LANGUAGE,
        "exercise_count": len(exercises),
        "passing_score": 80,
        "exercises": [m.model_dump(mode="json") for m in exercises],
    }
    body_yaml = yaml.safe_dump(
        payload,
        allow_unicode=True,
        sort_keys=False,
        default_flow_style=False,
    )
    body_template = (
        "\n# 练习任务\n\n"
        "按顺序完成以下 exercise。**通过标准：≥ 80 分（总分 100）。**\n\n"
        "## 做题说明\n\n"
        "- **选择题（single_choice / multi_choice）**：提交选项后立即判分，"
        "答错会看到 `explanation`。\n"
        "- **判断题（true_false）**：判断命题对错，提交后立即判分，"
        "同样会看到 `explanation`。\n"
        "- 全部完成后回到课程首页查看完成度与错题。\n\n"
        "## 完成标准\n\n"
        "- [ ] 全部 exercise 提交后即时判分\n"
        "- [ ] 总分 ≥ 80 / 100，课程标记为完成"
    )
    return f"---\n{body_yaml}---{body_template}"


__all__ = [
    "build_course_id",
    "lesson_file_exists",
    "list_existing_lesson_ids",
]
