"""Service tests for ``app.services.learning_service.LearningService``.

Mocking strategy (task-3555)：agent_driven 重构后 service 不再跑三步流水线
（``_run_research`` / ``_run_step1`` / ``_run_step2`` 已删除），只调一次
``_build_course_agent(...).arun(prompt, output_schema=ExerciseBundle)``。
测试用 ``_StubAgent`` monkeypatch ``LearningService._build_course_agent``：
stub 的 ``arun`` 模拟 agent 调用磁盘工具，但**写语义委托真实
``CoursePackageRepo``**（C1：与生产 ``create_learning_tools`` 薄适配器共用
同一仓库，不再在 stub 里重新实现写规则，消除漂移），并返回
``ExerciseBundle``，不触碰网络 / Redis / DeepSeek。
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
from app.repositories.course_package_repo import (
    CoursePackageRepo,
    _parse_exercises,
)
from app.repositories.learning_repo import LearningRepo
from app.schemas.learning import Exercise
from app.services.learning_service import (
    ExerciseBundle,
    LearningService,
    LessonResourceOutput,
)
from app.services.learning_utils import build_course_id

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


def _mission_md(topic: str) -> str:
    """stub 模拟 ``save_mission`` 写盘的 MISSION.md 内容（task-365 模板各节）。"""
    return (
        f"# Mission: {topic}\n\n"
        "## Why\n"
        "- 能独立复述核心概念并应用到真实场景。\n\n"
        "## Success looks like\n"
        "- 完成全部练习且通过自测。\n\n"
        "## Constraints\n"
        "- 每天最多 30 分钟。\n\n"
        "## Out of scope\n"
        "- 不涉及进阶专题。\n"
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


def _step2_payload() -> ExerciseBundle:
    return ExerciseBundle(
        exercises=[
            _single_choice_exercise(),
            _multi_choice_exercise(),
            _true_false_exercise(),
        ]
    )


class _StubAgent:
    """Stub 课程 agent：在 ``arun`` 内模拟工具写盘并返回 ExerciseBundle。

    task-3553 后 service 不再调 ``_run_step1`` / ``_run_step2``，只调一次
    ``_build_course_agent(...).arun(prompt, output_schema=ExerciseBundle)``。
    本 stub 替代旧的 step1/step2 monkeypatch：``arun`` 内按真实工具语义模拟
    五个磁盘工具，但**写盘全部委托 :class:`CoursePackageRepo`**（C1）——

    - ``read_previous_lesson``（ZPD）：委托 ``repo.read_previous_lesson``，
      结果记录到 :attr:`read_previous_lesson_outputs` 供断言。
    - ``save_resource``：委托 ``repo.write_resource``（覆盖已有内容）。
    - ``save_lesson``：委托 ``repo.write_lesson``（编号 / 幂等 / 原子写全在
      仓库内，与生产 :func:`create_learning_tools` 薄适配器同语义）。
    - ``save_mission``（task-365）：委托 ``repo.write_mission``（幂等）；实际
      写入次数记录到 :attr:`save_mission_calls`。
    - ``read_mission``（task-365）：委托 ``repo.read_mission``，缺失返回 ""；
      结果记录到 :attr:`read_mission_outputs`。

    返回 ``SimpleNamespace(content=ExerciseBundle(...))``，供
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
        repo: CoursePackageRepo,
        payload: LessonResourceOutput,
        bundle: ExerciseBundle | None = None,
        fail_on_arun: Exception | None = None,
        parse_fail_contents: list[object] | None = None,
        write_body_after_calls: int = 0,
        topic: str = "Rust 入门",
    ) -> None:
        self._repo = repo
        self._payload = payload
        self._bundle = bundle if bundle is not None else _step2_payload()
        self._fail_on_arun = fail_on_arun
        self._parse_fail_contents = list(parse_fail_contents or [])
        self._write_body_after_calls = write_body_after_calls
        self._topic = topic
        # ``arun`` 被调次数（task-3554 重试断言用）。
        self.arun_call_count = 0
        # ``arun`` 内模拟 read_previous_lesson 的返回值（ZPD 衔接断言用）。
        self.read_previous_lesson_outputs: list[str] = []
        # ``arun`` 内模拟 save_mission / read_mission 的记录（task-365 断言用）。
        self.save_mission_calls: list[str] = []
        self.read_mission_outputs: list[str] = []
        # ``arun`` 收到的 session_id（task-373：service 透传 session_id 给
        # agent，本字段记录每次 arun 收到的值用于断言「同 session 复用」）。
        self.session_ids_received: list[str | None] = []

    async def arun(
        self, prompt: str, output_schema=None, session_id: str | None = None
    ):
        self.arun_call_count += 1
        self.session_ids_received.append(session_id)
        if self._fail_on_arun is not None:
            raise self._fail_on_arun

        # 模拟 read_previous_lesson：写新课前读最大编号 lesson 的 md（ZPD）。
        self.read_previous_lesson_outputs.append(
            self._repo.read_previous_lesson()
        )

        # 模拟 save_resource：写全课程共享资料（覆盖已有内容）。
        self._repo.write_resource(self._payload.resource_md)

        # 模拟 save_mission（task-365）：MISSION.md 不存在才写，幂等。
        mission_content = _mission_md(self._topic)
        if self._repo.write_mission(mission_content) is not None:
            self.save_mission_calls.append(mission_content)
        # 模拟 read_mission：读 MISSION.md 全文（缺失返回 ""）。
        self.read_mission_outputs.append(self._repo.read_mission() or "")

        # 模拟 save_lesson：编号 / 幂等由真实仓库决定（与生产工具同语义）；
        # 前 write_body_after_calls 次不写（模拟漏调 save_lesson）。
        if self.arun_call_count > self._write_body_after_calls:
            self._repo.write_lesson(
                slug=self._payload.slug, lesson_md=self._payload.lesson_md
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
        stub_factory: ``Callable[[CoursePackageRepo], _StubAgent]`` — 接收
            service 传入的共享 ``CoursePackageRepo`` 实例，返回配置好的 stub
            agent（写语义委托同一仓库，C1）。
    """
    monkeypatch.setattr(
        LearningService,
        "_build_course_agent",
        lambda self, repo: stub_factory(repo),
    )


def _stub_factory(stub_holder: dict[str, _StubAgent], **kwargs) -> callable:
    """生成 stub 工厂：接收 service 传入的 repo，构建 ``_StubAgent`` 并记录到 holder。

    C1 后 ``_StubAgent`` 需要真实 ``CoursePackageRepo``，而 repo 由 service 在
    ``_generate_lesson`` 内创建——测试无法在 patch 前预构造 stub。改用「工厂内
    构造 + holder 捕获」：``_build_course_agent`` 每次生成只被调一次，所以
    ``holder["stub"]`` 即为本次 run 实际使用的实例，供断言 ``arun_call_count``
    等。

    Args:
        stub_holder: 单元素容器，工厂构建后写入 ``stub_holder["stub"]``。
        **kwargs: 透传给 :class:`_StubAgent` 的构造参数（payload 等）。
    """

    def _factory(repo: CoursePackageRepo) -> _StubAgent:
        stub = _StubAgent(repo=repo, **kwargs)
        stub_holder["stub"] = stub
        return stub

    return _factory


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
        lambda repo: _StubAgent(repo=repo, payload=_step1_payload(cid)),
    )

    svc = LearningService(
        tmp_dir=tmp_course_dir,
        repo=LearningRepo(),
    )
    cid = await svc.generate_course(topic="Rust 入门", owner="user-1")

    course_dir = tmp_course_dir / cid
    lessons_dir = course_dir / "lessons"
    assert lessons_dir.exists()
    # 顶层 lesson.md / exercise.md 已经迁出到 lessons/<num>-<slug>.md /
    # lessons/<num>-<slug>.exercise.md
    assert not (course_dir / "lesson.md").exists()
    assert not (course_dir / "exercise.md").exists()
    assert (course_dir / "resource.md").exists()

    lesson_files = sorted(lessons_dir.glob("*.md"))
    # body + exercise 各一
    assert len(lesson_files) == 2
    lesson_body = next(
        p for p in lesson_files if not p.name.endswith(".exercise.md")
    )
    exercise_body = next(
        p for p in lesson_files if p.name.endswith(".exercise.md")
    )
    # 文件名格式 0001-<slug>.md
    assert lesson_body.name == "0001-lesson-1.md"
    assert exercise_body.name == "0001-lesson-1.exercise.md"

    text = lesson_body.read_text(encoding="utf-8")
    assert text.startswith("---\n")  # YAML front matter present
    assert "## Session 1" in text

    # exercise body 解析回得到 3 题
    parsed = _parse_exercises(exercise_body.read_text(encoding="utf-8"))
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
        lambda repo: _StubAgent(repo=repo, payload=_step1_payload(cid)),
    )

    repo = LearningRepo()
    svc = LearningService(tmp_dir=tmp_course_dir, repo=repo)
    cid = await svc.generate_course(topic="Rust 入门", owner="user-1")

    progress = await repo.get_progress("user-1", cid)
    assert progress is not None
    assert progress.status == "ready"
    assert progress.topic == "Rust 入门"
    assert progress.created_at is not None


async def test_generate_course_persists_goal_when_provided(
    monkeypatch, tmp_course_dir, clean_collection
):
    """带 goal 提交 → ready 进度记录含 goal;不带则 goal 为 None。"""
    cid = build_course_id("Rust 入门")

    def _factory(repo):
        return _StubAgent(
            repo=repo,
            payload=_step1_payload(cid),
        )

    _patch_course_agent(monkeypatch, _factory)

    repo = LearningRepo()
    svc = LearningService(tmp_dir=tmp_course_dir, repo=repo)
    cid = await svc.generate_course(
        topic="Rust 入门",
        owner="user-1",
        goal="能独立复述所有权规则",
    )

    progress = await repo.get_progress("user-1", cid)
    assert progress is not None
    assert progress.goal == "能独立复述所有权规则"

    # 不带 goal 再生成另一门课 → goal 为 None
    cid2 = await svc.generate_course(topic="Go 入门", owner="user-1")
    progress2 = await repo.get_progress("user-1", cid2)
    assert progress2 is not None
    assert progress2.goal is None


async def test_generate_course_is_idempotent(
    monkeypatch, tmp_course_dir, clean_collection
):
    """重复调用同一 topic+owner 不应创建第二条 progress(覆盖写文件)。"""
    cid = build_course_id("Rust 入门")
    _patch_course_agent(
        monkeypatch,
        lambda repo: _StubAgent(repo=repo, payload=_step1_payload(cid)),
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
        lambda repo: _StubAgent(
            repo=repo,
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
    合法 ``ExerciseBundle`` → 生成成功（不再抛错），且只落盘一课。
    """
    cid = build_course_id("Rust 入门")
    holder: dict[str, _StubAgent] = {}
    _patch_course_agent(
        monkeypatch,
        _stub_factory(
            holder,
            payload=_step1_payload(cid),
            parse_fail_contents=["<raw json string, not a ExerciseBundle>"],
            write_body_after_calls=1,  # 首轮不写 body：解析失败且不残留半成品
        ),
    )

    svc = LearningService(tmp_dir=tmp_course_dir, repo=LearningRepo())
    cid = await svc.generate_course(topic="Rust 入门", owner="user-1")

    # 重试确实发生（arun 被调 2 次），最终只落盘一课
    stub = holder["stub"]
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
    """首轮返回合法 ``ExerciseBundle`` 但漏调 ``save_lesson``（body 未落盘）
    → 磁盘校验失败 → 触发整 run 重试 → 第二轮正常写盘 → 成功。
    """
    cid = build_course_id("Rust 入门")
    holder: dict[str, _StubAgent] = {}
    _patch_course_agent(
        monkeypatch,
        _stub_factory(
            holder,
            payload=_step1_payload(cid),
            write_body_after_calls=1,  # 首轮不写 body（模拟漏调 save_lesson）
        ),
    )

    svc = LearningService(tmp_dir=tmp_course_dir, repo=LearningRepo())
    cid = await svc.generate_course(topic="Rust 入门", owner="user-1")

    # 重试确实发生（arun 被调 2 次），最终只落盘一课
    stub = holder["stub"]
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
    holder: dict[str, _StubAgent] = {}
    _patch_course_agent(
        monkeypatch,
        _stub_factory(
            holder,
            payload=_step1_payload(cid),
            parse_fail_contents=["<bad 1>", "<bad 2>"],
            write_body_after_calls=2,  # 两轮都不写 body（纯解析失败场景）
        ),
    )

    svc = LearningService(tmp_dir=tmp_course_dir, repo=LearningRepo())
    with pytest.raises(RuntimeError, match="CourseAgent"):
        await svc.generate_course(topic="Rust 入门", owner="user-1")
    assert holder["stub"].arun_call_count == 2


# ── MISSION.md (task-365) ────────────────────────────────────────────────


async def test_generate_course_writes_mission_md(
    monkeypatch, tmp_course_dir, clean_collection
):
    """首课生成后 ``<course_id>/MISSION.md`` 存在且含模板各节（task-365）。"""
    cid = build_course_id("Rust 入门")
    holder: dict[str, _StubAgent] = {}
    _patch_course_agent(
        monkeypatch,
        _stub_factory(holder, payload=_step1_payload(cid)),
    )

    svc = LearningService(tmp_dir=tmp_course_dir, repo=LearningRepo())
    cid = await svc.generate_course(topic="Rust 入门", owner="u1")

    mission_path = tmp_course_dir / cid / "MISSION.md"
    assert mission_path.exists()
    text = mission_path.read_text(encoding="utf-8")
    assert text.startswith("# Mission: Rust 入门")
    for section in (
        "## Why",
        "## Success looks like",
        "## Constraints",
        "## Out of scope",
    ):
        assert section in text
    # save_mission 在首课被调用一次（写盘）
    assert len(holder["stub"].save_mission_calls) == 1


async def test_generate_next_lesson_keeps_mission_md(
    monkeypatch, tmp_course_dir, clean_collection
):
    """渐进产出 next 课不覆盖 MISSION.md；read_mission 可读回（task-365）。"""
    cid = build_course_id("Rust 入门")
    svc = LearningService(tmp_dir=tmp_course_dir, repo=LearningRepo())

    first_holder: dict[str, _StubAgent] = {}
    _patch_course_agent(
        monkeypatch,
        _stub_factory(first_holder, payload=_step1_payload(cid)),
    )
    await svc.generate_course(topic="Rust 入门", owner="u1")
    stub_first = first_holder["stub"]
    mission_path = tmp_course_dir / cid / "MISSION.md"
    first_text = mission_path.read_text(encoding="utf-8")
    assert len(stub_first.save_mission_calls) == 1

    # next 课生成：MISSION.md 已存在 → save_mission 不再写，内容不变
    next_holder: dict[str, _StubAgent] = {}
    _patch_course_agent(
        monkeypatch,
        _stub_factory(
            next_holder,
            payload=_next_step1_payload(cid, num=2, slug="lesson-2"),
        ),
    )
    await svc.generate_next_lesson(
        topic="Rust 入门", owner="u1", course_id=cid
    )
    stub_next = next_holder["stub"]

    assert mission_path.read_text(encoding="utf-8") == first_text
    assert len(stub_next.save_mission_calls) == 0
    # read_mission 可读回 MISSION.md 全文
    assert stub_next.read_mission_outputs
    assert stub_next.read_mission_outputs[0] == first_text


async def test_get_course_includes_mission_md(
    monkeypatch, tmp_course_dir, clean_collection
):
    """ready 响应含 mission_md；无 MISSION.md 的旧课程为 null（task-365）。"""
    cid = build_course_id("Rust 入门")
    _patch_course_agent(
        monkeypatch,
        lambda repo: _StubAgent(repo=repo, payload=_step1_payload(cid)),
    )
    svc = LearningService(tmp_dir=tmp_course_dir, repo=LearningRepo())
    cid = await svc.generate_course(topic="Rust 入门", owner="u1")

    payload = await svc.get_course(owner="u1", course_id=cid)
    assert payload is not None
    assert payload["status"] == "ready"
    course = payload["course"]
    assert course.mission_md is not None
    assert course.mission_md.startswith("# Mission: Rust 入门")

    # 删除 MISSION.md 模拟旧课程 → mission_md 为 None
    (tmp_course_dir / cid / "MISSION.md").unlink()
    payload2 = await svc.get_course(owner="u1", course_id=cid)
    assert payload2 is not None
    assert payload2["course"].mission_md is None


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
    first_holder: dict[str, _StubAgent] = {}
    _patch_course_agent(
        monkeypatch,
        _stub_factory(first_holder, payload=_step1_payload(cid)),
    )
    await svc.generate_course(topic="Rust 入门", owner="u1")

    # 切到「next」stub 跑 generate_next_lesson(写 0002-lesson-2.md)
    next_holder: dict[str, _StubAgent] = {}
    _patch_course_agent(
        monkeypatch,
        _stub_factory(
            next_holder,
            payload=_next_step1_payload(cid, num=2, slug="lesson-2"),
        ),
    )
    next_num = await svc.generate_next_lesson(
        topic="Rust 入门", owner="u1", course_id=cid
    )
    assert next_num == 2
    stub_next = next_holder["stub"]

    lessons_dir = tmp_course_dir / cid / "lessons"
    body_files = sorted(
        p
        for p in lessons_dir.glob("*.md")
        if not p.name.endswith(".exercise.md")
    )
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

    def _counting_factory(repo):
        build_course_agent_called["n"] += 1
        return _StubAgent(repo=repo, payload=_step1_payload(cid))

    # 准备第 1 课
    _patch_course_agent(
        monkeypatch,
        lambda repo: _StubAgent(repo=repo, payload=_step1_payload(cid)),
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
        lambda repo: _StubAgent(repo=repo, payload=_step1_payload(cid)),
    )
    cid = await svc.generate_course(topic="Rust 入门", owner="u1")

    # 追加第 2 课
    _patch_course_agent(
        monkeypatch,
        lambda repo: _StubAgent(
            repo=repo,
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


async def test_create_pending_persists_goal(
    monkeypatch, tmp_course_dir, clean_collection
):
    """create_pending 带 goal → pending 记录含 goal;不带 → goal 为 None。"""
    repo = LearningRepo()
    svc = LearningService(tmp_dir=tmp_course_dir, repo=repo)

    await svc.create_pending(
        owner="u1",
        course_id="c--00000001",
        topic="T",
        goal="能独立复述论证结构",
    )
    doc = await repo.get_progress("u1", "c--00000001")
    assert doc is not None
    assert doc.status == "pending"
    assert doc.goal == "能独立复述论证结构"

    await svc.create_pending(owner="u1", course_id="c--00000002", topic="T2")
    doc2 = await repo.get_progress("u1", "c--00000002")
    assert doc2 is not None
    assert doc2.goal is None


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
    assert await svc.get_course(owner="u1", course_id="c--00000001") is None


async def test_get_course_returns_full_package_when_ready(
    monkeypatch, tmp_course_dir, clean_collection
):
    cid = build_course_id("Rust 入门")
    _patch_course_agent(
        monkeypatch,
        lambda repo: _StubAgent(repo=repo, payload=_step1_payload(cid)),
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
        lambda repo: _StubAgent(repo=repo, payload=_step1_payload(cid)),
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


async def test_mark_progress_sets_exercise_done(
    monkeypatch, tmp_course_dir, clean_collection
):
    cid = build_course_id("Rust 入门")
    _patch_course_agent(
        monkeypatch,
        lambda repo: _StubAgent(repo=repo, payload=_step1_payload(cid)),
    )
    repo = LearningRepo()
    svc = LearningService(tmp_dir=tmp_course_dir, repo=repo)
    cid = await svc.generate_course(topic="Rust 入门", owner="u1")

    out = await svc.mark_progress(
        owner="u1", course_id=cid, exercise_done=True
    )
    assert out is not None
    assert out["exercise_done"] is True


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


# ── session_id 跨轮复用（task-373） ──────────────────────────────────────


async def test_generate_course_persists_session_id(
    monkeypatch, tmp_course_dir, clean_collection
):
    """``generate_course`` 锚定一个非空 ``session_id`` 并落到 progress，
    且传给 agent 的 ``arun`` 的就是该 session_id。
    """
    cid = build_course_id("Rust 入门")
    holder: dict[str, _StubAgent] = {}
    _patch_course_agent(
        monkeypatch, _stub_factory(holder, payload=_step1_payload(cid))
    )

    repo = LearningRepo()
    svc = LearningService(tmp_dir=tmp_course_dir, repo=repo)
    cid = await svc.generate_course(topic="Rust 入门", owner="user-1")

    progress = await repo.get_progress("user-1", cid)
    assert progress is not None
    # 锚定的 session_id 非空 + 32 字符 hex（uuid4().hex）
    assert progress.session_id is not None
    assert len(progress.session_id) == 32
    # stub agent 收到的就是该 session_id
    assert holder["stub"].session_ids_received[0] == progress.session_id


async def test_generate_next_lesson_reuses_session_id(
    monkeypatch, tmp_course_dir, clean_collection
):
    """首课锚定 session_id 后，``generate_next_lesson`` 透传同一 session_id
    给 agent 的 arun — 实现跨轮 agno 会话复用。
    """
    cid = build_course_id("Rust 入门")
    svc = LearningService(tmp_dir=tmp_course_dir, repo=LearningRepo())

    # 首课：写 0001-lesson-1.md，同时落库 progress.session_id
    first_holder: dict[str, _StubAgent] = {}
    _patch_course_agent(
        monkeypatch,
        _stub_factory(first_holder, payload=_step1_payload(cid)),
    )
    cid = await svc.generate_course(topic="Rust 入门", owner="u1")

    # 从 repo 读出首课锚定的 session_id
    repo = LearningRepo()
    progress = await repo.get_progress("u1", cid)
    assert progress is not None
    first_session_id = progress.session_id
    assert first_session_id is not None

    # 第 2 课：切到 next stub，按 task-352 渐进产出路径走 generate_next_lesson
    next_holder: dict[str, _StubAgent] = {}
    _patch_course_agent(
        monkeypatch,
        _stub_factory(
            next_holder,
            payload=_next_step1_payload(cid, num=2, slug="lesson-2"),
        ),
    )
    next_num = await svc.generate_next_lesson(
        topic="Rust 入门",
        owner="u1",
        course_id=cid,
        session_id=first_session_id,
    )
    assert next_num == 2
    stub_next = next_holder["stub"]

    # stub_next 收到的 session_id 必须 == 首课锚定的 session_id（跨轮复用）
    assert stub_next.session_ids_received
    assert stub_next.session_ids_received[0] == first_session_id


# ── preview_next_lesson (C1/C3：API 幂等预检接缝) ────────────────────────


async def test_preview_next_lesson_returns_context_when_ready(
    monkeypatch, tmp_course_dir, clean_collection
):
    """进度 ready + 磁盘空 → NextLessonContext(next_num=1, already_generated=False)。"""
    cid = build_course_id("Rust 入门")
    svc = LearningService(tmp_dir=tmp_course_dir, repo=LearningRepo())
    await svc._repo.upsert_progress(
        owner="u1",
        course_id=cid,
        topic="Rust 入门",
        status="ready",
        goal="g",
        session_id="sess-1",
    )

    ctx = await svc.preview_next_lesson("u1", cid)
    assert ctx is not None
    assert ctx.next_num == 1
    assert ctx.already_generated is False
    assert ctx.topic == "Rust 入门"
    assert ctx.goal == "g"
    assert ctx.session_id == "sess-1"


async def test_preview_next_lesson_already_generated_when_file_exists(
    monkeypatch, tmp_course_dir, clean_collection
):
    """磁盘已有第 1 课 → next_num=2 未生成；占位文件存在 → already_generated。"""
    cid = build_course_id("Rust 入门")
    repo = CoursePackageRepo(course_id=cid, tmp_dir=tmp_course_dir)
    repo.write_lesson(slug="lesson-1", lesson_md="# l1")

    svc = LearningService(tmp_dir=tmp_course_dir, repo=LearningRepo())
    await svc._repo.upsert_progress(
        owner="u1", course_id=cid, topic="Rust 入门", status="ready"
    )

    ctx = await svc.preview_next_lesson("u1", cid)
    assert ctx is not None
    assert ctx.next_num == 2
    assert ctx.already_generated is False  # 0002 尚未生成

    # race 占位文件（0002-PENDING.md）→ 预检命中 already_generated=True
    (repo.lessons_dir / "0002-PENDING.md").write_text("# placeholder")
    ctx2 = await svc.preview_next_lesson("u1", cid)
    assert ctx2 is not None
    assert ctx2.next_num == 2
    assert ctx2.already_generated is True


async def test_preview_next_lesson_returns_none_when_missing_or_failed(
    monkeypatch, tmp_course_dir, clean_collection
):
    """进度不存在 / failed → 返回 None（API 层据此回 failed 包）。"""
    svc = LearningService(tmp_dir=tmp_course_dir, repo=LearningRepo())
    assert await svc.preview_next_lesson("ghost", "c--00000000") is None

    await svc._repo.upsert_progress(
        owner="u1", course_id="c--00000001", topic="T", status="failed"
    )
    assert await svc.preview_next_lesson("u1", "c--00000001") is None
