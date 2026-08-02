"""磁盘课程包仓库（C1 CoursePackageStore，深模块所有者）。

课程包是 learning 模块的事实数据源之一——``lessons/<num>-<slug>.md``、
``resource.md`` 与 ``MISSION.md``——但此前没有任何模块拥有它：布局
（``_course_dir``）挂在 service，命名正则与扫描 helpers 在
``learning_utils``，写策略（num=max+1、幂等跳过）埋在 ``learning_tools``
的 agno @tool 闭包。本类把这些磁盘知识收敛为单一所有者：

- **布局**：``course_id`` + ``tmp_dir`` 解析出课程包根目录，派生
  ``lessons_dir`` / ``resource_path`` / ``mission_path``。
- **命名约定**：``<num:04d>-<slug>.md``（与 ``<num:04d>-<slug>.exercise.md``
  同源配对），解析 / 格式化只在此处。
- **写路径**：``write_lesson`` 返回 :class:`WrittenLesson`（显式交接 num/slug，
  供 service 落盘 exercise 文件配对，不再从磁盘反推）；``write_resource``
  覆盖写；``write_mission`` 幂等写；三者均走原子写（临时文件 + ``os.replace``，
  修复 save_lesson 裸 ``write_text`` 的历史不一致）。
- **读路径**：``assemble_lessons`` / ``read_previous_lesson`` /
  ``read_mission`` / ``read_resource``。
- **编号**：``next_lesson_num()`` = 磁盘最大编号 + 1（首课 0001）。

写策略全部确定性地由仓库控制，调用方（handler / service / agent 工具）不
需要也不能传编号。

与 :class:`app.services.learning_utils` 的边界：本类只做磁盘课程包知识；
``_progress_to_dict`` / ``build_course_id`` 等纯工具仍留在 utils。
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

import yaml

from app.core.config import get_settings
from app.core.llm_prompts import LANGUAGE
from app.schemas.learning import Exercise, FileEntry, LessonItem

_LESSON_FILE_RE = re.compile(r"^(\d{4})-([a-z0-9][a-z0-9-]*)\.md$")


@dataclass(frozen=True)
class WrittenLesson:
    """``write_lesson`` 的显式交接结果。

    - ``skipped=False``：成功写盘，``num`` / ``slug`` / ``filename`` 均有效。
    - ``skipped=True``：该编号文件已存在（幂等命中），``slug`` / ``filename``
      为 ``None``，只保留冲突的 ``num`` 供调用方判断。
    """

    num: int | None
    slug: str | None = None
    filename: str | None = None
    skipped: bool = False


@dataclass
class CoursePackageRepo:
    """课程包根目录下的磁盘读写统一入口。

    Args:
        course_id: 课程 ID（``<topic-slug>--<8hex>``），用于定位根目录。
        tmp_dir: 可选根目录注入（单元测试用）；为 None 时依次取
            ``LEARNING_ROOT_DIR`` 环境变量、无则回退 ``<backend>/tmp/learning``。
            根目录 = ``tmp_dir / course_id``。

    Note:
        有状态：``write_lesson`` 会把最近一次**成功**写盘的
        :class:`WrittenLesson` 记录在 :attr:`last_written_lesson`，供 service
        在 agent run 后直接消费（显式交接，覆盖「整 run 重试时第二次 skips」
        的场景——首次成功写盘的结果不会因重试被清掉）。
    """

    course_id: str
    tmp_dir: Path | None = None
    root: Path = field(init=False)
    lessons_dir: Path = field(init=False)
    resource_path: Path = field(init=False)
    mission_path: Path = field(init=False)
    # 最近一次成功写盘的 lesson（供 service 做 exercise 配对）。只有非 skipped
    # 的写入才更新它；重试第二次 skip 时保留首次的写盘结果。
    last_written_lesson: WrittenLesson | None = field(init=False, default=None)

    def __post_init__(self) -> None:
        self.root = self._resolve_root(self.course_id, self.tmp_dir)
        self.lessons_dir = self.root / "lessons"
        self.resource_path = self.root / "resource.md"
        self.mission_path = self.root / "MISSION.md"

    @staticmethod
    def _resolve_root(course_id: str, tmp_dir: Path | None) -> Path:
        """课程包根目录：``tmp_dir`` 注入 > ``LEARNING_ROOT_DIR`` env > 默认值。"""
        root = tmp_dir
        if root is None:
            configured = get_settings().LEARNING_ROOT_DIR
            root = (
                Path(configured)
                if configured
                else (
                    Path(__file__).resolve().parent.parent.parent
                    / "tmp"
                    / "learning"
                )
            )
        return Path(root) / course_id

    # ── 命名 / 扫描 ──────────────────────────────────────────────────── #

    @staticmethod
    def parse_lesson_filename(name: str) -> tuple[int, str] | None:
        """解析 ``0001-<slug>.md`` → ``(1, "<slug>")``；不匹配返回 None。"""
        if name.endswith(".exercise.md"):
            return None
        m = _LESSON_FILE_RE.match(name)
        if not m:
            return None
        return int(m.group(1)), m.group(2)

    def lesson_ids(self) -> list[int]:
        """扫描 ``lessons/`` 目录，提取所有 lesson body 文件（不含 .exercise.md）
        的前导编号。返回的编号已排序。
        """
        if not self.lessons_dir.exists():
            return []
        return sorted(
            parsed[0]
            for path in self.lessons_dir.glob("*.md")
            if (parsed := self.parse_lesson_filename(path.name)) is not None
        )

    def lesson_file_exists(self, lesson_num: int) -> bool:
        """判断 ``<num>-<slug>.md`` 形文件是否已存在（同一编号任一 slug 都算）。"""
        if not self.lessons_dir.exists():
            return False
        prefix = f"{lesson_num:04d}-"
        return any(
            p.name.startswith(prefix)
            for p in self.lessons_dir.glob(f"{prefix}*.md")
        )

    def next_lesson_num(self) -> int:
        """下一课编号：磁盘最大编号 + 1（首课为 0001）。"""
        existing_ids = self.lesson_ids()
        return (max(existing_ids) + 1) if existing_ids else 1

    def has_lessons(self) -> bool:
        """``lessons/`` 目录是否存在（课程主体是否已生成）。"""
        return self.lessons_dir.exists()

    def has_resource(self) -> bool:
        """``resource.md`` 是否存在。"""
        return self.resource_path.exists()

    # ── 写路径 ───────────────────────────────────────────────────────── #

    def write_lesson(self, slug: str, lesson_md: str) -> WrittenLesson:
        """写一课正文到 ``lessons/<num>-<slug>.md``（原子写，幂等）。

        编号由仓库内部扫描磁盘确定（``next_lesson_num()``），不要求调用方传
        编号。幂等：该编号对应文件已存在（重试 / 并发竞争）时不重复写，返回
        ``skipped=True``。

        Args:
            slug: dash-case slug，用于文件名 ``<num>-<slug>.md``。
            lesson_md: 本课 lesson.md 全文（含 YAML front matter）。

        Returns:
            :class:`WrittenLesson`——成功时 ``num`` / ``slug`` / ``filename``
            有效；幂等命中时 ``skipped=True`` 只带冲突的 ``num``。
        """
        num = self.next_lesson_num()
        if self.lesson_file_exists(num):
            return WrittenLesson(num=num, skipped=True)

        self.lessons_dir.mkdir(parents=True, exist_ok=True)
        filename = f"{num:04d}-{slug}.md"
        _write_md(self.lessons_dir / filename, lesson_md, overwrite=True)
        written = WrittenLesson(
            num=num, slug=slug, filename=filename, skipped=False
        )
        self.last_written_lesson = written
        return written

    def write_resource(self, resource_md: str) -> str:
        """写全课程共享 resource.md 到课程包根目录（覆盖已有内容）。"""
        _write_md(self.resource_path, resource_md, overwrite=True)
        return "resource.md"

    def write_mission(self, mission_md: str) -> str | None:
        """写学习使命文档 MISSION.md（幂等：已存在则不覆盖）。

        Returns:
            ``"MISSION.md"``；已存在（幂等命中）时返回 ``None``。
        """
        if not _write_md(self.mission_path, mission_md, overwrite=False):
            return None
        return "MISSION.md"

    def write_exercise(
        self,
        *,
        num: int,
        slug: str,
        title: str,
        exercises: list[Exercise],
    ) -> str:
        """渲染并落盘 ``<num>-<slug>.exercise.md``（原子写）。

        与 lesson body ``<num>-<slug>.md`` 严格同名对应；``course_id`` /
        ``LANGUAGE`` 由仓库持有，调用方只需给编号、slug、标题与题目列表。

        Returns:
            落盘文件名（如 ``0001-lesson-1.exercise.md``）。
        """
        self.lessons_dir.mkdir(parents=True, exist_ok=True)
        filename = f"{num:04d}-{slug}.exercise.md"
        _write_md(
            self.lessons_dir / filename,
            _render_exercise_md(
                title=title,
                course_id=self.course_id,
                exercises=exercises,
            ),
            overwrite=True,
        )
        return filename

    # ── 读路径 ───────────────────────────────────────────────────────── #

    def read_previous_lesson(self) -> str:
        """读**最大编号** lesson 的 md 全文（ZPD 渐进上下文）。

        Returns:
            最大编号 lesson 的 md 全文；无任何课程时返回空字符串。
        """
        existing_ids = self.lesson_ids()
        return _last_lesson_md(self.lessons_dir, existing_ids) or ""

    def read_mission(self) -> str | None:
        """读 MISSION.md 全文；缺失或读失败返回 None。"""
        return _read_md(self.mission_path)

    def read_resource(self) -> str | None:
        """读 resource.md 全文；缺失或读失败返回 None。"""
        return _read_md(self.resource_path)

    def list_course_files(self) -> list[FileEntry]:
        """扫描课程包根目录，返回全部 md 制品的只读清单。

        - ``lessons/`` 下所有 ``*.md``（含 ``.exercise.md`` 配对文件）按文件名排序；
        - 根目录 ``resource.md`` / ``MISSION.md``（存在才列出）随后按文件名排序；
        - ``rel_path`` 相对课程包根、正斜杠分隔（如 ``lessons/0001-foo.md``），
          handler 可直接拼到下载 URL / ZIP 内部路径。
        """
        entries: list[FileEntry] = []
        if self.lessons_dir.exists():
            entries.extend(
                _file_entry(rel_path=f"lessons/{p.name}", path=p)
                for p in sorted(self.lessons_dir.glob("*.md"))
            )
        for path in sorted(
            (p for p in (self.resource_path, self.mission_path) if p.exists()),
            key=lambda p: p.name,
        ):
            entries.append(_file_entry(rel_path=path.name, path=path))
        return entries

    def read_course_file(self, rel_path: str) -> tuple[Path, str] | None:
        """按 ``rel_path`` 读课程包内单个 md 文件；非法 / 越界 / 缺失返回 None。

        防越界下沉到仓库：handler 只透传 ``rel_path``，此处拒绝含 ``..``、
        ``/`` 开头、空字节的输入；再 ``resolve`` 后用 ``is_relative_to``
        校验 candidate 不越出 ``self.root``（顺带挡掉 symlink 逃逸）；最后按
        后缀白名单限制为 ``.md``。

        Returns:
            ``(absolute_path, display_name)``——display_name 是文件基名，
            可直接作下载文件名；越界 / 后缀不符 / 缺失返回 None。
        """
        if (
            not rel_path
            or ".." in rel_path
            or rel_path.startswith("/")
            or "\x00" in rel_path
        ):
            return None
        root = self.root.resolve()
        candidate = (self.root / rel_path).resolve()
        if not candidate.is_relative_to(root):
            return None
        if candidate.suffix != ".md" or not candidate.is_file():
            return None
        return candidate, candidate.name

    def read_exercises(self, num: int, slug: str) -> list[Exercise]:
        """读 ``<num>-<slug>.exercise.md`` 的练习题（缺失 / 非法返回空列表）。

        agent 经 ``save_exercise`` 工具落盘的练习文件，service 在 run 后读回；
        与 :meth:`assemble_lessons` 共用 ``_parse_exercises`` 解析路径。
        """
        path = self.lessons_dir / f"{num:04d}-{slug}.exercise.md"
        if not path.exists():
            return []
        return _parse_exercises(path.read_text(encoding="utf-8"))

    def latest_lesson_without_exercises(self) -> tuple[int, str] | None:
        """取「有 body 文件但没有对应 exercise 文件」的最近一课 ``(num, slug)``。

        ``save_exercise`` 用它配对练习文件：正常流程下匹配刚写的本课；整 run
        重试时（body 已在上一轮落盘）仍能匹配到缺练习的那一课，避免重复写新课。
        无 body 文件或全部已配对时返回 None。
        """
        if not self.lessons_dir.exists():
            return None
        for path in sorted(self.lessons_dir.glob("*.md"), reverse=True):
            parsed = self.parse_lesson_filename(path.name)
            if parsed is None:
                continue
            lesson_id, slug = parsed
            if not (
                self.lessons_dir / f"{lesson_id:04d}-{slug}.exercise.md"
            ).exists():
                return (lesson_id, slug)
        return None

    def assemble_lessons(self) -> list[LessonItem]:
        """扫描 ``lessons/`` 装配 :class:`LessonItem` 列表：按编号排序；
        每个 lesson body 从 front matter 抽 ``title``，否则回退到 slug 美化。
        练习题从同名 ``.exercise.md`` 解析（缺失则空 list）。
        """
        items: list[LessonItem] = []
        for path in sorted(self.lessons_dir.glob("*.md")):
            parsed = self.parse_lesson_filename(path.name)
            if parsed is None:
                continue
            lesson_id, slug = parsed
            body = path.read_text(encoding="utf-8")
            title = _extract_title_from_front_matter(body) or slug.replace(
                "-", " "
            )

            exercise_path = (
                self.lessons_dir / f"{lesson_id:04d}-{slug}.exercise.md"
            )
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


# ── 私有纯函数（仅本模块使用，命名/格式化约定单点） ──────────────────── #


def _file_entry(*, rel_path: str, path: Path) -> FileEntry:
    """从磁盘文件装配 :class:`FileEntry`（list_course_files 共用）。"""
    stat = path.stat()
    return FileEntry(
        name=path.name,
        rel_path=rel_path,
        size=stat.st_size,
        mtime=stat.st_mtime,
    )


def _read_md(path: Path) -> str | None:
    """读可选 md 文件；缺失或读失败返回 None（resource / MISSION 共用）。"""
    try:
        return path.read_text(encoding="utf-8") if path.exists() else None
    except OSError:
        return None


def _write_md(path: Path, content: str, *, overwrite: bool) -> bool:
    """写 md 文件；``overwrite=False`` 时已存在则跳过。返回是否实际写入。

    用临时文件 + ``os.replace`` 保证原子写：进程中途崩溃不会留下截断文件，
    也不会被后续幂等跳过误当成已存在内容。
    """
    if not overwrite and path.exists():
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(content, encoding="utf-8")
    tmp.replace(path)
    return True


def _last_lesson_md(lessons_dir: Path, existing_ids: list[int]) -> str | None:
    """取**最大编号** lesson 的 md 全文作为上一课上下文。"""
    if not existing_ids:
        return None
    last_id = existing_ids[-1]
    for path in lessons_dir.glob(f"{last_id:04d}-*.md"):
        if path.name.endswith(".exercise.md"):
            continue
        return path.read_text(encoding="utf-8")
    return None


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
    "CoursePackageRepo",
    "WrittenLesson",
]
