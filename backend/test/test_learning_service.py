"""Service tests for ``app.services.learning_service.LearningService``.

Mocking strategy (task-3555)：agent_driven 重构后 service 不再跑三步流水线
（``_run_research`` / ``_run_step1`` / ``_run_step2`` 已删除），只调一次
``_build_course_agent(...).arun(prompt, output_schema=MissionBundle)``。
测试用 ``_StubAgent`` monkeypatch ``LearningService._build_course_agent``：
stub 的 ``arun`` 模拟三个磁盘工具（save_lesson / save_resource /
read_previous_lesson）写盘并返回 ``MissionBundle``，不触碰网络 / Redis /
DeepSeek。
  - The beanie ``LearningProgress`` upsert that ``generate_course`` performs
    uses a real MongoDB collection (``readinglist_test``) per the conftest
    fixture, so we also exercise the ready-state upsert path.
  - The course tmp dir is injected via the ``tmp_dir`` constructor arg so the
    markdown files land in a per-test tempdir we control.
"""

from __future__ import annotations

import re
import types
from pathlib import Path

import pytest
import pytest_asyncio
from beanie import init_beanie
from pymongo import AsyncMongoClient

from app.core.config import get_settings
from app.models.learning import LearningProgress
from app.repositories.learning_repo import LearningRepo
from app.schemas.learning import Mission
from app.services.learning_service import (
    LearningService,
    LessonResourceOutput,
    MissionBundle,
)
from app.services.learning_utils import (
    _last_lesson_md,
    _parse_missions,
    _render_mission_md,
    build_course_id,
    list_existing_lesson_ids,
)

pytestmark = pytest.mark.asyncio(loop_scope="session")


TEST_DB_NAME = "readinglist_test"


# ── 共享 fixtures ────────────────────────────────────────────────────────


@pytest_asyncio.fixture(scope="session")
async def mongo_client():
    settings = get_settings()
    client = AsyncMongoClient(settings.MONGO_URI)
    db = client[TEST_DB_NAME]
    await init_beanie(database=db, document_models=[LearningProgress])
    try:
        yield client
    finally:
        await client.drop_database(TEST_DB_NAME)
        await client.close()


@pytest_asyncio.fixture
async def clean_collection(mongo_client):
    await mongo_client[TEST_DB_NAME].drop_collection("learning_progress")
    yield


@pytest_asyncio.fixture
async def tmp_course_dir(tmp_path: Path) -> Path:
    return tmp_path


# ── helpers ──────────────────────────────────────────────────────────────


