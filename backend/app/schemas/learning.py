"""Learning schemas."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

# ── 课程生成与产物 ───────────────────────────────────────────────────────── #


class CourseGenerateInput(BaseModel):
    """用户提交的学习主题"""

    topic: str = Field(..., min_length=1, description="要学习的主题")
    goal: str | None = Field(
        default=None,
        max_length=200,
        description="学习目标（可选，≤200 字符），用于组织 MISSION.md 具体文案",
    )


class CourseStatus:
    """课程生成状态字面量集合。"""

    PENDING: Literal["pending"] = "pending"
    READY: Literal["ready"] = "ready"
    FAILED: Literal["failed"] = "failed"


CourseStatusLiteral = Literal["pending", "ready", "failed"]


# ── 练习（Exercise） ───────────────────────────────────────────────────── #


class ExerciseOption(BaseModel):
    """选择题选项"""

    key: str = Field(..., description="选项键，如 A/B/C/D")
    text: str = Field(..., description="选项文案")


class Exercise(BaseModel):
    """单个练习题"""

    id: int = Field(..., ge=1, description="题号，从 1 开始")
    type: Literal["single_choice", "multi_choice", "true_false"] = Field(
        ..., description="题型"
    )
    difficulty: int = Field(..., ge=1, le=3, description="难度（1–3）")
    points: int = Field(..., ge=0, description="分值")
    prompt: str = Field(..., description="题干")
    options: list[dict[str, str]] | None = Field(
        default=None,
        description="选项列表 [{key, text}]，选择题必填，判断题留空为 None",
    )
    answer: str | list[str] | bool = Field(
        ..., description="参考答案：单选 str / 多选 list[str] / 判断 bool"
    )
    explanation: str = Field(..., description="解答说明（必填，D2）")


# ── 课程包 ──────────────────────────────────────────────────────────────── #


class LessonItem(BaseModel):
    """单个课程（teach skill 对齐：一课一文件）。

    ``id`` 从 1 起，是进度 ``sessions_done`` 的编号依据；``slug`` 参与
    磁盘文件名（``<num>-<slug>.md`` 与 ``<num>-<slug>.exercise.md``）。
    """

    id: int = Field(..., ge=1, description="课序号，从 1 开始")
    title: str = Field(..., description="课标题")
    slug: str = Field(..., description="dash-case 课标识，用于文件名")
    md: str = Field(..., description="该课正文全文")
    exercises: list[Exercise] = Field(
        default_factory=list,
        description="该课练习（解析自 <num>-<slug>.exercise.md 的 front matter）",
    )


class CoursePackage(BaseModel):
    """按课重构后的课程包（内存层结构）。

    - ``lessons`` 只含**已生成**的课（渐进产出时列表随 ``POST /lessons`` 增长）。
    - ``resource_md`` 是全课程共享参考资料，独立于各课。
    - ``mission_md`` 是本课程学习使命文档（MISSION.md 全文），缺失为 None。
    """

    course_id: str = Field(..., description="课程唯一 ID")
    topic: str = Field(..., description="原始主题")
    lessons: list[LessonItem] = Field(
        default_factory=list, description="已生成的课列表（渐进产出时增长）"
    )
    resource_md: str = Field(..., description="resource.md 全文")
    mission_md: str | None = Field(
        default=None, description="MISSION.md 全文（学习使命文档），缺失为 None"
    )
