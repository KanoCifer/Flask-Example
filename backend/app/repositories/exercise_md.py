"""exercise.md 的 YAML 编解码（issue #29 起全课程包唯一保留 front matter 的产物）。

从 :class:`app.repositories.course_package_repo.CoursePackageRepo` 拆出的纯编解码
模块（A 拆分）：渲染 / 解析 exercise.md 的 YAML front matter。它是自包含的纯函数
集合——只依赖 ``Exercise`` schema 与 ``LANGUAGE`` 常量，不触碰磁盘布局 / 命名 /
仓库状态，独立可测。

- :func:`_render_exercise_md`：``Exercise`` 列表 → exercise.md 全文（front matter
  ``exercises`` 列表 + 正文模板），仓库 ``write_exercise`` 落盘前调用。
- :func:`_parse_exercises`：exercise.md 全文 → ``Exercise`` 列表（容错优先），
  仓库 ``read_exercises`` / ``assemble_lessons`` 读回时调用。
- :func:`_parse_front_matter` / :func:`_extract_title_from_front_matter`：通用的
  YAML front matter 解析；后者仅作**旧课程** lesson body 的标题兜底（新课程标题
  以 manifest 为准）。
"""

from __future__ import annotations

import yaml

from app.core.llm_prompts import LANGUAGE
from app.schemas.learning import Exercise


def _parse_front_matter(md_text: str) -> dict | None:
    """解析 md 顶部 YAML front matter；缺失 / 非法返回 None。

    issue #29 起仅用于 exercise.md 的练习解析（``_parse_exercises``）；
    lesson body / resource / mission 不再读写 front matter。
    """
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
    """从 lesson md 顶部 YAML front matter 抽 ``title``。容错优先。

    issue #29：新课程标题以 manifest 为准，本函数仅作**旧课程兜底**（历史
    落盘含 front matter 的 lesson body）。
    """
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

    exercise.md 是全课程包唯一保留 YAML front matter 的产物。front matter 用
    ``yaml.safe_dump`` 序列化，``exercises`` 列表通过 ``Exercise.model_dump(mode="json")``
    转成原生 Python 对象，避免 ``!!python/object`` 标签。
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
    "_extract_title_from_front_matter",
    "_parse_exercises",
    "_render_exercise_md",
]