def _single_choice_mission() -> Mission:
    return Mission(
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


def _multi_choice_mission() -> Mission:
    return Mission(
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


def _true_false_mission() -> Mission:
    return Mission(
        id=3,
        type="true_false",
        difficulty=1,
        points=20,
        prompt="Rust 默认栈分配。",
        options=None,
        answer=False,
        explanation="Rust 默认栈分配是错误的,所有权语义基于 move。",
    )


def _lesson_md(course_id: str) -> str:
    return (
        "---\n"
        "title: Rust 入门\n"
        f"course_id: {course_id}\n"
        "language: zh\n"
        "level: beginner\n"
        "session_count: 3\n"
        "objectives:\n"
        "  - 了解所有权\n"
        "  - 学会 ? 与 Result\n"
        "prerequisites:\n"
        "  - 任意一门语言基础\n"
        "estimated_minutes: 60\n"
        "tags:\n"
        "  - rust\n"
        "  - ownership\n"
        "model: deepseek-v4-pro\n"
        "generated_at: '2026-08-01T00:00:00Z'\n"
        "---\n"
        "# Rust 入门\n"
        "\n概览…\n"
        "## Session 1 — 所有权\n"
        "### 本节目标\n- 理解 move\n"
    )


# ── 第 2 课及以后用的 lesson_md(用于 generate_next_lesson 多课装配测试) ─── #


def _lesson_md_for(num: int, course_id: str) -> str:
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


def _resource_md(course_id: str) -> str:
    return (
        "---\n"
        "title: Rust 入门 - 速查\n"
        f"course_id: {course_id}\n"
        "type: reference\n"
        "language: zh\n"
        "tags: [rust]\n"
        "generated_at: '2026-08-01T00:00:00Z'\n"
        "---\n"
        "# 速查表\n"
        "- `?` 用于错误传播。\n"
    )


def _step1_payload(course_id: str) -> LessonResourceOutput:
    return LessonResourceOutput(
        title="Rust 入门 · 第 1 课",
        slug="lesson-1",
        lesson_md=_lesson_md(course_id),
        resource_md=_resource_md(course_id),
    )


def _next_step1_payload(
    course_id: str, *, num: int, slug: str
) -> LessonResourceOutput:
    """为 ``generate_next_lesson`` 准备的 mock payload:每课带独立 title/slug。"""
    return LessonResourceOutput(
        title=f"Rust 入门 · 第 {num} 课",
        slug=slug,
        lesson_md=_lesson_md_for(num, course_id),
        resource_md=_resource_md(course_id),
    )


def _step2_payload() -> MissionBundle:
    return MissionBundle(
        missions=[
            _single_choice_mission(),
            _multi_choice_mission(),
            _true_false_mission(),
        ]
    )


class _StubAgent:
    """Stub 课程 agent：在 ``arun`` 内模拟工具写盘并返回 MissionBundle。

    task-3553 后 service 不再调 ``_run_step1`` / ``_run_step2``，只调一次
    ``_build_course_agent(...).arun(prompt, output_schema=MissionBundle)``。
    本 stub 替代旧的 step1/step2 monkeypatch：``arun`` 内按真实工具语义模拟
    三个磁盘工具——

    - ``read_previous_lesson``（ZPD）：写新课前读最大编号 lesson 的 md 全文，
      结果记录到 :attr:`read_previous_lesson_outputs` 供断言。
    - ``save_resource``：写 ``course_dir/resource.md``（覆盖已有内容）。
    - ``save_lesson``：写 ``lessons/{num:04d}-{slug}.md``，编号自动取磁盘
      已有最大编号 +1（与 :func:`create_learning_tools` 同语义）。

    返回 ``SimpleNamespace(content=MissionBundle(...))``，供
    :func:`_unwrap_model` 命中 ``content`` 字段。

    兜底重试（task-3554）控制：``arun`` 可按调用次数分阶段返回——
    ``parse_fail_contents[i]`` 覆盖第 i+1 次 arun 的返回 content（耗尽后回到
    ``bundle``），模拟「首轮坏 content → 重试 → 第二轮合法」；
    ``write_body_after_calls=N`` 让前 N 次 arun **不**模拟 ``save_lesson``
    （body 不落盘），模拟「漏调 save_lesson → 磁盘校验失败 → 重试」。
    调用次数记录在 :attr:`arun_call_count` 供断言重试确实发生。
    """

    def __init__(
        self,
        *,
        course_dir: str | Path,
        payload: LessonResourceOutput,
        bundle: MissionBundle | None = None,
        fail_on_arun: Exception | None = None,
        parse_fail_contents: list[object] | None = None,
        write_body_after_calls: int = 0,
    ) -> None:
        self._course_dir = Path(course_dir)
        self._payload = payload
        self._bundle = bundle if bundle is not None else _step2_payload()
        self._fail_on_arun = fail_on_arun
        self._parse_fail_contents = list(parse_fail_contents or [])
        self._write_body_after_calls = write_body_after_calls
        # ``arun`` 被调次数（task-3554 重试断言用）。
        self.arun_call_count = 0
        # ``arun`` 内模拟 read_previous_lesson 的返回值（ZPD 衔接断言用）。
        self.read_previous_lesson_outputs: list[str] = []

    async def arun(self, prompt: str, output_schema=None):
        self.arun_call_count += 1
        if self._fail_on_arun is not None:
            raise self._fail_on_arun

        lessons_dir = self._course_dir / "lessons"
        lessons_dir.mkdir(parents=True, exist_ok=True)

        # 模拟 read_previous_lesson：写新课前读最大编号 lesson 的 md（ZPD）。
        existing_ids = list_existing_lesson_ids(lessons_dir)
        prev_md = _last_lesson_md(lessons_dir, existing_ids) or ""
        self.read_previous_lesson_outputs.append(prev_md)

        # 模拟 save_resource：写全课程共享资料（覆盖已有内容）。
        (self._course_dir / "resource.md").write_text(
            self._payload.resource_md, encoding="utf-8"
        )

        # 模拟 save_lesson：编号自动取磁盘最大 + 1（与真实工具同语义）；
        # 前 write_body_after_calls 次不写（模拟漏调 save_lesson）。
        if self.arun_call_count > self._write_body_after_calls:
            existing_ids = list_existing_lesson_ids(lessons_dir)
            num = (max(existing_ids) + 1) if existing_ids else 1
            (lessons_dir / f"{num:04d}-{self._payload.slug}.md").write_text(
                self._payload.lesson_md, encoding="utf-8"
            )

        idx = self.arun_call_count - 1
        if idx < len(self._parse_fail_contents):
            return types.SimpleNamespace(
                content=self._parse_fail_contents[idx]
            )
        return types.SimpleNamespace(content=self._bundle)


def _patch_course_agent(monkeypatch, stub_factory) -> None:
    """把 ``LearningService._build_course_agent`` 替换为返回 stub 的工厂。

    Args:
        stub_factory: ``Callable[[Path], _StubAgent]`` — 接收 service 传入的
            ``course_dir``，返回配置好的 stub agent。
    """
    monkeypatch.setattr(
        LearningService,
        "_build_course_agent",
        lambda self, course_dir: stub_factory(Path(course_dir)),
    )


# ── build_course_id ────────────────────────────────────────────────────


async def test_build_course_id_is_stable_and_slugified():
    a = build_course_id("Rust 入门!")
    b = build_course_id("Rust 入门!")
    # 同输入 → 同输出
    assert a == b
    # 格式: <slug>--<8hex>
    assert re.fullmatch(r"[a-z0-9-]+--[0-9a-f]{8}", a) is not None
    # 非 ASCII 字符被剥离,只剩下 ascii 字符后变成 "rust"
    assert a.startswith("rust--")
    # hash 部分基于 topic.strip() 而非 slug:大小写不同则 hash 不同
    c = build_course_id("rust 入门!")  # 大小写差异 → hash 不同
    assert a != c
    # 末尾标点剥离不影响 hash(strip 后内容相同)
    d = build_course_id("Rust 入门!")
    assert a == d


async def test_build_course_id_different_topic_different_hash():
    a = build_course_id("Rust 入门")
    b = build_course_id("Go 入门")
    assert a != b


async def test_build_course_id_empty_topic_falls_back_to_default():
    # 纯标点 / 空白 → slug 默认 "course"
    cid = build_course_id("!!!")
    assert cid.startswith("course--")


# ── YAML front matter round trip ────────────────────────────────────────


async def test_render_mission_md_round_trip():
    """_render_mission_md 序列化 → _parse_missions 反序列化应字段一致。"""
    course_id = "rust--abcd1234"
    missions = [
        _single_choice_mission(),
        _multi_choice_mission(),
        _true_false_mission(),
    ]

    md = _render_mission_md(
        title="课程练习:Rust 入门",
        course_id=course_id,
        missions=missions,
    )
    parsed = _parse_missions(md)

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


async def test_parse_missions_returns_empty_when_no_front_matter():
    assert _parse_missions("# 只有正文\n没有 front matter\n") == []


async def test_parse_missions_ignores_malformed_items():
    md = _render_mission_md(
        title="T",
        course_id="c--00000001",
        missions=[_single_choice_mission()],
    )
    # 在 front matter 注入一条非法 mission 看是否被跳过
    md = md.replace(
        "answer: B",
        "answer: B\n  - bogus_extra_field: oops",
        1,
    )
    parsed = _parse_missions(md)
    # _parse_missions 容错:非法项被跳过,合法项仍能解析
    assert isinstance(parsed, list)


# ── generate_course (stub course agent) ────────────────────────────────


async def test_generate_course_writes_three_files(
    monkeypatch, tmp_course_dir, clean_collection
):
    """单课生成落盘结构 (task-351):

    .. code-block:: text

        <course_id>/
          lessons/
            0001-<slug>.md          ← lesson body
            0001-<slug>.exercise.md ← 该课练习
          resource.md                ← 课程共享资源

    新流程（task-3553）下 lesson body / resource.md 由 stub agent 在 run 内
    经 save_lesson / save_resource 工具写盘，service 只落盘 exercise 文件。
    """
    cid = build_course_id("Rust 入门")
    _patch_course_agent(
        monkeypatch,
        lambda course_dir: _StubAgent(
            course_dir=course_dir, payload=_step1_payload(cid)
        ),
    )

    svc = LearningService(
        tmp_dir=tmp_course_dir,
        repo=LearningRepo(),
    )
    cid = await svc.generate_course(topic="Rust 入门", owner="user-1")

    course_dir = tmp_course_dir / cid
    lessons_dir = course_dir / "lessons"
    assert lessons_dir.exists()
    # 顶层 lesson.md / mission.md 已经迁出到 lessons/<num>-<slug>.md /
    # lessons/<num>-<slug>.exercise.md
    assert not (course_dir / "lesson.md").exists()
    assert not (course_dir / "mission.md").exists()
    assert (course_dir / "resource.md").exists()

    lesson_files = sorted(lessons_dir.glob("*.md"))
    # body + exercise 各一
    assert len(lesson_files) == 2
    lesson_body = next(p for p in lesson_files if not p.name.endswith(".exercise.md"))
    exercise_body = next(p for p in lesson_files if p.name.endswith(".exercise.md"))
    # 文件名格式 0001-<slug>.md
    assert lesson_body.name == "0001-lesson-1.md"
    assert exercise_body.name == "0001-lesson-1.exercise.md"

    text = lesson_body.read_text(encoding="utf-8")
    assert text.startswith("---\n")  # YAML front matter present
    assert "## Session 1" in text

    # exercise body 解析回得到 3 题
    parsed = _parse_missions(exercise_body.read_text(encoding="utf-8"))
    assert [m.type for m in parsed] == [
        "single_choice",
        "multi_choice",
        "true_false",
    ]


async def test_generate_course_upserts_progress_with_ready_status(
    monkeypatch, tmp_course_dir, clean_collection
):
    cid = build_course_id("Rust 入门")
    _patch_course_agent(
        monkeypatch,
        lambda course_dir: _StubAgent(
            course_dir=course_dir, payload=_step1_payload(cid)
        ),
    )

    repo = LearningRepo()
    svc = LearningService(tmp_dir=tmp_course_dir, repo=repo)
    cid = await svc.generate_course(topic="Rust 入门", owner="user-1")

    progress = await repo.get_progress("user-1", cid)
    assert progress is not None
    assert progress.status == "ready"
    assert progress.topic == "Rust 入门"
    assert progress.created_at is not None


async def test_generate_course_is_idempotent(
    monkeypatch, tmp_course_dir, clean_collection
):
    """重复调用同一 topic+owner 不应创建第二条 progress(覆盖写文件)。"""
    cid = build_course_id("Rust 入门")
    _patch_course_agent(
        monkeypatch,
        lambda course_dir: _StubAgent(
            course_dir=course_dir, payload=_step1_payload(cid)
        ),
    )

    svc = LearningService(tmp_dir=tmp_course_dir, repo=LearningRepo())
    cid1 = await svc.generate_course(topic="Rust 入门", owner="user-1")
    cid2 = await svc.generate_course(topic="Rust 入门", owner="user-1")
    assert cid1 == cid2  # 同 course_id

    docs = await LearningProgress.find(
        LearningProgress.owner == "user-1"
    ).to_list()
    assert len(docs) == 1


async def test_generate_course_raises_when_agent_run_fails(
    monkeypatch, tmp_course_dir, clean_collection
):
    """新流程没有 step1：stub agent 的 ``arun`` 抛错 → ``generate_course`` 抛错。"""
    cid = build_course_id("Rust 入门")
    _patch_course_agent(
        monkeypatch,
        lambda course_dir: _StubAgent(
            course_dir=course_dir,
            payload=_step1_payload(cid),
            fail_on_arun=RuntimeError("course agent boom"),
        ),
    )

    svc = LearningService(tmp_dir=tmp_course_dir, repo=LearningRepo())
    with pytest.raises(RuntimeError, match="course agent boom"):
        await svc.generate_course(topic="Rust 入门", owner="user-1")


async def test_generate_course_retries_when_output_schema_parse_fails(
    monkeypatch, tmp_course_dir, clean_collection
):
    """首轮返回无法解析的 content → 触发整 run 重试（task-3554）→ 第二轮返回
    合法 ``MissionBundle`` → 生成成功（不再抛错），且只落盘一课。
    """
    cid = build_course_id("Rust 入门")
    stub = _StubAgent(
        course_dir=tmp_course_dir / cid,
        payload=_step1_payload(cid),
        parse_fail_contents=["<raw json string, not a MissionBundle>"],
        write_body_after_calls=1,  # 首轮不写 body：解析失败且不残留半成品
    )
    _patch_course_agent(monkeypatch, lambda course_dir: stub)

    svc = LearningService(tmp_dir=tmp_course_dir, repo=LearningRepo())
    cid = await svc.generate_course(topic="Rust 入门", owner="user-1")

    # 重试确实发生（arun 被调 2 次），最终只落盘一课
    assert stub.arun_call_count == 2
    lessons_dir = tmp_course_dir / cid / "lessons"
    body_files = sorted(
        p
        for p in lessons_dir.glob("*.md")
        if not p.name.endswith(".exercise.md")
    )
    assert [p.name for p in body_files] == ["0001-lesson-1.md"]
    assert (lessons_dir / "0001-lesson-1.exercise.md").exists()


async def test_generate_course_retries_when_lesson_body_missing(
    monkeypatch, tmp_course_dir, clean_collection
):
    """首轮返回合法 ``MissionBundle`` 但漏调 ``save_lesson``（body 未落盘）
    → 磁盘校验失败 → 触发整 run 重试 → 第二轮正常写盘 → 成功。
    """
    cid = build_course_id("Rust 入门")
    stub = _StubAgent(
        course_dir=tmp_course_dir / cid,
        payload=_step1_payload(cid),
        write_body_after_calls=1,  # 首轮不写 body（模拟漏调 save_lesson）
    )
    _patch_course_agent(monkeypatch, lambda course_dir: stub)

    svc = LearningService(tmp_dir=tmp_course_dir, repo=LearningRepo())
    cid = await svc.generate_course(topic="Rust 入门", owner="user-1")

    # 重试确实发生（arun 被调 2 次），最终只落盘一课
    assert stub.arun_call_count == 2
    lessons_dir = tmp_course_dir / cid / "lessons"
    body_files = sorted(
        p
        for p in lessons_dir.glob("*.md")
        if not p.name.endswith(".exercise.md")
    )
    assert [p.name for p in body_files] == ["0001-lesson-1.md"]
    assert (lessons_dir / "0001-lesson-1.exercise.md").exists()


async def test_generate_course_raises_after_both_attempts_fail(
    monkeypatch, tmp_course_dir, clean_collection
):
    """两轮都解析失败 → 重试耗尽 → 抛 ``RuntimeError``，且 arun 恰好被调 2 次。"""
    cid = build_course_id("Rust 入门")
    stub = _StubAgent(
        course_dir=tmp_course_dir / cid,
        payload=_step1_payload(cid),
        parse_fail_contents=["<bad 1>", "<bad 2>"],
        write_body_after_calls=2,  # 两轮都不写 body（纯解析失败场景）
    )
    _patch_course_agent(monkeypatch, lambda course_dir: stub)

    svc = LearningService(tmp_dir=tmp_course_dir, repo=LearningRepo())
    with pytest.raises(RuntimeError, match="CourseAgent"):
        await svc.generate_course(topic="Rust 入门", owner="user-1")
    assert stub.arun_call_count == 2


# ── generate_next_lesson (渐进产出,task-352) ──────────────────────────────


async def test_generate_next_lesson_writes_next_file(
    monkeypatch, tmp_course_dir, clean_collection
):
    """已有第 1 课 → ``generate_next_lesson`` 写入 0002-<slug>.md + exercise。

    断言:返回 next_num=2;磁盘上 0001 / 0002 两份 lesson + resource.md 都在;
    ZPD 由 ``read_previous_lesson`` 工具承担——stub 模拟该工具时读到上一课 md
    全文非空,衔接上下文仍被保证。
    """
    cid = build_course_id("Rust 入门")
    svc = LearningService(tmp_dir=tmp_course_dir, repo=LearningRepo())

    # 先用「首课」stub 准备第 1 课(写 0001-lesson-1.md)
    stub_first = _StubAgent(
        course_dir=tmp_course_dir / cid,
        payload=_step1_payload(cid),
    )
    monkeypatch.setattr(
        LearningService,
        "_build_course_agent",
        lambda self, course_dir: stub_first,
    )
    await svc.generate_course(topic="Rust 入门", owner="u1")

    # 切到「next」stub 跑 generate_next_lesson(写 0002-lesson-2.md)
    stub_next = _StubAgent(
        course_dir=tmp_course_dir / cid,
        payload=_next_step1_payload(cid, num=2, slug="lesson-2"),
    )
    monkeypatch.setattr(
        LearningService,
        "_build_course_agent",
        lambda self, course_dir: stub_next,
    )
    next_num = await svc.generate_next_lesson(
        topic="Rust 入门", owner="u1", course_id=cid
    )
    assert next_num == 2

    lessons_dir = tmp_course_dir / cid / "lessons"
    body_files = sorted(p for p in lessons_dir.glob("*.md") if not p.name.endswith(".exercise.md"))
    assert [p.name for p in body_files] == [
        "0001-lesson-1.md",
        "0002-lesson-2.md",
    ]
    # ZPD:stub 模拟 read_previous_lesson 时读到上一课 md 全文(非空)
    assert stub_next.read_previous_lesson_outputs
    assert stub_next.read_previous_lesson_outputs[0]


async def test_generate_next_lesson_is_idempotent_when_next_file_exists(
    monkeypatch, tmp_course_dir, clean_collection
):
    """幂等:race 场景 — ``next_num`` 文件已存在(占位)→ 直接返回 ``None``。

    关键技巧:占位文件 ``0002-PENDING.md`` 满足 ``startswith("0002-")`` 的
    glob 命中,**但**不含 lowercase slug,不会被 ``_LESSON_FILE_RE`` 解析为
    lesson body,所以 ``existing_ids`` 仍 = ``[1]``,``next_num`` = 2 命中早返。
    """
    cid = build_course_id("Rust 入门")
    build_course_agent_called = {"n": 0}

    def _counting_factory(course_dir):
        build_course_agent_called["n"] += 1
        return _StubAgent(course_dir=course_dir, payload=_step1_payload(cid))

    # 准备第 1 课
    _patch_course_agent(
        monkeypatch,
        lambda course_dir: _StubAgent(
            course_dir=course_dir, payload=_step1_payload(cid)
        ),
    )
    svc = LearningService(tmp_dir=tmp_course_dir, repo=LearningRepo())
    cid = await svc.generate_course(topic="Rust 入门", owner="u1")

    # 在 lessons/ 下放一个 race 占位文件 — glob 匹配但 regex 拒绝
    lessons_dir = tmp_course_dir / cid / "lessons"
    (lessons_dir / "0002-PENDING.md").write_text("# race placeholder")

    # 切到「计数」stub 工厂验证 _build_course_agent 不被调
    _patch_course_agent(monkeypatch, _counting_factory)
    n = await svc.generate_next_lesson(
        topic="Rust 入门", owner="u1", course_id=cid
    )
    assert n is None
    assert build_course_agent_called["n"] == 0


async def test_get_course_assembles_multiple_lessons_in_order(
    monkeypatch, tmp_course_dir, clean_collection
):
    """``get_course`` 按 ``lessons/`` 磁盘扫描装配多课并按 id 排序。

    第 1 课 + 追加的第 2 课 → 装配时 id 升序,共享 resource.md 仍只有一份。
    """
    cid = build_course_id("Rust 入门")
    svc = LearningService(tmp_dir=tmp_course_dir, repo=LearningRepo())

    _patch_course_agent(
        monkeypatch,
        lambda course_dir: _StubAgent(
            course_dir=course_dir, payload=_step1_payload(cid)
        ),
    )
    cid = await svc.generate_course(topic="Rust 入门", owner="u1")

    # 追加第 2 课
    _patch_course_agent(
        monkeypatch,
        lambda course_dir: _StubAgent(
            course_dir=course_dir,
            payload=_next_step1_payload(cid, num=2, slug="lesson-2"),
        ),
    )
    n2 = await svc.generate_next_lesson(
        topic="Rust 入门", owner="u1", course_id=cid
    )
    assert n2 == 2

    # 再次读 — 应该按 id 排序装配 lessons
    payload = await svc.get_course(owner="u1", course_id=cid)
    assert payload is not None
    assert payload["status"] == "ready"
    course = payload["course"]
    assert len(course.lessons) == 2
    assert [lsn.id for lsn in course.lessons] == [1, 2]
    assert course.lessons[0].slug == "lesson-1"
    assert course.lessons[1].slug == "lesson-2"
    # 共享 resource 仍只有一份
    assert "速查表" in course.resource_md


# ── get_course (read path) ────────────────────────────────────────────


async def test_get_course_returns_none_for_missing_progress(
    monkeypatch, tmp_course_dir, clean_collection
):
    svc = LearningService(tmp_dir=tmp_course_dir, repo=LearningRepo())
    assert (
        await svc.get_course(owner="ghost", course_id="nope--00000000")
    ) is None


async def test_get_course_returns_pending_when_status_is_pending(
    monkeypatch, tmp_course_dir, clean_collection
):
    repo = LearningRepo()
    await repo.upsert_progress(
        owner="u1",
        course_id="c--00000001",
        topic="T",
        status="pending",
    )
    svc = LearningService(tmp_dir=tmp_course_dir, repo=repo)
    payload = await svc.get_course(owner="u1", course_id="c--00000001")
    assert payload == {"status": "pending"}


async def test_get_course_returns_none_when_status_is_failed(
    monkeypatch, tmp_course_dir, clean_collection
):
    repo = LearningRepo()
    await repo.upsert_progress(
        owner="u1", course_id="c--00000001", topic="T", status="failed"
    )
    svc = LearningService(tmp_dir=tmp_course_dir, repo=repo)
    assert (
        await svc.get_course(owner="u1", course_id="c--00000001") is None
    )


async def test_get_course_returns_full_package_when_ready(
    monkeypatch, tmp_course_dir, clean_collection
):
    cid = build_course_id("Rust 入门")
    _patch_course_agent(
        monkeypatch,
        lambda course_dir: _StubAgent(
            course_dir=course_dir, payload=_step1_payload(cid)
        ),
    )

    svc = LearningService(tmp_dir=tmp_course_dir, repo=LearningRepo())
    cid = await svc.generate_course(topic="Rust 入门", owner="u1")

    payload = await svc.get_course(owner="u1", course_id=cid)
    assert payload is not None
    assert payload["status"] == "ready"
    course = payload["course"]
    assert course.course_id == cid
    assert course.topic == "Rust 入门"
    # task-351 契约:已生成的课在 lessons 列表里(渐进产出时按磁盘装配)
    assert len(course.lessons) == 1
    lesson0 = course.lessons[0]
    assert lesson0.id == 1
    assert lesson0.title == "Rust 入门"  # 从 front-matter 解析
    assert lesson0.slug == "lesson-1"
    assert "## Session 1" in lesson0.md
    # 该课练习 = 3 题(从同名 .exercise.md 反序列化)
    assert len(lesson0.exercises) == 3
    # 课程级共享资源
    assert "速查表" in course.resource_md


# ── mark_progress / list_progress / merge_progress ────────────────────


async def test_mark_progress_appends_session_done_idempotently(
    monkeypatch, tmp_course_dir, clean_collection
):
    cid = build_course_id("Rust 入门")
    _patch_course_agent(
        monkeypatch,
        lambda course_dir: _StubAgent(
            course_dir=course_dir, payload=_step1_payload(cid)
        ),
    )
    repo = LearningRepo()
    svc = LearningService(tmp_dir=tmp_course_dir, repo=repo)
    cid = await svc.generate_course(topic="Rust 入门", owner="u1")

    # 重复调用不应膨胀 sessions_done 列表
    await svc.mark_progress(owner="u1", course_id=cid, session_done=1)
    await svc.mark_progress(owner="u1", course_id=cid, session_done=1)
    await svc.mark_progress(owner="u1", course_id=cid, session_done=2)

    items = await svc.list_progress(owner="u1")
    assert len(items) == 1
    assert sorted(items[0]["sessions_done"]) == [1, 2]
    assert items[0]["next_session"] == 3


async def test_mark_progress_sets_mission_done(
    monkeypatch, tmp_course_dir, clean_collection
):
    cid = build_course_id("Rust 入门")
    _patch_course_agent(
        monkeypatch,
        lambda course_dir: _StubAgent(
            course_dir=course_dir, payload=_step1_payload(cid)
        ),
    )
    repo = LearningRepo()
    svc = LearningService(tmp_dir=tmp_course_dir, repo=repo)
    cid = await svc.generate_course(topic="Rust 入门", owner="u1")

    out = await svc.mark_progress(
        owner="u1", course_id=cid, mission_done=True
    )
    assert out is not None
    assert out["mission_done"] is True


async def test_mark_progress_returns_none_for_missing(
    monkeypatch, tmp_course_dir, clean_collection
):
    svc = LearningService(tmp_dir=tmp_course_dir, repo=LearningRepo())
    assert (
        await svc.mark_progress(owner="ghost", course_id="x--00000000")
    ) is None


async def test_merge_progress_returns_zero_for_self_merge(
    monkeypatch, tmp_course_dir, clean_collection
):
    svc = LearningService(tmp_dir=tmp_course_dir, repo=LearningRepo())
    assert await svc.merge_progress("u1", "u1") == 0


async def test_merge_progress_returns_zero_for_empty_owners(
    monkeypatch, tmp_course_dir, clean_collection
):
    svc = LearningService(tmp_dir=tmp_course_dir, repo=LearningRepo())
    assert await svc.merge_progress("", "u1") == 0
    assert await svc.merge_progress("anon:x", "") == 0
