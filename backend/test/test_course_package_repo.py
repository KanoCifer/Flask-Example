"""Direct tests for ``app.repositories.course_package_repo.CoursePackageRepo``.

C1 深化 + issue #29 无状态化后，课程包的写路径（显式编号 / 冲突 / 覆盖 /
manifest / 原子写）全部由仓库确定性控制，测试直测真实仓库，覆盖：

- 写路径：显式编号（``LessonWriter(num, slug, title, lesson_md)``）、冲突
  （``status="conflict"`` 不写盘）、覆盖重写（``update_lesson=True`` →
  ``status="updated"``）、非法参数（``status="invalid"``）、manifest.json 原子
  更新、``mission_md`` / ``resource_md`` 顺带覆盖写、原子写（无 ``.tmp`` 残留）。
- 读路径：``assemble_lessons`` 排序装配（标题 = manifest → front matter 兜底 →
  slug 美化）、``find_lesson``、``read_mission`` / ``read_resource``。
- 命名契约：``<num:04d>-<slug>.md`` 与 ``.exercise.md`` 同源配对，占位文件 /
  exercise 文件不计入编号。

仓库方法是同步磁盘 I/O，测试不用 event loop。
"""

from __future__ import annotations

import json
from pathlib import Path

from app.repositories.course_package_repo import (
    CoursePackageRepo,
    _parse_exercises,
    _render_exercise_md,
)
from app.schemas.learning import Exercise

# ── 本地 builders ────────────────────────────────────────────────────────


def _make_repo(
    tmp_path: Path, course_id: str = "c--00000001"
) -> CoursePackageRepo:
    """构造指向 ``tmp_path/<course_id>`` 的仓库实例（每测试独立临时目录）。"""
    return CoursePackageRepo(course_id=course_id, tmp_dir=tmp_path)


def _single_choice_exercise() -> Exercise:
    return Exercise(
        id=1,
        type="single_choice",
        difficulty=1,
        points=20,
        prompt="Rust 中 ? 是什么操作符?",
        options=[
            {"key": "A", "text": "三元"},
            {"key": "B", "text": "错误传播"},
            {"key": "C", "text": "解构"},
            {"key": "D", "text": "宏调用"},
        ],
        answer="B",
        explanation="? 是 Try trait 的语法糖,用于错误传播。",
    )


def _multi_choice_exercise() -> Exercise:
    return Exercise(
        id=2,
        type="multi_choice",
        difficulty=3,
        points=30,
        prompt="下列哪些是 Rust 的所有权规则?",
        options=[
            {"key": "A", "text": "每个值有唯一所有者"},
            {"key": "B", "text": "可以多个可变借用共存"},
            {"key": "C", "text": "不可变借用可以多个"},
            {"key": "D", "text": "所有者离开作用域值被丢弃"},
        ],
        answer=["A", "C", "D"],
        explanation="所有权三规则:A/C/D;B 错在不能多个可变借用共存。",
    )


def _true_false_exercise() -> Exercise:
    return Exercise(
        id=3,
        type="true_false",
        difficulty=1,
        points=20,
        prompt="Rust 默认栈分配。",
        options=None,
        answer=False,
        explanation="Rust 默认栈分配是错误的,所有权语义基于 move。",
    )


def _lesson_md(course_id: str, *, num: int = 1) -> str:
    """第 N 课的 body（issue #29：无 front matter，标题由 manifest 提供）。"""
    return f"# Rust 入门 · 第 {num} 课\n\n第 {num} 课内容…\n"


def _lesson_title(num: int = 1) -> str:
    return f"Rust 入门 · 第 {num} 课"


def _LessonWriter(
    repo: CoursePackageRepo,
    *,
    num: int = 1,
    slug: str = "lesson-1",
    mission_md: str | None = None,
    resource_md: str | None = None,
):
    """helper：按新 API 写一课正文（默认 num=1 / slug=lesson-1）。"""
    return repo.LessonWriter(
        num=num,
        slug=slug,
        title=_lesson_title(num),
        lesson_md=_lesson_md("c--1", num=num),
        mission_md=mission_md,
        resource_md=resource_md,
    )


# ── 布局 / 根目录 ───────────────────────────────────────────────────────


