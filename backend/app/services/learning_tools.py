"""课程 agent 工具集合（issue #29：LessonWriter 全可选分发器）。

为「单一课程 agent 通过工具自主执行」提供磁盘工具。C1 深化后，本模块是**薄
转发适配器**：所有磁盘知识（布局 / 命名 / manifest / 原子写）统一由
:class:`CoursePackageRepo` 拥有，写侧 ``@tool`` 闭包只做参数分发与返回消息
格式化。

- :func:`create_learning_tools` 是工厂：捕获一个 ``CoursePackageRepo`` 实例
  （service 每次 run 构造、与 run 后校验共用同一个实例），返回两个写
  ``@tool``（``LessonWriter`` / ``ExerciseWriter``）加一个只读 ``FileTools``
  实例（``base_dir`` 锁到课程包根目录，``enable_read_file=True``）。
- ``LessonWriter``：**全参数可选的分发器**——可多次调用、按需分次产出：
  - ``mission_md`` / ``resource_md`` 任一提供即**覆盖写**对应文件（always，
    可单独一次调用只写其中一个）；
  - 写课正文需 ``num`` + ``slug`` + ``title`` + ``lesson_md`` 四件套（缺
    ``num`` 返回错误说明）；目标文件已存在且未传 ``update_lesson=True`` →
    返回冲突提示（不覆盖），覆盖重写需 ``update_lesson=True``；
  - 返回落盘文件名（如 ``0002-rust-errors.md`` / ``MISSION.md`` /
    ``RESOURCE.md``）；冲突 / 非法时返回错误说明字符串。
- ``ExerciseWriter``：``exercises`` 为 Exercise 列表的 JSON 字符串，``num`` /
  ``slug`` 取自 ``LessonWriter`` 返回文件名，写入 ``<num>-<slug>.exercise.md``。

写工具签名只暴露内容参数——与 prompt 契约（``COURSE_AGENT_INSTRUCTIONS``）
保持字符串一致。
"""

from __future__ import annotations

import json

from agno.tools import tool
from agno.tools.file import FileTools
from agno.tools.function import Function

from app.repositories.course_package_repo import CoursePackageRepo
from app.schemas.learning import Exercise


