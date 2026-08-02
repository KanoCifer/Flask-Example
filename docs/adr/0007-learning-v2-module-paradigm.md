# ADR 0007: Learning v2 模块范式（agent_driven + 渐进产出）

- **Status**: Accepted
- **Date**: 2026-08-02
- **Author**: Kuroome
- **Supersedes**: -

## Context

Learning v2 模块（`backend/app/api/v2/learning.py` + `backend/app/services/course_generator_service.py` + `backend/app/services/learning_progress_service.py` + `backend/app/repositories/course_package_repo.py` + `backend/app/repositories/learning_repo.py` + `backend/app/plugins/task/tasks/learning.py`）经过 task-337 / task-351 / task-352 / task-3553 / task-3554 / task-373 / task-374 一系列重构后，已收敛为一个**强耦合的范式整体**。六大子决策相互依赖，单独记录会丢失关键上下文：

1. **C2 拆分（task-374）**：fat `LearningService` 拆为 `CourseGeneratorService` + `LearningProgressService`，构造顺序固定且单向依赖。
2. **C1 课程包深模块所有者（task-351 衍生）**：磁盘课程包的所有布局 / 命名 / 编号 / 原子写 / 装配 / 练习配对知识统一归 `CoursePackageRepo`，service / tools / utils 全部薄转发。
3. **agent_driven 一次主 run（task-3553）**：放弃原 Step1/Step2/Step3 三步流水线（含独立研究步），改为一次 `arun` 让 agent 自主调用 4 个写盘 tool；不传 `output_schema`，`use_json_mode=False`。
4. **渐进产出磁盘幂等（task-352）**：`next_lesson_num() = max(existing ids) + 1`；service 内部不持状态；worker 重入靠文件存在判断；编号完全由仓库决定、调用方（含 agent tool）不传编号。
5. **session_id 复用（task-373）**：首课锚定 → 落 `LearningProgress.session_id` → 渐进产出各轮从 progress 读出透传 → agent 跨 run 复用同一 agno 会话。
6. **兜底重试位置（task-3554）**：失败由 `_generate_lesson` 在 run 结束后用 `COURSE_AGENT_RETRY_HINT` 追加提示再跑一轮；两次失败抛 `RuntimeError`；`generate_course` 捕获后调 `_mark_failed`，`generate_next_lesson` 只 re-raise 不标 failed（课程主体仍 ready）。

现有 6 篇 ADR（双前端 / 数据层 / 后端分层 / Go 后端 / 日志编排）均未覆盖本范式任一子决策。新人 onboarding 时只能从代码注释里倒推"C2 拆分为什么不可逆"，缺乏审计级别的 trade-off 记录。

## Decision

将六大子决策作为**单一范式**记录。后续任何推翻其中一条的尝试，都必须先评估对其他五条的连带影响。

### 1. C2 拆分：LearningProgressService 与 CourseGeneratorService 单向依赖

**决策**：原 fat `LearningService` 拆为两个 service：

- `LearningProgressService`（纯进度领域）—— 仅感知 `LearningRepo`（Mongo），不感知 agno / DeepSeek / 课程包磁盘布局。
- `CourseGeneratorService`（生成编排）—— 不直接持有 `LearningRepo`；进度读写全部经构造时注入的 `progress_svc`（`mark_ready` / `get_progress`）。

**构造顺序**（`appstate.py`）固定：

```
progress_svc = LearningProgressService()
course_gen_svc = CourseGeneratorService(progress_svc=progress_svc)
```

**API 层**（`api/v2/learning.py`）通过 `Depends(get_app_state)` 同时拿到两个 service；**不**在 handler 内做 service 编排。

**不能** 走的方向：`course_gen_svc` 直接 import `LearningRepo`、`progress_svc` 反向依赖 `course_gen_svc`、把进度读写塞回 handler。

### 2. C1 课程包深模块所有者：CoursePackageRepo

**决策**：磁盘课程包的所有知识**单一所有者**为 `CoursePackageRepo`：

