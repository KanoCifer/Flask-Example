"""Direct tests for ``app.services.learning_tools.create_learning_tools``.

issue #29 后工具集收敛为三件：``LessonWriter``（全参数可选分发器） /
``ExerciseWriter``（显式 num/slug + JSON 练习）/ 只读 ``FileTools``。本文件
直测 ``LessonWriter`` 分发器行为（仅 mission / 仅 resource / 仅 lesson /
缺 num 报错 / conflict 与 update_lesson）与 ``ExerciseWriter`` 的 JSON 校验，
磁盘知识委托真实 :class:`CoursePackageRepo`（与生产一致，不 mock 写语义）。

agno ``@tool`` 装饰后的 ``Function`` 用 ``.entrypoint`` 调用原函数；读工具
``FileTools`` 直接调 ``read_file``。仓库方法是同步磁盘 I/O，测试不用 event loop。
"""

from __future__ import annotations

import json
from pathlib import Path

from agno.tools.file import FileTools

from app.repositories.course_package_repo import CoursePackageRepo
from app.services.learning_tools import create_learning_tools

# ── 本地 builders ────────────────────────────────────────────────────────


def _make_repo(
    tmp_path: Path, course_id: str = "c--00000001"
) -> CoursePackageRepo:
    return CoursePackageRepo(course_id=course_id, tmp_dir=tmp_path)


def _single_choice_exercise() -> dict:
    return {
        "id": 1,
        "type": "single_choice",
        "difficulty": 1,
        "points": 20,
        "prompt": "Rust 中 ? 是什么操作符?",
        "options": [
            {"key": "A", "text": "三元"},
            {"key": "B", "text": "错误传播"},
            {"key": "C", "text": "解构"},
            {"key": "D", "text": "宏调用"},
        ],
        "answer": "B",
        "explanation": "? 是 Try trait 的语法糖,用于错误传播。",
    }


def _exercises_json() -> str:
    return json.dumps([_single_choice_exercise()], ensure_ascii=False)


def _get_tools(repo: CoursePackageRepo):
    """解构工具集为 (LessonWriter, ExerciseWriter, reader)。"""
    tools = create_learning_tools(repo)
    assert len(tools) == 3
    return tools[0], tools[1], tools[2]


def _lesson_md(num: int = 1) -> str:
    return f"# Rust 入门 · 第 {num} 课\n\n第 {num} 课内容…\n"


# ── 工具集形状 ──────────────────────────────────────────────────────────


def test_create_learning_tools_returns_three_items(tmp_path):
    """工具集 = [LessonWriter, ExerciseWriter, 只读 FileTools]。"""
    repo = _make_repo(tmp_path)
    LessonWriter, ExerciseWriter, reader = _get_tools(repo)

    assert LessonWriter.name == "LessonWriter"
    assert ExerciseWriter.name == "ExerciseWriter"
    assert isinstance(reader, FileTools)
    assert reader.base_dir == repo.root


def test_reader_read_file_returns_lesson_content(tmp_path):
    """只读 FileTools 可经 read_file 读回落盘的 lesson body。"""
    repo = _make_repo(tmp_path)
    LessonWriter, _, reader = _get_tools(repo)
    LessonWriter.entrypoint(
        num=1, slug="lesson-1", title="t", lesson_md=_lesson_md()
    )

    assert "# Rust 入门" in reader.read_file("lessons/0001-lesson-1.md")


# ── LessonWriter 分发器：仅 mission / 仅 resource ────────────────────────


def test_LessonWriter_only_mission_overwrites(tmp_path):
    """仅 mission_md → 覆盖写 MISSION.md，返回落盘文件名。"""
    repo = _make_repo(tmp_path)
    LessonWriter, _, _ = _get_tools(repo)

    assert (
        LessonWriter.entrypoint(mission_md="# Mission: Rust") == "MISSION.md"
    )
    assert repo.read_mission() == "# Mission: Rust"
    # 第二次调用仍覆盖（always）
    assert (
        LessonWriter.entrypoint(mission_md="# Mission: Rust 2") == "MISSION.md"
    )
    assert repo.read_mission() == "# Mission: Rust 2"


