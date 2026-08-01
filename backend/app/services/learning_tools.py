"""课程 agent 工具集合（agent_driven 重构第 2 步，纯新增，不接入 service）。

为「单一课程 agent 通过工具自主执行」提供磁盘工具：

- :func:`create_learning_tools` 是工厂：捕获 ``course_dir``（课程包根目录），
  返回五个 ``@tool(show_result=True)`` 装饰后的 agno ``Function``。
- ``save_lesson``：写 ``lessons/<num>-<slug>.md``。编号自动取磁盘已有最大编号
  +1（首课 ``0001``），幂等（该编号文件已存在则跳过不重复写）。
- ``save_resource``：写 ``resource.md``。
- ``read_previous_lesson``：读最大编号 lesson 的 md 全文（ZPD 渐进上下文）。
- ``save_mission``：写 ``MISSION.md``（学习使命文档），已存在则跳过（幂等，
  天然覆盖整 run 重试）。
- ``read_mission``：读 ``MISSION.md`` 全文（缺失返回空字符串，渐进产出溯源）。

工具签名只暴露内容参数（title/slug/lesson_md/resource_md/mission_md）；编号 /
幂等 / 路径全部由工具内部确定性控制，agent 不需要也不能传编号。

复用 ``app.services.learning_utils`` 的磁盘扫描 helpers：
``list_existing_lesson_ids`` / ``lesson_file_exists`` / ``_last_lesson_md``，
不复制重写。

文件命名沿用 learning 模块的约定：
``lessons/{num:04d}-{slug}.md``（与 ``{num:04d}-{slug}.exercise.md`` 同源，
解析/格式化逻辑直接复用）。
"""

from __future__ import annotations

from pathlib import Path

from agno.tools import tool
from agno.tools.function import Function

from app.services.learning_utils import (
    _last_lesson_md,
    lesson_file_exists,
    list_existing_lesson_ids,
)


def create_learning_tools(course_dir: str | Path) -> list[Function]:
    """返回课程 agent 可调用的工具集合（闭包捕获 ``course_dir``）。

    Args:
        course_dir: 课程包根目录（含 ``lessons/`` 子目录、``resource.md`` 与
            ``MISSION.md``）。

    Returns:
        ``[save_lesson, save_resource, read_previous_lesson, save_mission,
        read_mission]``，均为 agno ``Function``（``@tool(show_result=True)``
        装饰），可直接传给 Agent。
    """
    root = Path(course_dir)
    lessons_dir = root / "lessons"
    resource_path = root / "resource.md"
    mission_path = root / "MISSION.md"

    @tool(show_result=True)
    def save_lesson(title: str, slug: str, lesson_md: str) -> str:
        """写一课正文到 lessons/<num>-<slug>.md（课程包根目录内）。

        编号由工具内部扫描磁盘确定：next_num = max(已有编号) + 1（首课为
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
        existing_ids = list_existing_lesson_ids(lessons_dir)
        num = (max(existing_ids) + 1) if existing_ids else 1
        if lesson_file_exists(lessons_dir, num):
            return (
                f"lesson {num:04d} already exists, skipped writing "
                f"(idempotent); keep existing file"
            )
        lessons_dir.mkdir(parents=True, exist_ok=True)
        filename = f"{num:04d}-{slug}.md"
        (lessons_dir / filename).write_text(lesson_md, encoding="utf-8")
        return filename

    @tool(show_result=True)
    def save_resource(resource_md: str) -> str:
        """写全课程共享 resource.md 到课程包根目录（覆盖已有内容）。

        Args:
            resource_md: resource.md 全文。

        Returns:
            落盘文件名 resource.md。
        """
        root.mkdir(parents=True, exist_ok=True)
        resource_path.write_text(resource_md, encoding="utf-8")
        return "resource.md"

    @tool(show_result=True)
    def read_previous_lesson() -> str:
        """读最大编号 lesson 的 md 全文（ZPD 渐进上下文）。

        用于生成新课前衔接上一课，避免重复或跳跃。没有已生成课程时返回空
        字符串。

        Returns:
            最大编号 lesson 的 md 全文；无任何课程时返回空字符串 ""。
        """
        existing_ids = list_existing_lesson_ids(lessons_dir)
        return _last_lesson_md(lessons_dir, existing_ids) or ""

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
        if mission_path.exists():
            return (
                "MISSION.md already exists, skipped writing (idempotent); "
                "keep existing mission"
            )
        root.mkdir(parents=True, exist_ok=True)
        mission_path.write_text(mission_md, encoding="utf-8")
        return "MISSION.md"

    @tool(show_result=True)
    def read_mission() -> str:
        """读学习使命文档 MISSION.md 全文（task-365 溯源）。

        每课生成前调用，把教学决策对齐到课程目标（Why / Success looks like /
        Constraints / Out of scope）。文件缺失时返回空字符串。

        Returns:
            MISSION.md 全文；无该文件时返回空字符串 ""。
        """
        if not mission_path.exists():
            return ""
        return mission_path.read_text(encoding="utf-8")

    return [save_lesson, save_resource, read_previous_lesson, save_mission, read_mission]


__all__ = ["create_learning_tools"]
