"""Direct tests for ``app.repositories.course_package_repo.CoursePackageRepo``.

C1 深化前，课程包的写路径（编号推断 / 幂等 / 原子写）埋在 agno @tool 闭包里，
真实实现零覆盖——测试只能靠 :class:`_StubAgent` 重新实现写语义，与生产逻辑有
漂移风险。本文件直测真实仓库，覆盖：

- 写路径：编号（``next_lesson_num`` = 磁盘最大 + 1）、幂等（``skipped``）、
  原子写（无 ``.tmp`` 残留）、:attr:`last_written_lesson` 显式交接。
- 读路径：``assemble_lessons`` 排序装配、``read_previous_lesson``（ZPD）、
  ``read_mission`` / ``read_resource``。
- 命名契约：``<num:04d>-<slug>.md`` 与 ``.exercise.md`` 同源配对，占位文件 /
  exercise 文件不计入编号。

仓库方法是同步磁盘 I/O，测试不用 event loop。
"""

from __future__ import annotations

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
    """第 N 课的 body:title 反映序号,便于 front-matter 解析断言。"""
    return (
        "---\n"
        f"title: Rust 入门 · 第 {num} 课\n"
        f"course_id: {course_id}\n"
        f"slug: lesson-{num}\n"
        "language: zh\n"
        "---\n"
        f"# Rust 入门 · 第 {num} 课\n\n"
        f"第 {num} 课内容…\n"
    )


# ── 布局 / 根目录 ───────────────────────────────────────────────────────


def test_repo_resolves_root_from_tmp_dir(tmp_path):
    """``tmp_dir`` 注入 → ``root = tmp_dir / course_id``，各路径派生正确。"""
    repo = _make_repo(tmp_path, course_id="rust--aaaabbbb")
    assert repo.root == tmp_path / "rust--aaaabbbb"
    assert repo.lessons_dir == repo.root / "lessons"
    assert repo.resource_path == repo.root / "resource.md"
    assert repo.mission_path == repo.root / "MISSION.md"


def test_has_lessons_and_resource_reflect_disk(tmp_path):
    repo = _make_repo(tmp_path)
    assert repo.has_lessons() is False
    assert repo.has_resource() is False
    repo.write_lesson(slug="lesson-1", lesson_md=_lesson_md("c--1"))
    repo.write_resource("# resource")
    assert repo.has_lessons() is True
    assert repo.has_resource() is True


# ── 写路径：编号 / 幂等 / 原子写 ────────────────────────────────────────


def test_write_lesson_first_num_is_1_and_returns_written(tmp_path):
    """空课程包写第一课 → num=1，返回显式 WrittenLesson，文件按约定落盘。"""
    repo = _make_repo(tmp_path)
    written = repo.write_lesson(slug="lesson-1", lesson_md=_lesson_md("c--1"))

    assert written.skipped is False
    assert written.num == 1
    assert written.slug == "lesson-1"
    assert written.filename == "0001-lesson-1.md"
    assert (repo.lessons_dir / "0001-lesson-1.md").read_text() == _lesson_md(
        "c--1"
    )


def test_write_lesson_increments_num_after_existing(tmp_path):
    """已有第 1 课 → 第二课 num=2（磁盘最大编号 + 1）。"""
    repo = _make_repo(tmp_path)
    repo.write_lesson(slug="lesson-1", lesson_md=_lesson_md("c--1"))
    written2 = repo.write_lesson(
        slug="lesson-2", lesson_md=_lesson_md("c--1", num=2)
    )

    assert written2.num == 2
    assert written2.filename == "0002-lesson-2.md"
    assert (repo.lessons_dir / "0002-lesson-2.md").exists()


def test_write_lesson_is_idempotent_when_next_num_placeholder_exists(tmp_path):
    """race 场景：next_num 对应占位文件已存在 → skipped=True，不重复写。

    ``0002-PENDING.md`` 命中 ``startswith("0002-")`` 但被命名正则拒绝，所以
    lesson_ids 仍 = [1]、next_num = 2 → 占位文件存在 → 幂等跳过（原文件不被
    覆盖，也不写入 0002-lesson-2.md）。
    """
    repo = _make_repo(tmp_path)
    repo.write_lesson(slug="lesson-1", lesson_md=_lesson_md("c--1"))
    (repo.lessons_dir / "0002-PENDING.md").write_text("# race placeholder")

    skipped = repo.write_lesson(
        slug="lesson-2", lesson_md=_lesson_md("c--1", num=2)
    )

    assert skipped.skipped is True
    assert skipped.num == 2
    assert skipped.slug is None
    assert skipped.filename is None
    assert not (repo.lessons_dir / "0002-lesson-2.md").exists()
    # 占位文件保持原样
    assert (
        repo.lessons_dir / "0002-PENDING.md"
    ).read_text() == "# race placeholder"