def test_LessonWriter_only_resource_overwrites(tmp_path):
    """仅 resource_md → 覆盖写 RESOURCE.md，返回落盘文件名。"""
    repo = _make_repo(tmp_path)
    LessonWriter, _, _ = _get_tools(repo)

    assert LessonWriter.entrypoint(resource_md="# 速查") == "RESOURCE.md"
    assert repo.read_resource() == "# 速查"


def test_LessonWriter_only_mission_and_resource(tmp_path):
    """仅 mission + resource（无 lesson body）→ 两者都写，返回两者文件名。"""
    repo = _make_repo(tmp_path)
    LessonWriter, _, _ = _get_tools(repo)

    result = LessonWriter.entrypoint(
        mission_md="# Mission: Rust", resource_md="# 速查"
    )
    assert result == "MISSION.md、RESOURCE.md"
    assert repo.read_mission() == "# Mission: Rust"
    assert repo.read_resource() == "# 速查"


# ── LessonWriter 分发器：仅 lesson ───────────────────────────────────────


def test_LessonWriter_only_lesson(tmp_path):
    """仅 lesson（num+slug+title+lesson_md）→ 写正文 + manifest，返回文件名。"""
    repo = _make_repo(tmp_path)
    LessonWriter, _, _ = _get_tools(repo)

    result = LessonWriter.entrypoint(
        num=1,
        slug="lesson-1",
        title="Rust 入门",
        lesson_md=_lesson_md(),
    )
    assert result == "0001-lesson-1.md"
    assert repo.find_lesson(1) == (1, "lesson-1")
    assert repo.manifest_path.exists()


def test_LessonWriter_lesson_plus_mission_and_resource(tmp_path):
    """一次调用写 lesson + mission + resource → 三件套全落盘，返回 lesson 文件名。"""
    repo = _make_repo(tmp_path)
    LessonWriter, _, _ = _get_tools(repo)

    result = LessonWriter.entrypoint(
        num=1,
        slug="lesson-1",
        title="Rust 入门",
        lesson_md=_lesson_md(),
        mission_md="# Mission: Rust",
        resource_md="# 速查",
    )
    assert result == "0001-lesson-1.md"
    assert repo.find_lesson(1) == (1, "lesson-1")
    assert repo.read_mission() == "# Mission: Rust"
    assert repo.read_resource() == "# 速查"


def test_LessonWriter_missing_num_returns_error(tmp_path):
    """写课正文缺 num → 返回错误说明，不写盘。"""
    repo = _make_repo(tmp_path)
    LessonWriter, _, _ = _get_tools(repo)

    result = LessonWriter.entrypoint(
        slug="lesson-1",
        title="Rust 入门",
        lesson_md=_lesson_md(),
    )
    assert result.startswith("LessonWriter 失败：缺少 num")
    assert not repo.lessons_dir.exists()
    assert not repo.manifest_path.exists()


def test_LessonWriter_missing_slug_or_title_returns_error(tmp_path):
    """写课正文缺 slug / title → 返回错误说明。"""
    repo = _make_repo(tmp_path)
    LessonWriter, _, _ = _get_tools(repo)

    assert "缺少 slug" in LessonWriter.entrypoint(
        num=1, title="t", lesson_md=_lesson_md()
    )
    assert "缺少 title" in LessonWriter.entrypoint(
        num=1, slug="lesson-1", lesson_md=_lesson_md()
    )


def test_LessonWriter_no_artifacts_returns_empty(tmp_path):
    """未提供任何产物 → 返回空串，不写盘。"""
    repo = _make_repo(tmp_path)
    LessonWriter, _, _ = _get_tools(repo)
    assert LessonWriter.entrypoint() == ""
    assert not repo.root.exists()


# ── LessonWriter 分发器：conflict 与 update_lesson ───────────────────────


def test_LessonWriter_conflict_when_target_exists(tmp_path):
    """目标已存在且未传 update_lesson → 返回冲突提示，不覆盖。"""
    repo = _make_repo(tmp_path)
    LessonWriter, _, _ = _get_tools(repo)

    LessonWriter.entrypoint(
        num=1, slug="lesson-1", title="t", lesson_md="# v1"
    )
    conflict = LessonWriter.entrypoint(
        num=1, slug="lesson-1", title="t", lesson_md="# v2"
    )

    assert conflict.startswith("LessonWriter 冲突")
    assert "update_lesson" in conflict
    assert (repo.lessons_dir / "0001-lesson-1.md").read_text() == "# v1"


