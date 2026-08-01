"""课程 agent 工具集合（agent_driven 重构第 2 步，纯新增，不接入 service）。

为「单一课程 agent 通过工具自主执行」提供磁盘工具。C1 深化后，本模块从
「写策略实现」降级为**薄转发适配器**：所有磁盘知识（布局 / 命名 / 编号 /
幂等 / 原子写）统一由 :class:`CoursePackageRepo` 拥有，六个 ``@tool`` 闭包
只做参数转发与返回消息格式化。

- :func:`create_learning_tools` 是工厂：捕获一个 ``CoursePackageRepo`` 实例
  （service 每次 run 构造、与 exercise 配对共用同一个实例），返回六个
  ``@tool(show_result=True)`` 装饰后的 agno ``Function``。
- ``save_lesson``：委托 ``repo.write_lesson``，编号 / 幂等全在仓库内。
- ``save_resource``：委托 ``repo.write_resource``（覆盖写）。
- ``read_previous_lesson``：委托 ``repo.read_previous_lesson``（ZPD 渐进上下文）。
- ``save_mission``：委托 ``repo.write_mission``（幂等）。
- ``read_mission``：委托 ``repo.read_mission``。
- ``save_exercise``：委托 ``repo.write_exercise`` 把练习题写入
  ``<num>-<slug>.exercise.md``，按 ``repo.latest_lesson_without_exercises()``
  与缺练习的课配对；``exercises`` 是 JSON 字符串，仓库侧按 ``Exercise`` 校验。

工具签名只暴露内容参数（title/slug/lesson_md/resource_md/mission_md）——与
prompt 契约（``COURSE_AGENT_INSTRUCTIONS``）保持字符串一致，C4 的
「prompt ↔ 工具名」自动校验不在本候选范围。
"""

from __future__ import annotations

import json

from agno.tools import tool
from agno.tools.function import Function

from app.repositories.course_package_repo import CoursePackageRepo
from app.schemas.learning import Exercise


def create_learning_tools(repo: CoursePackageRepo) -> list[Function]:
    """返回课程 agent 可调用的工具集合（闭包捕获 ``repo``）。

    Args:
        repo: 课程包仓库实例（含该课程根目录的全部磁盘知识）。

    Returns:
        ``[save_lesson, save_resource, read_previous_lesson, save_mission,
        read_mission, save_exercise]``，均为 agno ``Function``
        （``@tool(show_result=True)`` 装饰），可直接传给 Agent。
    """

    @tool(show_result=True)
    def save_lesson(title: str, slug: str, lesson_md: str) -> str:
        """写一课正文到 lessons/<num>-<slug>.md（课程包根目录内）。

        编号由仓库内部扫描磁盘确定：next_num = max(已有编号) + 1（首课为
        0001），不要求 agent 传编号。幂等：该编号对应文件已存在（重试 / 并发
        竞争）时不再重复写入，返回已存在提示。

        Args:
            title: 本课标题（元数据，供 agent 与后续 manifest 使用；文件名与
                内容以 slug / lesson_md 为准）。
            slug: dash-case slug，用于文件名 <num>-<slug>.md。
            lesson_md: 本课 lesson.md 全文（含 YAML front matter）。

        Returns:
            落盘文件名（如 0002-rust-ownership.md）；若该编号文件已存在，返回
            跳过提示（不重复写）。
        """
        written = repo.write_lesson(slug=slug, lesson_md=lesson_md)
        if written.skipped:
            return (
                f"lesson {written.num:04d} already exists, skipped writing "
                f"(idempotent); keep existing file"
            )
        return written.filename

    @tool(show_result=True)
    def save_resource(resource_md: str) -> str:
        """写全课程共享 resource.md 到课程包根目录（覆盖已有内容）。

        Args:
            resource_md: resource.md 全文。

        Returns:
            落盘文件名 resource.md。
        """
        return repo.write_resource(resource_md)

    @tool(show_result=True)
    def read_previous_lesson() -> str:
        """读最大编号 lesson 的 md 全文（ZPD 渐进上下文）。

        用于生成新课前衔接上一课，避免重复或跳跃。没有已生成课程时返回空
        字符串。

        Returns:
            最大编号 lesson 的 md 全文；无任何课程时返回空字符串 ""。
        """
        return repo.read_previous_lesson()

    @tool(show_result=True)
    def save_mission(mission_md: str) -> str:
        """写学习使命文档 MISSION.md 到课程包根目录（task-365）。

        每门课程根目录一份，记录「为什么学 / 成功长什么样 / 约束 / 不做范围」，
        是后续每课教学决策可溯源的目标依据。幂等：文件已存在（渐进产出 / 整 run
        重试）时不覆盖，返回跳过提示。

        Args:
            mission_md: MISSION.md 全文（严格按模板，keep it short）。

        Returns:
            落盘文件名 MISSION.md；已存在则返回跳过提示（不重复写）。
        """
        result = repo.write_mission(mission_md)
        if result is None:
            return (
                "MISSION.md already exists, skipped writing (idempotent); "
                "keep existing mission"
            )
        return result

    @tool(show_result=True)
    def read_mission() -> str:
        """读学习使命文档 MISSION.md 全文（task-365 溯源）。

        每课生成前调用，把教学决策对齐到课程目标（Why / Success looks like /
        Constraints / Out of scope）。文件缺失时返回空字符串。

        Returns:
            MISSION.md 全文；无该文件时返回空字符串 ""。
        """
        return repo.read_mission() or ""

    @tool(show_result=True)
    def save_exercise(exercises: str) -> str:
        """把练习题写入 ``<num>-<slug>.exercise.md``（与缺练习的课配对）。

        配对目标 = 磁盘上**有 body 但没有对应 exercise 文件**的最近一课
        （``repo.latest_lesson_without_exercises``）：正常流程匹配刚写的本课；
        整 run 重试时（body 已在上一轮落盘）仍能补到缺练习的那一课，不要求
        传编号。

        Args:
            exercises: Exercise 对象列表的 JSON 字符串。字段规则见
                ``COURSE_AGENT_INSTRUCTIONS``「练习规范」：``answer`` 类型必须
                与 ``type`` 严格一致（single_choice→str / multi_choice→list[str] /
                true_false→bool），``explanation`` 必填。

        Returns:
            落盘文件名（如 0001-rust-ownership.exercise.md）；没有需要配对的
            lesson 或 ``exercises`` 非法（非 JSON / 字段不符）时返回错误说明，
            agent 可修正后重新调用本工具。
        """
        target = repo.latest_lesson_without_exercises()
        if target is None:
            return (
                "save_exercise 失败：未找到需要配对的课程（请先调用 "
                "save_lesson 写本课正文）。"
            )
        num, slug = target
        try:
            items = [
                Exercise.model_validate(item) for item in json.loads(exercises)
            ]
        except Exception as exc:
            return (
                f"save_exercise 失败：exercises 不是合法 JSON 或字段不符合 "
                f"Exercise 规范（{exc}）。请修正后重新调用本工具。"
            )
        return repo.write_exercise(
            num=num,
            slug=slug,
            title="课程练习",
            exercises=items,
        )

    return [
        save_lesson,
        save_resource,
        read_previous_lesson,
        save_mission,
        read_mission,
        save_exercise,
    ]


__all__ = ["create_learning_tools"]