def test_write_lesson_is_atomic_no_tmp_residue(tmp_path):
    """原子写：正文写盘后不留 ``.tmp`` 临时文件。"""
    repo = _make_repo(tmp_path)
    repo.write_lesson(slug="lesson-1", lesson_md=_lesson_md("c--1"))
    repo.write_resource("# resource")
    repo.write_mission("# mission")

    assert list(repo.lessons_dir.glob("*.tmp")) == []
    assert list(repo.root.glob("*.tmp")) == []


def test_next_lesson_num_from_disk(tmp_path):
    """编号 = 最大 lesson 编号 + 1；占位 / exercise 文件不计入。"""
    repo = _make_repo(tmp_path)
    assert repo.next_lesson_num() == 1

    repo.write_lesson(slug="lesson-1", lesson_md=_lesson_md("c--1"))
    (repo.lessons_dir / "0002-PENDING.md").write_text("# placeholder")
    (repo.lessons_dir / "0001-lesson-1.exercise.md").write_text("---\n---")

    # 0002-PENDING.md 命中 glob 但被命名正则拒绝 → 不计入编号
    assert repo.lesson_ids() == [1]
    assert repo.next_lesson_num() == 2


def test_last_written_lesson_tracks_only_successful_write(tmp_path):
    """service 显式交接的锚点：只记录成功写盘；幂等 skip 不清掉首次结果。"""
    repo = _make_repo(tmp_path)
    assert repo.last_written_lesson is None

    written = repo.write_lesson(slug="lesson-1", lesson_md=_lesson_md("c--1"))
    assert repo.last_written_lesson == written

    # 幂等 skip（next_num 占位文件存在）→ 不覆盖 last_written，仍指向首次成功
    # 写盘的结果（service 据此配对 exercise）。
    (repo.lessons_dir / "0002-PENDING.md").write_text("# race placeholder")
    repo.write_lesson(slug="lesson-2", lesson_md=_lesson_md("c--1", num=2))
    assert repo.last_written_lesson == written
    assert repo.last_written_lesson.num == 1
    assert repo.last_written_lesson.slug == "lesson-1"


# ── exercise 配对 / 装配 ────────────────────────────────────────────────


def test_write_exercise_pairs_with_lesson_and_assembles(tmp_path):
    """write_lesson 返回 (num, slug) → write_exercise 同名配对 → assemble 带回题目。"""
    repo = _make_repo(tmp_path)
    written = repo.write_lesson(slug="lesson-1", lesson_md=_lesson_md("c--1"))
    repo.write_exercise(
        num=written.num,
        slug=written.slug,
        title="课程练习:c--1",
        exercises=[_single_choice_exercise()],
    )

    items = repo.assemble_lessons()
    assert len(items) == 1
    assert items[0].id == 1
    assert items[0].slug == "lesson-1"
    # 标题从 lesson front matter 解析
    assert items[0].title == "Rust 入门 · 第 1 课"
    assert len(items[0].exercises) == 1
    assert items[0].exercises[0].answer == "B"


def test_assemble_lessons_sorted_by_id(tmp_path):
    """多课装配按编号升序，resource / MISSION 独立文件不混入 lessons。"""
    repo = _make_repo(tmp_path)
    repo.write_lesson(slug="lesson-1", lesson_md=_lesson_md("c--1"))
    repo.write_lesson(slug="lesson-2", lesson_md=_lesson_md("c--1", num=2))
    repo.write_resource("# resource")
    repo.write_mission("# mission")

    items = repo.assemble_lessons()
    assert [lsn.id for lsn in items] == [1, 2]
    assert [lsn.slug for lsn in items] == ["lesson-1", "lesson-2"]


# ── 读路径 ──────────────────────────────────────────────────────────────


def test_read_previous_lesson_returns_last_lesson(tmp_path):
    """ZPD：读最大编号 lesson 的 md 全文；空课程包返回空字符串。"""
    repo = _make_repo(tmp_path)
    assert repo.read_previous_lesson() == ""

    repo.write_lesson(slug="lesson-1", lesson_md=_lesson_md("c--1"))
    repo.write_lesson(slug="lesson-2", lesson_md=_lesson_md("c--1", num=2))
    assert repo.read_previous_lesson() == _lesson_md("c--1", num=2)


def test_read_exercises_reads_paired_file(tmp_path):
    """read_exercises：读回 write_exercise 落盘的练习题；缺失返回空列表。"""
    repo = _make_repo(tmp_path)
    written = repo.write_lesson(slug="lesson-1", lesson_md=_lesson_md("c--1"))
    assert repo.read_exercises(written.num, written.slug) == []

    repo.write_exercise(
        num=written.num,
        slug=written.slug,
        title="课程练习",
        exercises=[_single_choice_exercise()],
    )
    parsed = repo.read_exercises(written.num, written.slug)
    assert len(parsed) == 1
    assert parsed[0].answer == "B"