def test_repo_resolves_root_from_tmp_dir(tmp_path):
    """``tmp_dir`` 注入 → ``root = tmp_dir / course_id``，各路径派生正确。"""
    repo = _make_repo(tmp_path, course_id="rust--aaaabbbb")
    assert repo.root == tmp_path / "rust--aaaabbbb"
    assert repo.lessons_dir == repo.root / "lessons"
    assert repo.resource_path == repo.root / "RESOURCE.md"
    assert repo.mission_path == repo.root / "MISSION.md"
    assert repo.manifest_path == repo.root / "manifest.json"


def test_has_lessons_and_resource_reflect_disk(tmp_path):
    repo = _make_repo(tmp_path)
    assert repo.has_lessons() is False
    assert repo.has_resource() is False
    _LessonWriter(repo)
    repo.write_resource("# resource")
    assert repo.has_lessons() is True
    assert repo.has_resource() is True


# ── 写路径：显式编号 / manifest / 冲突 / 覆盖 / 非法 ────────────────────


def test_LessonWriter_written_and_returns_result(tmp_path):
    """空课程包按显式编号写第一课 → status="written"，文件按约定落盘。"""
    repo = _make_repo(tmp_path)
    written = repo.LessonWriter(
        num=1,
        slug="lesson-1",
        title="Rust 入门",
        lesson_md="# Rust 入门\n\n正文…",
    )

    assert written.status == "written"
    assert written.num == 1
    assert written.slug == "lesson-1"
    assert written.filename == "0001-lesson-1.md"
    assert written.message is None
    assert (repo.lessons_dir / "0001-lesson-1.md").read_text() == (
        "# Rust 入门\n\n正文…"
    )


def test_LessonWriter_updates_manifest(tmp_path):
    """写课正文同时原子写 manifest.json：``{"lessons": {"<num>": {title, slug}}}``。"""
    repo = _make_repo(tmp_path)
    _LessonWriter(repo, num=1)
    _LessonWriter(repo, num=2, slug="lesson-2")

    payload = json.loads(repo.manifest_path.read_text(encoding="utf-8"))
    assert payload["lessons"] == {
        "1": {"title": _lesson_title(1), "slug": "lesson-1"},
        "2": {"title": _lesson_title(2), "slug": "lesson-2"},
    }


def test_LessonWriter_explicit_nums(tmp_path):
    """编号由调用方显式提供：num=1 / num=2 各自落盘，不自动递增。"""
    repo = _make_repo(tmp_path)
    _LessonWriter(repo, num=1)
    w2 = _LessonWriter(repo, num=2, slug="lesson-2")

    assert w2.status == "written"
    assert w2.filename == "0002-lesson-2.md"
    assert (repo.lessons_dir / "0002-lesson-2.md").exists()


def test_LessonWriter_conflict_when_target_exists(tmp_path):
    """目标文件已存在且 update_lesson=False → status="conflict"，不写盘。"""
    repo = _make_repo(tmp_path)
    _LessonWriter(repo, num=1)
    original = (repo.lessons_dir / "0001-lesson-1.md").read_text()

    conflict = repo.LessonWriter(
        num=1,
        slug="lesson-1",
        title="重写标题",
        lesson_md="# 新的正文",
        update_lesson=False,
    )

    assert conflict.status == "conflict"
    assert conflict.num == 1
    assert conflict.slug == "lesson-1"
    assert conflict.filename == "0001-lesson-1.md"
    assert conflict.message is not None
    # 不写盘：原文件与 manifest 均未被覆盖
    assert (repo.lessons_dir / "0001-lesson-1.md").read_text() == original
    payload = json.loads(repo.manifest_path.read_text(encoding="utf-8"))
    assert payload["lessons"]["1"]["title"] == _lesson_title(1)


def test_LessonWriter_update_overwrites(tmp_path):
    """已存在 + update_lesson=True → status="updated"，覆盖写 + manifest 更新。"""
    repo = _make_repo(tmp_path)
    _LessonWriter(repo, num=1)

    updated = repo.LessonWriter(
        num=1,
        slug="lesson-1",
        title="Rust 入门（修订）",
        lesson_md="# Rust 入门（修订）\n\n修订正文…",
        update_lesson=True,
    )

    assert updated.status == "updated"
    assert (repo.lessons_dir / "0001-lesson-1.md").read_text() == (
        "# Rust 入门（修订）\n\n修订正文…"
    )
    payload = json.loads(repo.manifest_path.read_text(encoding="utf-8"))
    assert payload["lessons"]["1"]["title"] == "Rust 入门（修订）"