def test_LessonWriter_update_lesson_overwrites(tmp_path):
    """已存在 + update_lesson=True → 覆盖重写，返回落盘文件名。"""
    repo = _make_repo(tmp_path)
    LessonWriter, _, _ = _get_tools(repo)

    LessonWriter.entrypoint(
        num=1, slug="lesson-1", title="t", lesson_md="# v1"
    )
    result = LessonWriter.entrypoint(
        num=1,
        slug="lesson-1",
        title="t",
        lesson_md="# v2",
        update_lesson=True,
    )

    assert result == "0001-lesson-1.md"
    assert (repo.lessons_dir / "0001-lesson-1.md").read_text() == "# v2"


def test_LessonWriter_invalid_returns_error_message(tmp_path):
    """num 越界 / slug 非法 → 返回参数非法说明。"""
    repo = _make_repo(tmp_path)
    LessonWriter, _, _ = _get_tools(repo)

    assert "参数非法" in LessonWriter.entrypoint(
        num=0, slug="lesson-1", title="t", lesson_md=_lesson_md()
    )
    assert "参数非法" in LessonWriter.entrypoint(
        num=1, slug="Bad Slug", title="t", lesson_md=_lesson_md()
    )
    assert not repo.lessons_dir.exists()


# ── ExerciseWriter ───────────────────────────────────────────────────────


def test_ExerciseWriter_writes_paired_file(tmp_path):
    """ExerciseWriter(num, slug, JSON) → 落盘 <num>-<slug>.exercise.md。"""
    repo = _make_repo(tmp_path)
    LessonWriter, ExerciseWriter, _ = _get_tools(repo)

    filename = LessonWriter.entrypoint(
        num=1, slug="lesson-1", title="t", lesson_md=_lesson_md()
    )
    num = int(filename[:4])
    slug = filename[5:-3]
    result = ExerciseWriter.entrypoint(
        num=num, slug=slug, exercises=_exercises_json()
    )

    assert result == "0001-lesson-1.exercise.md"
    parsed = repo.read_exercises(num, slug)
    assert len(parsed) == 1
    assert parsed[0].answer == "B"


def test_ExerciseWriter_invalid_json_returns_error(tmp_path):
    """exercises 不是合法 JSON → 返回错误说明，不落盘。"""
    repo = _make_repo(tmp_path)
    _, ExerciseWriter, _ = _get_tools(repo)

    result = ExerciseWriter.entrypoint(
        num=1, slug="lesson-1", exercises="not json{"
    )
    assert result.startswith("ExerciseWriter 失败")
    assert not (repo.lessons_dir / "0001-lesson-1.exercise.md").exists()


def test_ExerciseWriter_invalid_field_returns_error(tmp_path):
    """exercises 是 JSON 但字段不符 Exercise 规范 → 返回错误说明。"""
    repo = _make_repo(tmp_path)
    _, ExerciseWriter, _ = _get_tools(repo)

    bad = json.dumps(
        [
            {
                "id": 1,
                "type": "single_choice",
                "difficulty": 9,  # difficulty 1..3，越界
                "prompt": "?",
            }
        ],
        ensure_ascii=False,
    )
    result = ExerciseWriter.entrypoint(num=1, slug="lesson-1", exercises=bad)
    assert result.startswith("ExerciseWriter 失败")
    assert not (repo.lessons_dir / "0001-lesson-1.exercise.md").exists()


def test_ExerciseWriter_validates_exercise_type(tmp_path):
    """非法 JSON 项被 Exercise.model_validate 拒绝（整单报错，不全写）。"""
    repo = _make_repo(tmp_path)
    _, ExerciseWriter, _ = _get_tools(repo)

    bad = json.dumps([{"id": "x", "type": "unknown", "prompt": "?"}])
    result = ExerciseWriter.entrypoint(num=1, slug="lesson-1", exercises=bad)
    assert result.startswith("ExerciseWriter 失败")