- 布局：`course_id` + `tmp_dir` 解析出根目录，派生 `lessons_dir` / `resource_path` / `mission_path`。
- 命名约定：`<num:04d>-<slug>.md`（与 `<num:04d>-<slug>.exercise.md` 同源配对），解析 / 格式化只在此处。
- 写策略：`next_lesson_num()`（磁盘最大编号 + 1）、`lesson_file_exists()`（幂等命中）、`latest_lesson_without_exercises()`（exercise 配对）、原子写（临时文件 + `os.replace`）。
- 读路径：`assemble_lessons()` / `read_previous_lesson()` / `read_mission()` / `read_resource()` / `read_exercises()`。

**调用方**（`CourseGeneratorService` / `create_learning_tools` 闭包 / `learning_utils.py`）**不**能传编号、**不**能直接拼路径、**不**能绕过仓库写策略。

**唯一允许的旁路**：`LEARNING_ROOT_DIR` 环境变量（`get_settings()`）控制根目录注入路径，单元测试可注入 `tmp_dir` 指向临时目录。

**`learning_utils.py` 的边界**：本模块只保留纯文本与身份工具（`_progress_to_dict` / `build_course_id` / `_slugify`），**不**拥有任何磁盘课程包知识。

### 3. agent_driven：一次主 agent run 写四件套

**决策**：课程生成为**一次主 agent run**：

- 单一课程 agent 绑定 4 个写盘 tool（`save_lesson` / `save_resource` / `save_mission` / `save_exercise`）+ 1 个只读 `FileTools(base_dir=repo.root, enable_read_file=True)`。
- 配置了 `EXA_API_KEY` 时再追加研究工具（`ExaTools` + `Context7 MCPTools`），未配置则不挂（优雅降级）。
- `arun` **不带 `output_schema`**，最终响应内容被忽略，练习题由 `save_exercise` 工具落盘。
- `use_json_mode=False`（不再要求 DeepSeek JSON-mode 合规），根治"模型把工具结果回显进最终响应 → 解析失败 → 整轮重试"这一类问题。

**`CourseGeneratorService._generate_lesson` 的契约**：

- 一个共享 `repo` 实例（供 agent tool 写盘 + service 落盘 exercise 配对用同一 `last_written_lesson`）。
- 跑完 `arun` 后从 `repo.last_written_lesson` 读回 `(num, slug)`，再 `repo.read_exercises(num, slug)` 拿练习题。
- 缺 body / exercise → 触发第六条"兜底重试"。

**指令与会话**：`instructions` 用融合的 `COURSE_AGENT_INSTRUCTIONS`（不再分 Step1 / Step2）；`session_id` 透传给 `arun`（首课由 `generate_course` 锚定，渐进产出由 progress 透传）。

### 4. 渐进产出：磁盘为幂等权威

**决策**：api 端点 `POST /v2/learning/courses/{course_id}/lessons` 的语义：

- **同步幂等预检**（`CourseGeneratorService.preview_next_lesson`）：一次调用带回进度状态 + 预期 `next_num` + 幂等命中标记 + `kiq` 转发所需字段（topic / goal / session_id）。
- 命中（`already_generated=True`）→ 立刻返回 `{status: "already_generated", next_lesson: null}`，**不**走 `.kiq()`。
- 失败（progress 不存在 / `failed`）→ 立刻返回 `{status: "failed"}`，与 `GET /courses/{id}` 的 404 惯例对称。
- 否则 `.kiq()` 异步任务，返回 `{course_id, next_lesson: <预期编号>, status: "pending"}`；前端继续轮询 `GET /courses/{id}` 看 `lessons` 列表增长。

**worker 端幂等**（`CourseGeneratorService.generate_next_lesson`）：扫描 `lessons/` 找 `next_num`；若该编号对应文件已存在（重试 / 并发场景）→ **直接返回 None**，不重复生成。

**编号完全由仓库决定**：调用方（含 agent tool 闭包）**不**传编号，写盘侧只传 `slug` 与 `lesson_md`。

### 5. session_id 复用：首课锚定，渐进产出透传

**决策**：