def test_LessonWriter_invalid_num(tmp_path):
    """num 越界（<1 / >9999 / 非整数）→ status="invalid"，不写盘。"""
    repo = _make_repo(tmp_path)
    for bad in (0, -1, 10000):
        result = repo.LessonWriter(
            num=bad, slug="lesson-1", title="t", lesson_md="# t"
        )
        assert result.status == "invalid"
        assert result.message is not None
    assert not (repo.lessons_dir / "0001-lesson-1.md").exists()
    assert not repo.manifest_path.exists()


def test_LessonWriter_invalid_slug(tmp_path):
    """slug 不匹配 [a-z0-9][a-z0-9-]* → status="invalid"，不写盘。"""
    repo = _make_repo(tmp_path)
    for bad in ("Lesson-1", "lesson_1", "lesson 1", "-lead"):
        result = repo.LessonWriter(num=1, slug=bad, title="t", lesson_md="# t")
        assert result.status == "invalid", f"slug={bad!r} 应被拒绝"
        assert result.message is not None
    assert not (repo.lessons_dir / "0001-lesson-1.md").exists()


def test_LessonWriter_writes_mission_and_resource(tmp_path):
    """mission_md / resource_md 提供 → 覆盖写对应文件（always）。"""
    repo = _make_repo(tmp_path)
    _LessonWriter(repo, mission_md="# Mission: Rust", resource_md="# 速查")

    assert repo.read_mission() == "# Mission: Rust"
    assert repo.read_resource() == "# 速查"


def test_LessonWriter_is_atomic_no_tmp_residue(tmp_path):
    """原子写：正文 / resource / MISSION / manifest 写盘后不留 ``.tmp`` 残留。"""
    repo = _make_repo(tmp_path)
    _LessonWriter(repo, mission_md="# mission", resource_md="# resource")

    assert list(repo.lessons_dir.glob("*.tmp")) == []
    assert list(repo.root.glob("*.tmp")) == []


def test_next_lesson_num_from_disk(tmp_path):
    """编号 = 最大 lesson 编号 + 1；占位 / exercise 文件不计入。"""
    repo = _make_repo(tmp_path)
    assert repo.next_lesson_num() == 1

    _LessonWriter(repo, num=1)
    (repo.lessons_dir / "0002-PENDING.md").write_text("# placeholder")
    (repo.lessons_dir / "0001-lesson-1.exercise.md").write_text("---\n---")

    # 0002-PENDING.md 命中 glob 但被命名正则拒绝 → 不计入编号
    assert repo.lesson_ids() == [1]
    assert repo.next_lesson_num() == 2


# ── find_lesson / exercise 配对 / 装配 ──────────────────────────────────


def test_find_lesson_returns_pair_for_existing(tmp_path):
    """find_lesson：扫 lessons/ 按 _LESSON_FILE_RE 取 (num, slug)。"""
    repo = _make_repo(tmp_path)
    assert repo.find_lesson(1) is None

    _LessonWriter(repo, num=1)
    _LessonWriter(repo, num=2, slug="lesson-2")
    assert repo.find_lesson(1) == (1, "lesson-1")
    assert repo.find_lesson(2) == (2, "lesson-2")
    assert repo.find_lesson(3) is None


def test_ExerciseWriter_pairs_with_lesson_and_assembles(tmp_path):
    """ExerciseWriter(num, slug) 同名配对 → assemble 带回题目。"""
    repo = _make_repo(tmp_path)
    written = _LessonWriter(repo, num=1)
    repo.ExerciseWriter(
        num=written.num,
        slug=written.slug,
        exercises=[_single_choice_exercise()],
    )

    items = repo.assemble_lessons()
    assert len(items) == 1
    assert items[0].id == 1
    assert items[0].slug == "lesson-1"
    # 标题来自 manifest
    assert items[0].title == _lesson_title(1)
    assert len(items[0].exercises) == 1
    assert items[0].exercises[0].answer == "B"


def test_ExerciseWriter_default_title(tmp_path):
    """ExerciseWriter 的 title 默认为「课程练习」，仍可读回题目。"""
    repo = _make_repo(tmp_path)
    written = _LessonWriter(repo, num=1)
    filename = repo.ExerciseWriter(
        num=written.num,
        slug=written.slug,
        exercises=[_single_choice_exercise()],
    )
    assert filename == "0001-lesson-1.exercise.md"
    parsed = repo.read_exercises(written.num, written.slug)
    assert len(parsed) == 1