def create_learning_tools(repo: CoursePackageRepo) -> list[Function]:
    """返回课程 agent 可调用的工具集合（写侧 ``@tool`` 闭包 + 只读 ``FileTools``）。

    写工具闭包捕获 ``repo``，读工具是 agno ``FileTools(base_dir=repo.root)``——
    ``base_dir`` 锁定为课程包根目录，agent 通过相对路径读 ``MISSION.md`` /
    ``RESOURCE.md`` / ``lessons/<num>-<slug>.md``；非只读 FileTools 能力保持
    现状显式关闭（写工具已有专门 ``@tool`` 入口，list/search 留着会引入歧义）。

    Args:
        repo: 课程包仓库实例（含该课程根目录的全部磁盘知识）。

    Returns:
        ``[LessonWriter, ExerciseWriter]`` + 一个
        ``FileTools(base_dir=repo.root, enable_read_file=True, 其余 enable
        全 False)``，可直接传给 Agent。
    """

    @tool(show_result=True)
    def LessonWriter(
        num: int | None = None,
        slug: str | None = None,
        title: str | None = None,
        lesson_md: str | None = None,
        update_lesson: bool = False,
        mission_md: str | None = None,
        resource_md: str | None = None,
    ) -> str:
        """写一课正文 / 共享资料 / 学习使命（全参数可选，可多次调用、按需分次产出）。

        本工具是本课程的**唯一写课入口**，一次调用可只产出其中一类产物，请按
        需要分次调用（如先写 ``MISSION.md``，再写 lesson body）：

        - ``mission_md`` / ``resource_md``：任一提供即**覆盖写**对应文件
          （``MISSION.md`` / ``RESOURCE.md``，always），可单独调用只写其一；
        - 写课正文需要 ``num`` + ``slug`` + ``title`` + ``lesson_md`` 四件套：
          ``num`` 是目标课编号（1..9999 整数，决定文件名
          ``<num:04d>-<slug>.md``），``slug`` 是小写 dash-case，
          ``title`` 写入 manifest 用于课程列表，``lesson_md`` 是正文（以
          ``# 标题`` 开头、不含 YAML front matter）；
        - 目标文件 ``<num>-<slug>.md`` 已存在且未传 ``update_lesson=True`` →
          返回冲突提示（**不会覆盖**）；确认要覆盖重写时才传
          ``update_lesson=True``。

        Args:
            num: 目标课编号（1..9999）。写课正文必填，缺省会返回错误说明。
            slug: dash-case slug，用于文件名 ``<num>-<slug>.md``。
            title: 课标题（写课正文必填，写入 manifest 供课程列表展示）。
            lesson_md: 本课 lesson body 全文（以 ``# 标题`` 开头，无 front matter）。
            update_lesson: 目标文件已存在时是否覆盖重写。
            mission_md: 提供则覆盖写 ``MISSION.md``（always）。
            resource_md: 提供则覆盖写 ``RESOURCE.md``（always）。

        Returns:
            本次落盘的文件名（如 ``0002-rust-errors.md`` / ``MISSION.md`` /
            ``RESOURCE.md``）；冲突 / 参数非法时返回错误说明字符串。
        """
        if lesson_md is None:
            # 本次只写 mission / resource（单独提供即覆盖）。
            written: list[str] = []
            if mission_md is not None:
                repo.write_mission(mission_md)
                written.append("MISSION.md")
            if resource_md is not None:
                repo.write_resource(resource_md)
                written.append("RESOURCE.md")
            return "、".join(written) if written else ""

        if num is None:
            return (
                "LessonWriter 失败：缺少 num（目标课编号）。写课正文需要 "
                "num + slug + title + lesson_md 四件套；num 是目标文件名 "
                "<num:04d>-<slug>.md 的前导编号（1..9999 整数）。"
            )
        missing = [
            name
            for name, value in (("slug", slug), ("title", title))
            if value is None
        ]
        if missing:
            return (
                "LessonWriter 失败：缺少 "
                + "、".join(missing)
                + "。写课正文需要 num + slug + title + lesson_md 四件套。"
            )
        result = repo.LessonWriter(
            num=num,
            slug=slug,
            title=title,
            lesson_md=lesson_md,
            update_lesson=update_lesson,
            mission_md=mission_md,
            resource_md=resource_md,
        )
        if result.status == "conflict":
            return f"LessonWriter 冲突：{result.message}"
        if result.status == "invalid":
            return f"LessonWriter 参数非法：{result.message}"
        return result.filename or ""

    @tool(show_result=True)
    def ExerciseWriter(num: int, slug: str, exercises: str) -> str:
        """把练习题写入 ``<num>-<slug>.exercise.md``（与本课正文同名配对）。

        ``num`` / ``slug`` 取自 ``LessonWriter`` 返回文件名（前导编号与 slug），
        与本课正文 ``<num>-<slug>.md`` 严格同名对应。

        Args:
            num: 目标课编号（``LessonWriter`` 返回文件名的前导编号）。
            slug: 目标课 slug（``LessonWriter`` 返回文件名中的 slug）。
            exercises: Exercise 对象列表的 JSON 字符串。字段规则见
                ``COURSE_AGENT_INSTRUCTIONS``「练习规范」：``answer`` 类型必须
                与 ``type`` 严格一致（single_choice→str / multi_choice→list[str] /
                true_false→bool），``explanation`` 必填。

        Returns:
            落盘文件名（如 ``0001-rust-ownership.exercise.md``）；``exercises``
            非法（非 JSON / 字段不符）时返回错误说明，agent 可修正后重新调用。
        """
        try:
            items = [
                Exercise.model_validate(item) for item in json.loads(exercises)
            ]
        except Exception as exc:
            return (
                f"ExerciseWriter 失败：exercises 不是合法 JSON 或字段不符合 "
                f"Exercise 规范（{exc}）。请修正后重新调用本工具。"
            )
        return repo.ExerciseWriter(num=num, slug=slug, exercises=items)

    reader = FileTools(
        base_dir=repo.root,
        enable_read_file=True,
        enable_save_file=False,
    )

    return [
        LessonWriter,
        ExerciseWriter,
        reader,  # pyright: ignore[reportReturnType]
    ]


__all__ = ["create_learning_tools"]