- `LearningProgress.session_id` 字段（`null` → 字符串）记录首课生成时锚定的 agno session ID。
- 首课生成（`generate_course`）：`session_id = uuid4().hex` → 传给 `arun` → 落 `LearningProgress.session_id`（经 `mark_ready`）。
- 渐进产出（`generate_next_lesson`）：从 `progress.session_id` 读出 → 透传 `arun`。
- task 层 `generate_next_lesson` 接收 `session_id` 参数，由 API 层从 `preview_next_lesson` 出发时带上。

**create_agent 已硬编码** `add_history_to_context=True, num_history_runs=20`，前序 run 的消息会被回放进 context。两轮（包括兜底重试的 attempt 2）都传同一个 `session_id`，agent 能看到上一轮为何失败。

**不再** 走的方向：每个 lesson 新建一个 session（丢失跨轮记忆）、把 `num_history_runs` 调成 0（关掉历史回放）。

### 6. 兜底重试：service 内部整 run 重试，不挂 broker 级重试

**决策**：失败由 `CourseGeneratorService._generate_lesson` 在 `arun` 结束后处理：

- 缺 `repo.last_written_lesson` 或 `skipped=True` → `RuntimeError` → 触发整 run 重试一次（attempt 2）。
- 缺 `repo.read_exercises(num, slug)` 解析结果 → `RuntimeError` → 触发整 run 重试一次。
- attempt 2 用 `base + "\n\n" + COURSE_AGENT_RETRY_HINT` 追加提示，指示 agent 补调 `save_lesson` / `save_exercise` 落盘。
- 两次失败 → 抛 `RuntimeError`（外层 `generate_course` 捕获后调 `_mark_failed`，`generate_next_lesson` 只 re-raise 不标 failed）。

**任务层**（`plugins/task/tasks/learning.py`）**不**挂 broker 级 `SmartRetryMiddleware`：失败由 service 内部整 run 重试一次承接，再失败由 task 层捕获 / re-raise / `_mark_failed` 终结。

**为什么不在 broker 层重试**：broker 重试只会重新投递原始消息，**不会**改 prompt，无法补齐"agent 漏调 `save_lesson` / `save_exercise`"的根因。retry hint 必须在 service 层串入 prompt。

### 7. 衍生约束：lesson body 与 exercise 文件的配对

由第 2 条（C1 所有者）+ 第 3 条（agent_driven）共同决定：

- `save_lesson` 写盘后 `repo.last_written_lesson` 记录 `(num, slug)`。
- `save_exercise` 用 `repo.latest_lesson_without_exercises()` 找配对目标（正常流程匹配刚写的本课；整 run 重试时匹配缺练习的那一课）。
- service 端跑完 `arun` 直接消费 `repo.last_written_lesson` 配对 `read_exercises(num, slug)`，**不**从磁盘反推。
- 这条约束保证：一次 run 写多课、或重试顺序变化，都不会让 exercise 与 lesson body 错位。

## Consequences

### Positive

- **范式整体可审计**：新人 onboarding 不必在 6 个 commit message / 7 段代码注释之间反复跳转。
- **重写既存代码有依据**：任何想推翻其中一条子决策的尝试，都必须先评估对其他五条的连带影响，避免局部最优破坏全局约束。
- **跨任务引用清晰**：task-3553 / task-352 / task-374 / task-373 / task-3554 / task-337 在 PR 描述和 commit message 引用"见 ADR-0007"即可，节省 reviewer 上下文。
- **测试策略可统一**：本范式下测试分成 4 层（handler / service / agent / 磁盘），与 ADR-0004 的分层一致。

### Negative

- **ADR 较长**：6 条子决策合并文档化 → 单篇 200+ 行；replaces 短期内无法拆。
- **后续演进成本**：任何调整都要先在 ADR 上做 amendments（或新立 ADR 标注 `Supersedes`），推翻决策的迁移成本高。
- **与 Go 后端差异**：Go 后端（`go-backend/`）按 ADR-0005 独立演进，本范式不直接适用；ADR 不强制跨语言一致性。

### 衍生约束（必须遵守）