def test_assemble_lessons_sorted_by_id(tmp_path):
    """多课装配按编号升序，resource / MISSION 独立文件不混入 lessons。"""
    repo = _make_repo(tmp_path)
    _LessonWriter(repo, num=1)
    _LessonWriter(repo, num=2, slug="lesson-2")
    repo.write_resource("# resource")
    repo.write_mission("# mission")

    items = repo.assemble_lessons()
    assert [lsn.id for lsn in items] == [1, 2]
    assert [lsn.slug for lsn in items] == ["lesson-1", "lesson-2"]
    assert [lsn.title for lsn in items] == [
        _lesson_title(1),
        _lesson_title(2),
    ]


def test_assemble_lessons_title_falls_back_to_front_matter(tmp_path):
    """旧课程（含 front matter、无 manifest）→ 标题兜底取 front matter title。"""
    repo = _make_repo(tmp_path)
    (repo.lessons_dir).mkdir(parents=True, exist_ok=True)
    (repo.lessons_dir / "0001-old-lesson.md").write_text(
        "---\n"
        "title: 旧课标题\n"
        "course_id: c--1\n"
        "slug: old-lesson\n"
        "---\n"
        "# 旧课标题\n\n正文…\n",
        encoding="utf-8",
    )

    items = repo.assemble_lessons()
    assert len(items) == 1
    assert items[0].slug == "old-lesson"
    assert items[0].title == "旧课标题"


def test_assemble_lessons_title_falls_back_to_slug(tmp_path):
    """无 manifest 也无 front matter → 标题兜底为 slug 美化（- → 空格）。"""
    repo = _make_repo(tmp_path)
    (repo.lessons_dir).mkdir(parents=True, exist_ok=True)
    (repo.lessons_dir / "0001-rust-ownership.md").write_text(
        "# Rust 所有权\n\n正文…\n",
        encoding="utf-8",
    )

    items = repo.assemble_lessons()
    assert items[0].title == "rust ownership"


# ── 读路径 ──────────────────────────────────────────────────────────────


def test_read_exercises_reads_paired_file(tmp_path):
    """read_exercises：读回 ExerciseWriter 落盘的练习题；缺失返回空列表。"""
    repo = _make_repo(tmp_path)
    written = _LessonWriter(repo, num=1)
    assert repo.read_exercises(written.num, written.slug) == []

    repo.ExerciseWriter(
        num=written.num,
        slug=written.slug,
        exercises=[_single_choice_exercise()],
    )
    parsed = repo.read_exercises(written.num, written.slug)
    assert len(parsed) == 1
    assert parsed[0].answer == "B"


def test_read_mission_missing_returns_none(tmp_path):
    repo = _make_repo(tmp_path)
    assert repo.read_mission() is None
    repo.write_mission("# mission")
    assert repo.read_mission() == "# mission"


def test_write_mission_always_overwrites(tmp_path):
    """MISSION.md 已存在 → 再次 write_mission 覆盖写（issue #29 由幂等改掉）。"""
    repo = _make_repo(tmp_path)
    assert repo.write_mission("# mission") == "MISSION.md"
    assert repo.write_mission("# 新的 mission") == "MISSION.md"
    assert repo.read_mission() == "# 新的 mission"


def test_write_resource_overwrites(tmp_path):
    """RESOURCE.md 覆盖写：第二次写盘替换第一次内容。"""
    repo = _make_repo(tmp_path)
    repo.write_resource("# r1")
    repo.write_resource("# r2")
    assert repo.read_resource() == "# r2"


# ── 原始文件清单 / 单文件读取 ────────────────────────────────────────────


def test_list_course_files_empty_package(tmp_path):
    """空课程包 → 空清单（lessons 目录不存在 / 无顶层 md）。"""
    repo = _make_repo(tmp_path)
    assert repo.list_course_files() == []


def test_list_course_files_lessons_resource_mission(tmp_path):
    """多课 + resource + MISSION → 目录优先、同目录按文件名、rel_path 正斜杠。"""
    repo = _make_repo(tmp_path)
    _LessonWriter(repo, num=1)
    _LessonWriter(repo, num=2, slug="lesson-2")
    repo.write_resource("# resource")
    repo.write_mission("# mission")

    entries = repo.list_course_files()
    assert [e.rel_path for e in entries] == [
        "lessons/0001-lesson-1.md",
        "lessons/0002-lesson-2.md",
        "MISSION.md",
        "RESOURCE.md",
    ]
    assert entries[0].name == "0001-lesson-1.md"
    assert entries[0].size > 0
    assert entries[0].mtime > 0


