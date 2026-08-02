"""课程 agent 构造 + 单次 agent run 执行器（B 拆分，从 CourseGeneratorService 拆出）。

从 :class:`app.services.course_generator_service.CourseGeneratorService` 拆出的
**生成执行侧**：course agent 构造（:meth:`build_course_agent`）与「一次主 agent
run 生成一课」的循环（:meth:`run_lesson`）。拆出后 service 退化为**编排 + 混合读**
门面，本类持有 agno / DeepSeek / 磁盘校验的全部执行细节，二者以「每次 run 构造
一次 runner / 共享一个 :class:`CoursePackageRepo` 实例」衔接。

- :meth:`build_course_agent`：绑定 learning 工具（LessonWriter / ExerciseWriter /
  只读 FileTools）+ 可选研究工具（Exa + Context7），与 :data:`COURSE_AGENT_INSTRUCTIONS`。
- :meth:`run_lesson`：一次 run 内 agent 经工具把 lesson body / RESOURCE.md /
  MISSION.md / exercise.md 全部落盘；``arun`` 走 **stream 模式**（``stream=True,
  stream_events=True``，产品按流式计费，费用低）——事件被丢弃，产物仍由工具落盘、
  最终响应文本本就忽略。run 后以目标编号 ``lesson_num`` 经
  :meth:`CoursePackageRepo.find_lesson` 回查磁盘校验，缺正文 / 缺练习触发一次
  整 run 重试（task-3554）。

依赖方向：service → runner → learning_tools → course_package_repo；runner 不感知
进度（``LearningProgress``），与进度侧解耦。
"""

from __future__ import annotations

from pathlib import Path

from agno.agent import Agent
from agno.models.base import Model

from app.core.config import get_settings
from app.core.llm_factory import (
    create_agent,
    create_deepseek_model,
    create_postgres_db,
)
from app.core.llm_prompts import (
    COURSE_AGENT_INSTRUCTIONS,
    COURSE_AGENT_NEXT_LESSON_HINT,
    COURSE_AGENT_RETRY_HINT,
    COURSE_AGENT_USER_PROMPT_TEMPLATE,
    DEFAULT_GOAL_HINT,
)
from app.core.logger import logger
from app.repositories.course_package_repo import CoursePackageRepo
from app.services.learning_tools import create_learning_tools