- **API handler**：handler 内**不**调用 `repo` 私有属性 / `course_dir` 路径拼接 / 裸磁盘扫描（违反 C2 + C1）。
- **service 入口**：service 之间通过构造时注入形成依赖，**不**在方法内 import 另一个 service 模块。
- **agent tool 签名**：写盘 tool 签名只暴露内容参数（title / slug / lesson_md / resource_md / mission_md / exercises），**不**暴露 `num` / `path` / `repo`。
- **任务层**：task 函数**只**做"取 service → 调方法 → 失败标记"三件事，**不**做业务编排。

## Alternatives Considered

### 1. C2 拆分 vs 维持 fat LearningService

**备选**：保留 fat `LearningService`，同一个类里混合进度读写与生成编排。

**拒绝理由**：进度读写耦合了 generator 的私有 `_repo` / `_course_dir` 路径，handler 端需要打穿 service 私有属性做幂等预检（task-352 早期版本）；新增 async 任务时无法单独 mock 进度读写；测试 fixture 需要同时构造 Mongo + 磁盘 + agent，跨用例重置成本高。

### 2. C1 课程包所有者 vs 维持分散的磁盘知识

**备选**：把 `lessons/` 命名 + `next_lesson_num()` 留在 `learning_utils.py`，写策略继续埋在 `learning_tools.py` 的 `@tool` 闭包里。

**拒绝理由**：handler 端 / service 端 / agent tool 端各自扫描一次磁盘，可能算错两版 `next_num`（task-351 早期版本的问题）；三处命名规则要靠"约定"维护，无法静态保证；utility 模块与 service + tool 互相 import 容易形成循环。

### 3. agent_driven 一次 run vs 三步流水线（Step1 写课 + Step2 写 resource + Step3 出题）

**备选**：保留 task-3553 之前的三步流水线（含独立的 Exa / Context7 研究步），每步一个 LLM 调用。

**拒绝理由**：(a) 三步是三个独立 `arun`，每个都需要单独的 `output_schema` / `use_json_mode=True`，依赖 DeepSeek JSON-mode 合规——模型偶尔把工具结果回显进最终响应导致解析失败，整轮重试代价大；(b) 资源研究与课内容生成被流水线割裂，agent 写课时无法回头参考研究材料；(c) 出题环节与 lesson 写在两次 run 里，prompts 之间没有共享的 conversation history，agent 容易出"题目与正文重复" / "示例与练习脱节"。

### 4. 渐进产出磁盘幂等 vs 数据库自增 ID / 时间戳命名

**备选**：用 MongoDB 自增 `lesson_seq` 字段或 lesson `created_at` 决定编号。

**拒绝理由**：(a) 数据库自增 ID 与"lesson 是否真实落盘"解耦——agent 跑了 90% 失败时，DB 已增 ID 但磁盘没文件，下次还要特判；(b) 时间戳命名在并发生成同一课程时会冲突；(c) 磁盘扫描 `next_lesson_num()` 是 O(n) 但课程一般 < 20 课，开销可忽略；(d) 整 run 重试天然要靠"文件已存在"判断，DB 自增 ID 反而成为额外状态。

### 5. session_id 复用 vs 每课独立 session

**备选**：每个 lesson 新建一个 agno session（`session_id = uuid4().hex` per call）。

**拒绝理由**：agno `create_agent` 已硬编码 `add_history_to_context=True, num_history_runs=20`，单 session 内回放前序消息是 agent 跨轮记住"上一课的主题 / 关键词 / 习题风格"的唯一手段；每课独立 session 会让 agent 反复出现"覆盖上节内容 / 重复示例 / 风格漂移"问题。task-373 中实测回归此现象。

### 6. 兜底重试在 service 内 vs 挂 broker 级 SmartRetryMiddleware

**备选**：在 task 层挂 `SmartRetryMiddleware` 让 RabbitMQ 自动重试失败任务。

**拒绝理由**：broker 重试只能重新投递原始消息，prompt 不变；agent 已经在 attempt 1 用同 prompt 漏调 `save_lesson` / `save_exercise`，attempt 2 仍会漏调。retry hint 必须在 service 层串入 prompt 才有意义。task-3554 早期版本尝试过 broker 重试，确认无效。