def test_list_course_files_omits_missing_top_level(tmp_path):
    """resource / MISSION 缺失时不出现在清单，lessons 仍列出。"""
    repo = _make_repo(tmp_path)
    _LessonWriter(repo, num=1)
    assert [e.rel_path for e in repo.list_course_files()] == [
        "lessons/0001-lesson-1.md"
    ]


def test_read_course_file_returns_path_and_name(tmp_path):
    """合法 rel_path → (absolute_path, display_name)，内容可读。"""
    repo = _make_repo(tmp_path)
    _LessonWriter(repo, num=1)

    result = repo.read_course_file("lessons/0001-lesson-1.md")
    assert result is not None
    path, name = result
    assert name == "0001-lesson-1.md"
    assert path == repo.root / "lessons" / "0001-lesson-1.md"
    assert path.read_text() == _lesson_md("c--1")

    # 顶层 md 也可读
    repo.write_resource("# resource")
    assert repo.read_course_file("RESOURCE.md") is not None


def test_read_course_file_rejects_path_traversal(tmp_path):
    """``..`` / 绝对路径 / 空字节 → 一律 None（防目录穿越）。"""
    repo = _make_repo(tmp_path)
    _LessonWriter(repo, num=1)

    assert repo.read_course_file("../etc/passwd") is None
    assert repo.read_course_file("lessons/../../etc/passwd") is None
    assert repo.read_course_file("/etc/passwd") is None
    assert repo.read_course_file("lessons/\x00foo.md") is None
    assert repo.read_course_file("") is None


def test_read_course_file_rejects_escape_via_dot_suffix(tmp_path):
    """``.md`` 后缀但越出 root（``../foo.md``）→ None（commonpath 拦截）。"""
    repo = _make_repo(tmp_path)
    assert repo.read_course_file("../foo.md") is None
    # symlink 逃逸：root 内指向 root 外文件的链接也拒绝
    outside = tmp_path / "outside.md"
    outside.write_text("# outside")
    link = repo.root / "lessons"
    link.mkdir(parents=True, exist_ok=True)
    (link / "escape.md").symlink_to(outside)
    assert repo.read_course_file("lessons/escape.md") is None


def test_read_course_file_rejects_non_md_suffix(tmp_path):
    """非 ``.md`` 后缀（含 txt / 无后缀）→ None。"""
    repo = _make_repo(tmp_path)
    _LessonWriter(repo, num=1)
    (repo.lessons_dir / "0002-notes.txt").write_text("notes")

    assert repo.read_course_file("lessons/0002-notes.txt") is None
    assert repo.read_course_file("lessons/0001-lesson-1.md.bak") is None


def test_read_course_file_missing_returns_none(tmp_path):
    """存在的目录 + 不存在的文件 → None。"""
    repo = _make_repo(tmp_path)
    _LessonWriter(repo, num=1)
    assert repo.read_course_file("lessons/9999-nope.md") is None
    assert repo.read_course_file("lessons/0001-lesson-1.md") is not None


# ── exercise md 纯函数 round trip ───────────────────────────────────────


def test_render_exercise_md_round_trip():
    """_render_exercise_md 序列化 → _parse_exercises 反序列化应字段一致。"""
    course_id = "rust--abcd1234"
    exercises = [
        _single_choice_exercise(),
        _multi_choice_exercise(),
        _true_false_exercise(),
    ]

    md = _render_exercise_md(
        title="课程练习:Rust 入门",
        course_id=course_id,
        exercises=exercises,
    )
    parsed = _parse_exercises(md)

    assert len(parsed) == 3
    # 单选:answer 应是 str
    assert parsed[0].type == "single_choice"
    assert parsed[0].answer == "B"
    # 多选:answer 应是 list[str]
    assert parsed[1].type == "multi_choice"
    assert sorted(parsed[1].answer) == ["A", "C", "D"]
    # 判断:answer 应是 bool
    assert parsed[2].type == "true_false"
    assert parsed[2].answer is False


def test_parse_exercises_returns_empty_when_no_front_matter():
    assert _parse_exercises("# 只有正文\n没有 front matter\n") == []


def test_parse_exercises_ignores_malformed_items():
    md = _render_exercise_md(
        title="T",
        course_id="c--00000001",
        exercises=[_single_choice_exercise()],
    )
    # 在 front matter 注入一条非法 exercise 看是否被跳过
    md = md.replace(
        "answer: B",
        "answer: B\n  - bogus_extra_field: oops",
        1,
    )
    parsed = _parse_exercises(md)
    # _parse_exercises 容错:非法项被跳过,合法项仍能解析
    assert isinstance(parsed, list)