class CourseAgentRunner:
    """课程 agent 构造与单次 run 执行器。

    Args:
        model: 可选注入；为 None 时用 ``create_deepseek_model()`` 默认值。
            测试时可注入 mock。
        agent: 可选注入；为 None 时按 model + 默认 db 即时构建。
            :meth:`build_course_agent` 注入时以其 model / db 为模板新建一份，
            避免 ``deepcopy(agent)`` 复制 run state / session 缓存带来的
            共享状态风险。
        tmp_dir: 课程包根目录；为 None 时依次取 ``LEARNING_ROOT_DIR`` 环境变量、
            无则回退 ``<backend>/tmp/learning``。单元测试可注入
            :class:`pathlib.Path` 指向临时目录。
    """

    def __init__(
        self,
        *,
        model: Model | None = None,
        agent: Agent | None = None,
        tmp_dir: Path | None = None,
    ) -> None:
        self._model = model
        self._agent = agent
        self._tmp_dir = tmp_dir

    async def build_course_agent(
        self, repo: CoursePackageRepo, model_id: str = "deepseek-v4-flash"
    ) -> Agent:
        """构建**单一课程 agent**（agent_driven 重构核心路径，task-3553 已切换）。

        为「一次主 agent run」提供 agent：

        - **instructions** 用融合的 :data:`COURSE_AGENT_INSTRUCTIONS`
          （写课 + 出题 + 工具使用 + 研究 + ZPD 说明），不再分 Step1 / Step2。
        - **tools 显式传**：:func:`create_learning_tools` 返回的两个写磁盘工具
          （``LessonWriter`` / ``ExerciseWriter``，issue #29）+ 一个
          只读 ``FileTools(base_dir=repo.root, enable_read_file=True)`` 为基底；
          配置了 ``EXA_API_KEY`` 时再追加研究工具（ExaTools + Context7
          MCPTools），未配置则不挂（优雅降级——agent 上下文里没有搜索工具，
          自然跳过研究）。
        - 注入 ``self._agent`` 时以其 model / db 为模板新建一份；否则走 factory
          ``create_deepseek_model`` + ``create_postgres_db``。

        无 ``output_schema``（练习由 ``ExerciseWriter`` 工具落盘）→
        ``use_json_mode=False``，不再要求 DeepSeek JSON-mode 合规。

        Args:
            repo: 课程包仓库实例，传给 :func:`create_learning_tools` 薄适配器
                （与 :meth:`run_lesson` 的 run 后校验共用同一实例）。

        Returns:
            已绑定 learning tools（+ 可选研究工具）与
            :data:`COURSE_AGENT_INSTRUCTIONS` 的 :class:`Agent`。
        """
        tools = list(create_learning_tools(repo))

        exa_api_key = get_settings().EXA_API_KEY
        if exa_api_key:
            # 课程 agent 研究工具裁剪（task-3553）：Exa 全子工具 + Context7
            # MCPTools。MCPTools 作为 agent 常驻工具时生命周期由 agno 自动管理
            # （arun 内 connect / 结束后 disconnect），无需手动 async with。
            from agno.tools.exa import ExaTools
            from agno.tools.mcp import MCPTools

            ctx7 = MCPTools(
                transport="streamable-http",
                url="https://mcp.context7.com/mcp",
            )
            try:
                await ctx7.connect()
            except Exception as exc:
                logger.warning(
                    "Context7 MCP connect failed, dropping tool",
                    error=str(exc),
                )
                await ctx7.close()  # 失败也 close 清理
                ctx7 = None
            if ctx7 is not None:
                tools.append(ctx7)  # pyright: ignore[reportArgumentType]

            tools.append(
                ExaTools(api_key=exa_api_key, all=True, show_results=True),  # pyright: ignore[reportArgumentType]
            )

        if self._agent is not None:
            # 只透传 create_agent 不硬编码、且不会与默认值冲突的模板属性
            # （model / db / tools）。markdown / add_history_to_context /
            # num_history_runs 被 create_agent 硬编码，透传会触发
            # "got multiple values for keyword argument"（注入路径的既有缺陷，
            # 本方法不复刻）。
            return create_agent(
                model=self._agent.model,  # pyright: ignore[reportArgumentType]
                instructions=COURSE_AGENT_INSTRUCTIONS,
                db=self._agent.db,  # pyright: ignore[reportArgumentType]
                tools=tools,
                use_json_mode=False,
            )
        return create_agent(
            model=self._model or create_deepseek_model(model_id),
            instructions=COURSE_AGENT_INSTRUCTIONS,
            db=create_postgres_db(),
            tools=tools,
            use_json_mode=False,
        )

    async def run_lesson(
        self,
        *,
        topic: str,
        course_id: str,
        owner: str,
        lesson_num: int,
        goal: str | None = None,
        session_id: str | None = None,
        repo: CoursePackageRepo | None = None,
        model_id: str = "deepseek-v4-flash",
        extra_prompt: str | None = None,
    ) -> None:
        """一次主 agent run 生成一课：四件套全部由 agent 经工具写盘。

        - 不再有独立研究步：研究由主 agent 的 ExaTools（配置了
          ``EXA_API_KEY`` 时）自主接管。
        - lesson body / RESOURCE.md / MISSION.md / exercise.md **全部由 agent
          在 run 内经工具写盘**（编号校验 / manifest / 原子写全在
          :class:`CoursePackageRepo`）；``arun`` **不带 ``output_schema``**，
          最终响应内容被忽略。
        - ``arun`` 走 **stream 模式**（``stream=True, stream_events=True``）：
          agno 按流式交付事件，产品按流式计费（费用低）。事件被丢弃——产物由
          工具落盘，与响应文本无关；``async for`` 完整消费流，run 才会推进到
          工具调用与磁盘写盘。
        - run 结束后只从磁盘读回：目标编号即入参 ``lesson_num``，用
          :meth:`CoursePackageRepo.find_lesson` 确认课正文已落盘并拿 ``slug``，
          再经 :meth:`CoursePackageRepo.read_exercises` 解析同名练习——不再有
          ``last_written_lesson`` 显式交接（issue #29 删除），重试顺序变化
          不会错位。

        会话记忆（task-373）：把 ``session_id`` 传给 ``Agent.arun``，让 agno
        复用同一会话（``create_agent`` 已硬编码 ``add_history_to_context=True,
        num_history_runs=20``），前序 run 的消息会被回放进 context。首课时
        ``session_id`` 由 service 锚定并落库到 ``LearningProgress.session_id``；
        后续课从 progress 读出后透传。两轮都传同一个 session_id（包括兜底重试的
        attempt 2），agent 能看到上一轮为何失败。

        首课额外提示（task-394）：``extra_prompt`` 仅首课路径（``lesson_num == 1``）
        注入用户消息——拼好「额外要求：<ep>」整行后填入模板的 ``{extra_prompt}``
        槽，空串 / ``None`` 时该槽渲染为空行（不出现"额外要求："字样）。

        下一课 lean prompt（task-394）：当 ``session_id`` 存在（即锚定了 agno
        会话、agent 能从上下文回放前序消息）时，user message 简化为仅
        ``course_id`` + :data:`COURSE_AGENT_NEXT_LESSON_HINT`——不再嵌
        ``topic`` / ``goal`` / ``extra_prompt``，避免与 session 历史里首课已
        收到的完整 prompt 重复。``session_id`` 缺失（老课程 / 测试直调）→ 回退
        完整 prompt（嵌 topic / goal + 下一课 hint），让无上下文的 agent 也能
        拿到必要输入。

        兜底重试（task-3554）：run 结束后的「目标编号 lesson_num 缺 body 文件」或
        「缺 exercise 文件」触发**整 run 重试一次**——第二次 run 用
        :data:`COURSE_AGENT_RETRY_HINT` 追加到用户消息（拼在 lean / 完整
        prompt 之上），指示 agent 补调 ``LessonWriter`` / ``ExerciseWriter``
        落盘；两次均失败则抛 ``RuntimeError``。重试只覆盖 run **之后**的校验
        失败；``arun`` 本身抛错不重试（直接上抛）。

        Args:
            topic: 课程主题（用于 prompt）。
            course_id: 课程 ID。
            owner: 进度归属（仅用于日志）。
            lesson_num: 目标课编号（首课为 1；渐进产出为 service 计算的 next_num）。
            goal: 学习目标（可选），组织 MISSION.md 文案。
            session_id: 已锚定的 agno 会话 ID（可选）。
            repo: 课程包仓库实例；为 None 时按 ``tmp_dir`` 新建（与 service 读侧同源）。
            model_id: 模型 ID（task-391），None 回退 flash。
            extra_prompt: 用户补充的额外提示（task-391/394），仅首课注入。

        Raises:
            RuntimeError: 单次 agent run 失败或 run 后产物缺失（body /
                exercise 文件未落盘），已重试一次。
        """
        repo = repo or CoursePackageRepo(
            course_id=course_id, tmp_dir=self._tmp_dir
        )
        course_agent = await self.build_course_agent(repo, model_id)
        ep_line = f"额外要求：{extra_prompt}" if extra_prompt else ""

        if lesson_num > 1 and session_id:
            base_prompt = (
                f"course_id：{course_id}\n\n{COURSE_AGENT_NEXT_LESSON_HINT}"
            )
        else:
            base_prompt = COURSE_AGENT_USER_PROMPT_TEMPLATE.format(
                topic=topic,
                course_id=course_id,
                goal=goal or DEFAULT_GOAL_HINT,
                extra_prompt=ep_line,
            )
            if lesson_num > 1:
                base_prompt = (
                    base_prompt + "\n\n" + COURSE_AGENT_NEXT_LESSON_HINT
                )
        retry_prompt = base_prompt + "\n\n" + COURSE_AGENT_RETRY_HINT

        last_error: RuntimeError | None = None
        for attempt in (1, 2):
            prompt = retry_prompt if attempt == 2 else base_prompt
            # 无 output_schema：产物全部由 agent 经工具落盘，最终响应内容忽略。
            # stream=True：agno 返回事件流，完整消费才推进 run（工具调用 / 写盘）；
            # 事件内容丢弃，仅按流式计费。
            async for _event in course_agent.arun(
                prompt, session_id=session_id, stream=True, stream_events=True
            ):
                pass
            try:
                # run 后校验：目标编号即入参 lesson_num（issue #29）。缺课正文
                # （agent 漏调 LessonWriter 写目标 num）→ RuntimeError 触发整
                # run 重试（task-3554）；正文落盘后读同名 exercise 校验练习。
                found = repo.find_lesson(lesson_num)
                if found is None:
                    raise RuntimeError(
                        "CourseAgent run 后未写课正文（目标编号 "
                        f"{lesson_num:04d} 未落盘 <num>-<slug>.md），无法配对练习文件"
                    )

                # 练习题由 agent 经 ExerciseWriter 工具直接落盘，run 后从磁盘读回；
                # 缺文件 / 解析为空（agent 漏调 ExerciseWriter 或内容非法）→ 重试。
                exercises = repo.read_exercises(found[0], found[1])
                if not exercises:
                    raise RuntimeError(
                        "CourseAgent run 后未落盘练习题（未调用 ExerciseWriter 或"
                        "内容非法），无法配对 exercise 文件"
                    )

                logger.bind(
                    course_id=course_id,
                    owner=owner,
                    lesson_num=found[0],
                    slug=found[1],
                    attempt=attempt,
                    exercise_count=len(exercises),
                ).info("learning lesson generated")
                return
            except RuntimeError as exc:
                last_error = exc
                logger.bind(
                    course_id=course_id,
                    owner=owner,
                    lesson_num=lesson_num,
                    attempt=attempt,
                ).warning(
                    "learning lesson attempt failed, will retry once"
                    if attempt == 1
                    else "learning lesson failed after retry",
                    error=str(exc),
                )

        raise RuntimeError(
            f"CourseAgent 生成课程失败（已重试一次）: {last_error}"
        ) from last_error


__all__ = ["CourseAgentRunner"]