def test_latest_lesson_without_exercises_pairs_incomplete_lesson(tmp_path):
    """latest_lesson_without_exercises：只挑「有 body 缺练习」的最近一课；
    全部配对后返回 None。"""
    repo = _make_repo(tmp_path)
    assert repo.latest_lesson_without_exercises() is None

    w1 = repo.write_lesson(slug="lesson-1", lesson_md=_lesson_md("c--1"))
    repo.write_exercise(
        num=w1.num,
        slug=w1.slug,
        title="课程练习",
        exercises=[_single_choice_exercise()],
    )
    w2 = repo.write_lesson(slug="lesson-2", lesson_md=_lesson_md("c--1", num=2))
    # 第 1 课已配练习 → 最近缺练习的是第 2 课
    assert repo.latest_lesson_without_exercises() == (2, "lesson-2")

    repo.write_exercise(
        num=w2.num,
        slug=w2.slug,
        title="课程练习",
        exercises=[_multi_choice_exercise()],
    )
    assert repo.latest_lesson_without_exercises() is None


def test_read_mission_missing_returns_none(tmp_path):
    repo = _make_repo(tmp_path)
    assert repo.read_mission() is None
    repo.write_mission("# mission")
    assert repo.read_mission() == "# mission"


def test_write_mission_is_idempotent(tmp_path):
    """MISSION.md 已存在 → 返回 None（幂等），原内容不被覆盖。"""
    repo = _make_repo(tmp_path)
    assert repo.write_mission("# mission") == "MISSION.md"
    assert repo.write_mission("# 别的 mission") is None
    assert repo.read_mission() == "# mission"


def test_write_resource_overwrites(tmp_path):
    """resource.md 覆盖写：第二次写盘替换第一次内容。"""
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
    repo.write_lesson(slug="lesson-1", lesson_md=_lesson_md("c--1"))
    repo.write_lesson(slug="lesson-2", lesson_md=_lesson_md("c--1", num=2))
    repo.write_resource("# resource")
    repo.write_mission("# mission")

    entries = repo.list_course_files()
    assert [e.rel_path for e in entries] == [
        "lessons/0001-lesson-1.md",
        "lessons/0002-lesson-2.md",
        "MISSION.md",
        "resource.md",
    ]
    assert entries[0].name == "0001-lesson-1.md"
    assert entries[0].size > 0
    assert entries[0].mtime > 0


def test_list_course_files_omits_missing_top_level(tmp_path):
    """resource / MISSION 缺失时不出现在清单，lessons 仍列出。"""
    repo = _make_repo(tmp_path)
    repo.write_lesson(slug="lesson-1", lesson_md=_lesson_md("c--1"))
    assert [e.rel_path for e in repo.list_course_files()] == [
        "lessons/0001-lesson-1.md"
    ]


def test_read_course_file_returns_path_and_name(tmp_path):
    """合法 rel_path → (absolute_path, display_name)，内容可读。"""
    repo = _make_repo(tmp_path)
    repo.write_lesson(slug="lesson-1", lesson_md=_lesson_md("c--1"))

    result = repo.read_course_file("lessons/0001-lesson-1.md")
    assert result is not None
    path, name = result
    assert name == "0001-lesson-1.md"
    assert path == repo.root / "lessons" / "0001-lesson-1.md"
    assert path.read_text() == _lesson_md("c--1")

    # 顶层 md 也可读
    repo.write_resource("# resource")
    assert repo.read_course_file("resource.md") is not None


def test_read_course_file_rejects_path_traversal(tmp_path):
    """``..`` / 绝对路径 / 空字节 → 一律 None（防目录穿越）。"""
    repo = _make_repo(tmp_path)
    repo.write_lesson(slug="lesson-1", lesson_md=_lesson_md("c--1"))

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
    repo.write_lesson(slug="lesson-1", lesson_md=_lesson_md("c--1"))
    (repo.lessons_dir / "0002-notes.txt").write_text("notes")

    assert repo.read_course_file("lessons/0002-notes.txt") is None
    assert repo.read_course_file("lessons/0001-lesson-1.md.bak") is None


def test_read_course_file_missing_returns_none(tmp_path):
    """存在的目录 + 不存在的文件 → None。"""
    repo = _make_repo(tmp_path)
    repo.write_lesson(slug="lesson-1", lesson_md=_lesson_md("c--1"))
    assert repo.read_course_file("lessons/9999-nope.md") is None
    assert repo.read_course_file("lessons/0001-lesson-1.md") is not None


# ── exercise md 纯函数 round trip（从 test_learning_service 迁入） ───────


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
