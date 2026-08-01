"""课程 agent 工具集合（agent_driven 重构第 2 步，纯新增，不接入 service）。

为「单一课程 agent 通过工具自主执行」提供磁盘工具。C1 深化后，本模块从
「写策略实现」降级为**薄转发适配器**：所有磁盘知识（布局 / 命名 / 编号 /
幂等 / 原子写）统一由 :class:`CoursePackageRepo` 拥有，五个 ``@tool`` 闭包
只做参数转发与返回消息格式化。

- :func:`create_learning_tools` 是工厂：捕获一个 ``CoursePackageRepo`` 实例
  （service 每次 run 构造、与 exercise 配对共用同一个实例），返回五个
  ``@tool(show_result=True)`` 装饰后的 agno ``Function``。
- ``save_lesson``：委托 ``repo.write_lesson``，编号 / 幂等全在仓库内。
- ``save_resource``：委托 ``repo.write_resource``（覆盖写）。
- ``read_previous_lesson``：委托 ``repo.read_previous_lesson``（ZPD 渐进上下文）。
- ``save_mission``：委托 ``repo.write_mission``（幂等）。
- ``read_mission``：委托 ``repo.read_mission``。

工具签名只暴露内容参数（title/slug/lesson_md/resource_md/mission_md）——与
prompt 契约（``COURSE_AGENT_INSTRUCTIONS``）保持字符串一致，C4 的
「prompt ↔ 工具名」自动校验不在本候选范围。
"""

from __future__ import annotations

from agno.tools import tool
from agno.tools.function import Function

from app.repositories.course_package_repo import CoursePackageRepo


def create_learning_tools(repo: CoursePackageRepo) -> list[Function]:
    """返回课程 agent 可调用的工具集合（闭包捕获 ``repo``）。

    Args:
        repo: 课程包仓库实例（含该课程根目录的全部磁盘知识）。

    Returns:
        ``[save_lesson, save_resource, read_previous_lesson, save_mission,
        read_mission]``，均为 agno ``Function``（``@tool(show_result=True)``
        装饰），可直接传给 Agent。
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

    return [
        save_lesson,
        save_resource,
        read_previous_lesson,
        save_mission,
        read_mission,
    ]


__all__ = ["create_learning_tools"]
