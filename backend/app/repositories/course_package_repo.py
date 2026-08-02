"""磁盘课程包仓库（C1 CoursePackageStore，深模块所有者；issue #29 无状态化）。

课程包是 learning 模块的事实数据源之一——``lessons/<num>-<slug>.md``、
``<num>-<slug>.exercise.md``、``RESOURCE.md``、``MISSION.md`` 与
``manifest.json``——但此前没有任何模块拥有它：布局（``_course_dir``）挂在
service，命名正则与扫描 helpers 在 ``learning_utils``，写策略（num=max+1、
幂等跳过）埋在 ``learning_tools`` 的 agno @tool 闭包。本类把这些磁盘知识收敛
为单一所有者：

- **布局**：``course_id`` + ``tmp_dir`` 解析出课程包根目录，派生
  ``lessons_dir`` / ``resource_path`` / ``mission_path`` / ``manifest_path``。
- **命名约定**：``<num:04d>-<slug>.md``（与 ``<num:04d>-<slug>.exercise.md``
  同源配对），解析 / 格式化只在此处。
- **写路径（issue #29）**：``LessonWriter`` 改为**显式编号**——调用方（agent
  工具）传 ``num`` + ``slug`` + ``title`` + ``lesson_md``，仓库不再自动推断
  编号、不再维护实例状态 ``last_written_lesson``；目标文件已存在且未传
  ``update_lesson=True`` 返回 ``status="conflict"``（不写盘），覆盖重写返回
  ``status="updated"``。``write_mission`` / ``write_resource`` 均为**覆盖写**。
  lesson 正文落盘的同时原子更新 ``manifest.json``（``{"lessons": {"<num>":
  {"title": ..., "slug": ...}}}``），作为 ``assemble_lessons`` 的标题权威来源。
  三者均走原子写（临时文件 + ``os.replace``）。
- **读路径**：``assemble_lessons`` / ``read_mission`` / ``read_resource`` /
  ``find_lesson`` / ``read_exercises``。
- **编号**：``next_lesson_num()`` = 磁盘最大编号 + 1（首课 0001），仅供
  service 计算**下一课目标编号**（agent 侧写盘用显式 num，二者以磁盘为准收敛）。

写策略全部确定性地由仓库控制；仓库**无状态**——每次 agent run 重新构造，
run 后校验以「目标编号 = 入参 lesson_num」为唯一权威，经 :meth:`find_lesson`
回查磁盘，不再依赖任何跨调用交接字段。

与 :class:`app.services.learning_utils` 的边界：本类只做磁盘课程包知识；
``_progress_to_dict`` / ``build_course_id`` 等纯工具仍留在 utils。
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

from app.core.config import get_settings
from app.repositories.exercise_md import (
    _extract_title_from_front_matter,
    _parse_exercises,
    _render_exercise_md,
)
from app.schemas.learning import Exercise, FileEntry, LessonItem

_LESSON_FILE_RE = re.compile(r"^(\d{4})-([a-z0-9][a-z0-9-]*)\.md$")
# slug 合法性（与 _LESSON_FILE_RE 的第二个分组一致）：小写 dash-case。
_SLUG_RE = re.compile(r"[a-z0-9][a-z0-9-]*")


@dataclass(frozen=True)
class WrittenLesson:
    """``LessonWriter`` 的显式交接结果（issue #29：以 ``status`` 取代 ``skipped``）。

    - ``status="written"``：新写一课，``num`` / ``slug`` / ``filename`` 有效。
    - ``status="updated"``：覆盖重写已有目标文件，字段有效。
    - ``status="conflict"``：目标文件已存在且未要求覆盖，**不写盘**；
      ``message`` 给出冲突说明。
    - ``status="invalid"``：``num`` / ``slug`` 非法，**不写盘**；``message``
      给出非法说明。
    """

    num: int | None = None
    slug: str | None = None
    filename: str | None = None
    status: Literal["written", "updated", "conflict", "invalid"] = "written"
    message: str | None = None


@dataclass
class CoursePackageRepo:
    """课程包根目录下的磁盘读写统一入口。

    Args:
        course_id: 课程 ID（``<topic-slug>--<8hex>``），用于定位根目录。
        tmp_dir: 可选根目录注入（单元测试用）；为 None 时依次取
            ``LEARNING_ROOT_DIR`` 环境变量、无则回退 ``<backend>/tmp/learning``。
            根目录 = ``tmp_dir / course_id``。

    Note:
        无状态：不保存跨调用交接字段（issue #29 删除 ``last_written_lesson``）。
        service 每次 run 重新构造实例；agent run 结束后以入参 ``lesson_num`` 为
        目标编号，经 :meth:`find_lesson` 从磁盘回查课正文、:meth:`read_exercises`
        读练习，不再依赖仓库内部状态。
    """

    course_id: str
    tmp_dir: Path | None = None
    root: Path = field(init=False)
    lessons_dir: Path = field(init=False)
    resource_path: Path = field(init=False)
    mission_path: Path = field(init=False)
    manifest_path: Path = field(init=False)

    def __post_init__(self) -> None:
        self.root = self._resolve_root(self.course_id, self.tmp_dir)
        self.lessons_dir = self.root / "lessons"
        self.resource_path = self.root / "RESOURCE.md"
        self.mission_path = self.root / "MISSION.md"
        self.manifest_path = self.root / "manifest.json"

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
        """``RESOURCE.md`` 是否存在。"""
        return self.resource_path.exists()

    def find_lesson(self, num: int) -> tuple[int, str] | None:
        """按编号找 lesson body：扫 ``lessons/`` 用 ``_LESSON_FILE_RE`` 取
        ``(num, slug)``；无匹配返回 None。

        service 在 agent run 后用它确认「目标编号 num 的课正文已落盘」并拿
        ``slug`` 读同名练习——替代旧 :attr:`last_written_lesson` 显式交接，
        重试顺序变化不会错位。
        """
        if not self.lessons_dir.exists():
            return None
        for path in self.lessons_dir.glob("*.md"):
            parsed = self.parse_lesson_filename(path.name)
            if parsed is None:
                continue
            lesson_id, slug = parsed
            if lesson_id == num:
                return (lesson_id, slug)
        return None

    # ── 写路径 ───────────────────────────────────────────────────────── #

    def LessonWriter(
        self,
        num: int,
        slug: str,
        title: str,
        lesson_md: str,
        *,
        update_lesson: bool = False,
        mission_md: str | None = None,
        resource_md: str | None = None,
    ) -> WrittenLesson:
        """写一课正文到 ``lessons/<num:04d>-<slug>.md``（原子写）。

        issue #29：编号由调用方**显式提供**（不再内部推断 / 幂等跳过）。
        目标文件已存在时——``update_lesson=False``（默认）→ 冲突、不写盘；
        ``update_lesson=True`` → 覆盖重写（``status="updated"``）。``mission_md``
        / ``resource_md`` 任一提供即覆盖写对应文件（always）。lesson 正文落盘的
        同时原子更新 ``manifest.json``，作为 :meth:`assemble_lessons` 的标题
        权威来源。

        非法 / 冲突时整个调用**不写任何盘**（mission / resource 一并跳过），
        保证单次调用要么完整生效、要么全无副作用。

        Args:
            num: 目标课编号（1..9999），决定文件名 ``<num:04d>-<slug>.md``。
            slug: dash-case slug（``[a-z0-9][a-z0-9-]*``）。
            title: 课标题，写入 manifest（课程列表展示）。
            lesson_md: 本课 lesson body 全文（以 ``# 标题`` 开头，无 front matter）。
            update_lesson: 目标文件已存在时是否覆盖重写。
            mission_md: 提供则覆盖写 ``MISSION.md``（always）。
            resource_md: 提供则覆盖写 ``RESOURCE.md``（always）。

        Returns:
            :class:`WrittenLesson`——``status`` ∈ {written, updated, conflict,
            invalid}；conflict / invalid 带 ``message`` 说明。
        """
        if not (isinstance(num, int) and 1 <= num <= 9999):
            return WrittenLesson(
                num=num,
                slug=slug,
                status="invalid",
                message=(
                    f"num={num!r} 不在合法范围 [1, 9999]，无法形成文件名 "
                    "<num:04d>-<slug>.md"
                ),
            )
        if not (isinstance(slug, str) and _SLUG_RE.fullmatch(slug)):
            return WrittenLesson(
                num=num,
                slug=slug,
                status="invalid",
                message=(
                    f"slug={slug!r} 不匹配 [a-z0-9][a-z0-9-]*，无法形成合法文件名"
                ),
            )

        self.lessons_dir.mkdir(parents=True, exist_ok=True)
        filename = f"{num:04d}-{slug}.md"
        target = self.lessons_dir / filename
        existed = target.exists()
        if existed and not update_lesson:
            return WrittenLesson(
                num=num,
                slug=slug,
                filename=filename,
                status="conflict",
                message=(
                    f"目标文件 {filename} 已存在；未传 update_lesson=True 不覆盖，"
                    "请改用新编号或显式 update_lesson=True 覆盖重写"
                ),
            )

        if mission_md is not None:
            _write_md(self.mission_path, mission_md, overwrite=True)
        if resource_md is not None:
            _write_md(self.resource_path, resource_md, overwrite=True)

        _write_md(target, lesson_md, overwrite=True)
        self._update_manifest(num, title, slug)
        return WrittenLesson(
            num=num,
            slug=slug,
            filename=filename,
            status="updated" if (existed and update_lesson) else "written",
        )

    def write_resource(self, resource_md: str) -> str:
        """写全课程共享 RESOURCE.md 到课程包根目录（覆盖已有内容，always）。"""
        _write_md(self.resource_path, resource_md, overwrite=True)
        return "RESOURCE.md"

    def write_mission(self, mission_md: str) -> str:
        """写学习使命文档 MISSION.md（覆盖已有内容，always；issue #29 由幂等改掉）。

        Returns:
            ``"MISSION.md"``。
        """
        _write_md(self.mission_path, mission_md, overwrite=True)
        return "MISSION.md"

    def ExerciseWriter(
        self,
        num: int,
        slug: str,
        title: str = "课程练习",
        *,
        exercises: list[Exercise],
    ) -> str:
        """渲染并落盘 ``<num>-<slug>.exercise.md``（原子写）。

        与 lesson body ``<num>-<slug>.md`` 严格同名对应；``num`` / ``slug``
        由调用方显式提供（agent 取自 ``LessonWriter`` 返回文件名）。
        ``title`` 默认 ``课程练习``；``course_id`` / ``LANGUAGE`` 由仓库持有，
        调用方只需给编号、slug、标题与题目列表。

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

    def read_mission(self) -> str | None:
        """读 MISSION.md 全文；缺失或读失败返回 None。"""
        return _read_md(self.mission_path)

    def read_resource(self) -> str | None:
        """读 RESOURCE.md 全文；缺失或读失败返回 None。"""
        return _read_md(self.resource_path)

    def list_course_files(self) -> list[FileEntry]:
        """扫描课程包根目录，返回全部 md 制品的只读清单。

        - ``lessons/`` 下所有 ``*.md``（含 ``.exercise.md`` 配对文件）按文件名排序；
        - 根目录 ``RESOURCE.md`` / ``MISSION.md``（存在才列出）随后按文件名排序；
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

        agent 经 ``ExerciseWriter`` 工具落盘的练习文件，service 在 run 后读回；
        与 :meth:`assemble_lessons` 共用 ``_parse_exercises`` 解析路径。
        """
        path = self.lessons_dir / f"{num:04d}-{slug}.exercise.md"
        if not path.exists():
            return []
        return _parse_exercises(path.read_text(encoding="utf-8"))

    def assemble_lessons(self) -> list[LessonItem]:
        """扫描 ``lessons/`` 装配 :class:`LessonItem` 列表：按编号排序。

        **标题来源（issue #29）**：manifest.json →（旧课程）front matter title
        兜底 → slug 美化。练习题从同名 ``.exercise.md`` 解析（缺失则空 list）。
        """
        manifest = self._read_manifest()
        items: list[LessonItem] = []
        for path in sorted(self.lessons_dir.glob("*.md")):
            parsed = self.parse_lesson_filename(path.name)
            if parsed is None:
                continue
            lesson_id, slug = parsed
            body = path.read_text(encoding="utf-8")
            entry = manifest.get(str(lesson_id)) or {}
            title = (
                entry.get("title")
                or _extract_title_from_front_matter(body)
                or slug.replace("-", " ")
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

    # ── manifest（issue #29：标题权威来源） ────────────────────────────── #

    def _read_manifest(self) -> dict[str, dict[str, str]]:
        """读 manifest.json 的 lessons 映射：``{"<num>": {"title", "slug"}}``。

        缺失 / 非法（非 dict / 非 JSON / 无 lessons）返回空映射。
        """
        if not self.manifest_path.exists():
            return {}
        try:
            payload = json.loads(
                self.manifest_path.read_text(encoding="utf-8")
            )
        # PEP 758（Python 3.14+）允许 except 元组省略括号；项目 ruff target py314。
        except OSError, json.JSONDecodeError:
            return {}
        lessons = payload.get("lessons") if isinstance(payload, dict) else None
        if not isinstance(lessons, dict):
            return {}
        return lessons

    def _update_manifest(self, num: int, title: str, slug: str) -> None:
        """原子更新 manifest.json 的 ``lessons`` 条目（新增 / 覆盖 ``<num>``）。"""
        lessons = self._read_manifest()
        lessons[str(num)] = {"title": title, "slug": slug}
        _write_md(
            self.manifest_path,
            json.dumps({"lessons": lessons}, ensure_ascii=False, indent=2),
            overwrite=True,
        )


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
    也不会被后续幂等跳过误当成已存在内容。manifest.json 也复用本原子写路径。
    """
    if not overwrite and path.exists():
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(content, encoding="utf-8")
    tmp.replace(path)
    return True


__all__ = [
    "CoursePackageRepo",
    "WrittenLesson",
]
