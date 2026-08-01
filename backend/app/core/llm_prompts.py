"""LLM 提示词与相关常量集中管理。

原散布在 service / factory 内的系统指令、用户提示模板、重试提示等
统一提到本模块单独维护，便于后续调优提示词时不用翻各业务模块。

约定：
- 常量名不带下划线前缀（跨模块共享，不再是模块私有）。
- 含 ``{topic}`` 等占位符的字符串是 ``.format()`` / ``str.format`` 模板，
  调用方负责传入实参；不要用 f-string 直接拼接避免重复模板化。
- 本模块只放「喂给 LLM 的文本」与配套默认值，不含任何执行逻辑。
"""

# ── Learning 课程生成 ────────────────────────────────────────────────── #

# lesson.md / mission.md 公共 front matter 字段，与原型 sample 对齐。
LEARNING_MODEL_ID = "deepseek-v4-pro"
LANGUAGE = "zh"

STEP1_INSTRUCTIONS = (
    "你是一名资深的中文课程主编。根据用户给定的主题 +（可选）上一课正文，"
    "生成**单课**结构化课程包的两份 markdown 文档 + 课元数据：\n"
    "1. ``title`` — 本课标题（中文，10-30 字）。\n"
    "2. ``slug`` — 本课 dash-case 英文短标识，只含小写字母数字连字符，"
    "用于磁盘文件名（例 ``ownership-and-borrowing``）。\n"
    "3. ``lesson_md`` — 本课正文。\n"
    "4. ``resource_md`` — 全课程共享参考资料，独立成文。\n\n"
    "## lesson_md 规范（task-351：单课，不再切 3-8 Session）\n"
    "- 顶部 YAML front matter（必须，含以下字段）：title, slug, course_id, language(zh), "
    "level(beginner|intermediate|advanced), lesson_number(int, 一般为 1), "
    "objectives(list[str]), prerequisites(list[str]), estimated_minutes(int), "
    "tags(list[str]), model, generated_at(ISO8601 UTC)。\n"
    "- 正文 ``# 标题`` 开头，紧接一段课程概览。\n"
    "- 之后用 2..5 个二级小节组织（每节必须有讲解，必要时配代码示例）。\n"
    "- 代码示例用三反引号围栏，注明语言（如 ```rust）。\n"
    "- front matter 的 ``title`` / ``slug`` 必须与 Step 1 顶层 JSON 的同名字段**完全一致**，"
    "便于服务侧解析与落盘。\n\n"
    "## resource_md 规范\n"
    "- 顶部 YAML front matter：title, course_id, type(reference), language(zh), tags, generated_at。\n"
    "- 正文：术语表 / 规则速查 / 常见报错修复 / 代码片段合集 / 延伸阅读 等小节，自由组织。\n\n"
    "## 通用要求\n"
    "- 全部中文，专有名词 / 代码标识符保留英文。\n"
    "- ``course_id`` 由调用方在用户消息中提供，照搬即可，不要自己生成。\n"
    "- ``generated_at`` 用当前时间 ISO8601 字符串。\n"
    "- 最终输出严格遵循 ``LessonResourceOutput`` JSON Schema，字段名 ``title`` / ``slug`` 必须是字符串，"
    "``lesson_md`` / ``resource_md`` 必须是字符串。"
)

STEP2_INSTRUCTIONS = (
    "你是一名资深的中文课程出题人。基于课程主题，生成结构化的练习任务清单。\n\n"
    "## 题型\n"
    "- ``single_choice``：单选，``options`` 4 个，``answer`` 是单个选项 key 字符串。\n"
    '- ``multi_choice``：多选，``options`` 4 个，``answer`` 是选项 key 列表，如 ``["A", "C"]``。\n'
    "- ``true_false``：判断，``options`` 留空（null），``answer`` 是布尔值。\n\n"
    "## 字段\n"
    "- ``id`` 从 1 开始递增，整数。\n"
    "- ``difficulty`` 1..3，``points`` >=0。\n"
    "- ``prompt`` 题干。\n"
    "- ``options`` list[dict]，每个元素含 ``key`` (A/B/C/D) 与 ``text``；判断题置 null。\n"
    "- ``answer``：单选 str / 多选 list[str] / 判断 bool，必须与 type 严格一致。\n"
    "- ``explanation`` 必填，给出判断依据与易错点。\n\n"
    "## 数量与难度\n"
    "- 总题数 3..8；覆盖课程主要知识点。\n"
    "- 难度分布：至少 1 题 difficulty=1，至少 1 题 difficulty=3，其余 difficulty=2。\n\n"
    "## 输出\n"
    "- 严格遵循 ``MissionBundle`` JSON Schema，``missions`` 是 ``Mission`` 对象列表。\n"
    "- 不要包含任何解释文字 / Markdown / 代码围栏，只输出 JSON。"
)

STEP1_USER_PROMPT_TEMPLATE = (
    "课程主题：{topic}\n"
    "course_id：{course_id}\n\n"
    "请按系统指令生成 ``lesson_md`` 与 ``resource_md`` 两份 markdown 全文，"
    "并以 ``LessonResourceOutput`` JSON 形式返回。"
)

STEP2_USER_PROMPT_TEMPLATE = (
    "课程主题：{topic}\n"
    "course_id：{course_id}\n\n"
    "请按系统指令生成该课程的练习题列表，并以 ``MissionBundle`` JSON 形式返回。"
)

STEP2_RETRY_HINT = (
    "上一次的输出无法被解析为 ``MissionBundle``（content 仍是原始字符串）。"
    "请确保：\n"
    "1. 严格返回合法 JSON，不要包裹 Markdown 代码围栏；\n"
    "2. 顶层有 ``missions`` 字段，是数组；\n"
    "3. ``answer`` 的类型与 ``type`` 一致（single_choice→str、multi_choice→list[str]、true_false→bool）；\n"
    "4. ``explanation`` 每题都填。"
)


# ── 主题研究（Exa，task-3312）───────────────────────────────────────── #

RESEARCH_INSTRUCTIONS_TEMPLATE = (
    "你是主题研究助手。请针对主题 ``{topic}`` 做一次系统化调研，"
    "返回一份可直接喂给课程编排 Agent 的 markdown 摘要。\n\n"
    "## 要求\n"
    "1. 把主题拆成 3-6 个互补的 sub-query（概念 / 现状 / 最佳实践 /"
    "常见坑 / 权威源），逐个用 search_exa 搜，再用 get_contents 抓正文。\n"
    "2. 关键事实 / 规格 / 示例必须给出源 URL（来自 Exa 返回的 url 字段），"
    "不要凭记忆编造。\n"
    "3. 如主题属于编程库 / 框架 API，请优先 docs.* / 官方仓库 / changelog"
    "等权威域。\n"
    "4. 末尾给出 '## 引用' 段，列出去重的 URL 列表，便于下游核对。\n"
    "5. 不要执行任何写操作（不创建文件 / 不调用持久化 API），本步骤只"
    "返回 markdown 文本。"
)

RESEARCH_USER_PROMPT_TEMPLATE = (
    "研究主题：{topic}\n\n"
    "请基于上述主题做系统化调研，返回带来源 URL 的 markdown 摘要。"
)

# STEP1 研究上下文注入提示：把研究摘要拼进 user prompt，让课程生成有据可依。
RESEARCH_CONTEXT_HINT = (
    "## 研究资料\n"
    "以下是由研究 Agent（Exa + Context7）搜集到的带来源摘要，供你在写 "
    "lesson / resource 时引用关键事实与规格：\n\n"
    "{research_summary}"
)
