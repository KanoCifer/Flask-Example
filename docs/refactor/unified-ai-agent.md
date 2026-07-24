# Refactor Plan: 统一 AI 功能 (backend/app/core/ → 单一 AiAgent)

> 状态: 待执行
> 涉及文件数: ~7
> 风险: 中（AI 输出行为可能因统一默认参数而变化）

## Problem Statement

`backend/app/core/` 中有两个独立的 agno Agent 类各自为战：

1. **`agent.py` → `ArticleSummarizer`**：文章总结 + 对话，已正确使用 `llm_factory`，走 `AiService` → `AppState` 注入。
2. **`weather_analyzer.py` → `WeatherAnalyzer`**：天气/钓鱼分析，**绕开 `llm_factory`** 直接 import agno，在模块加载时强制实例化全局单例（依赖 `FishingExpertScorer.WEIGHTS`），默认参数与工厂不一致。

后果：
- `llm_factory.py` 声称"消除重复布线"但 WeatherAnalyzer 从未使用它——同一套 `OpenAILike` + `Agent` + `RedisDb` 创建了两次，默认值不同。
- 天气分析的 `analyze_weather_stream` 硬编码了启动期依赖（`FishingExpertScorer`），无法测试、无法延迟初始化。
- 两个类各做各的流式迭代、session 查询、错误处理，无法共享改进。
- 无测试覆盖——改任何一处都无安全网。

## Solution

合并为单一 `AiAgent` 类，统管所有 agno 交互。所有 model/agent/db 创建都走 `llm_factory`。`AiAgent` 通过 `AppState` 注入（不再有模块级全局单例）。统一默认参数。

合并后 `backend/app/core/` 中 agno 相关文件从 3 个变为 2 个：`llm_factory.py`（工厂）+ `agent.py`（统一 AiAgent）。`weather_analyzer.py` 删除。

## Commits

每个 commit 都让代码库处于可工作状态。按顺序 Cherry-pick 安全。

---

### Commit 1: 在 `agent.py` 内引入统一 `AiAgent` 类（旧类暂保留）

**目标**：新增统一类，不改变任何现有行为。

- 在 `backend/app/core/agent.py` 中新增 `AiAgent` 类，聚合现有 `ArticleSummarizer` 与 `WeatherAnalyzer` 的全部公开方法：
  - 来自 `ArticleSummarizer`：`summarize` / `chat` / `get_history` / `get_cached_summary` / `get_cached_chat` / `get_agent_sessions`
  - 来自 `WeatherAnalyzer`：`analyze_weather_stream`
- `AiAgent.__init__` 接受 `db: RedisDb | None` 与 `expert_weights: dict | None`，内部统一走 `create_redis_db()`。
- 所有 model/agent 创建统一走 `llm_factory` 的 `create_llm_model` / `create_agent`。
- 统一默认参数：`temperature=0.3`、`timeout=60`、`num_history_runs=10`（沿用现有工厂默认值；天气分析不再特殊化）。
- `WeatherAnalyzer` 中的 Pydantic 输入 schema（`FishingContextInput` / `LiveWeatherInput` / `TideEventInput` / `TideHourlyInput` / `TideDataInput` / `DayForecastInput` / `WeatherAnalysisInputSchema`）移入 `agent.py` 或 `app/schemas/aiagent.py`。
- `analyze_weather_stream` 中「最终钓鱼指数」正则提取 + `on_index_calculated` 回调逻辑原样迁入。
- 旧 `ArticleSummarizer` 类与新 `AiAgent` 共存；`appstate.py` / `ai_service.py` / `public_service.py` 暂不修改。
- `core/__init__.py` 新增 `AiAgent` 导出（与 `ArticleSummarizer` 并存）。

**验证**：`uv run pytest` 通过（无行为变化）；`AiAgent` 尚未被调用。

---

### Commit 2: `AiService` + `AppState` 切换到 `AiAgent`（文章路径迁移）

**目标**：文章总结/对话统一走 `AiAgent`，天气分析暂不动。

- `AiService.__init__` 参数从 `summarizer: ArticleSummarizer` 改为 `agent: AiAgent`，内部字段 `self.summarizer` → `self.agent`。
- `AiService` 所有方法（`summary_stream` / `chat_stream` / `get_user_history` / `get_cached_summary` / `get_cached_chat` / `get_debug_sessions`）改为调用 `self.agent.*`。
- `appstate.py`：`ai_svc = AiService(agent=AiAgent(expert_weights=FishingExpertScorer.WEIGHTS))`。
- 天气分析仍由 `public_service.py` 调用旧 `weather_analyzer` 全局实例——两条路径暂时并行。

**验证**：`pytest` 通过；文章总结/对话端点行为不变；天气分析端点行为不变。

---

### Commit 3: 天气分析路径迁移到 `AiAgent`（`public_service.py` 去全局化）

**目标**：天气分析也走 `AiAgent`，删除模块级全局单例。

- `public_service.py` 的 `analyze_weather` 不再 `from app.core.weather_analyzer import weather_analyzer`，改为使用注入的 `AiAgent` 实例调用 `agent.analyze_weather_stream(...)`。
- `PublicState` / `AppState` 构造时把同一个 `AiAgent` 实例注入 `public_svc`（可通过构造参数或 `AppState` 字段共享）。
- `on_index_calculated` 回调（→ `FishingService.save_ai_analysis_feedback`）保留在 `public_service.py`，作为业务回调传入。
- `appstate.py` 不再在启动期构造 `WeatherAnalyzer`。

**验证**：`pytest` 通过；天气分析端点行为不变；`weather_analyzer.py` 不再被任何模块导入。

---

### Commit 4: 删除旧类 + 清理 `core/__init__.py`

**目标**：移除所有遗留代码，完成统一。

- 删除 `backend/app/core/weather_analyzer.py` 整个文件。
- 从 `agent.py` 删除旧 `ArticleSummarizer` 类（已被 `AiAgent` 完全替代）。
- `core/__init__.py`：移除 `ArticleSummarizer` 导出，仅保留 `AiAgent`。
- `appstate.py`：移除对 `ArticleSummarizer` 的 import。
- `ai_service.py`：确认无残留引用。

**验证**：`pytest` 通过；`grep -r "ArticleSummarizer\|weather_analyzer" backend/app` 无结果（除本计划文档）。

---

### Commit 5 (可选): 为 `AiAgent` 添加测试安全网

**目标**：补上零测试覆盖，防止回归。

- 新增 `backend/test/core/test_ai_agent.py`。
- 用 `unittest.mock` 替换 `llm_factory.create_agent` / `create_llm_model` / `create_redis_db`，断言 `AiAgent` 调用工厂的方式（参数传递、session_id 格式、model 选择）。
- 覆盖路径：`summarize` 正常流、`chat` 空消息抛 `ValueError`、`analyze_weather_stream` 指数提取成功/失败、`get_cached_summary` 缓存命中/未命中。
- 不测 agno 内部行为，只测 `AiAgent` 的外部契约。

**验证**：`uv run pytest backend/test/core/test_ai_agent.py -v` 全绿。

## Decision Document

### 模块结构
- **合并后**：`backend/app/core/agent.py` 只含一个 `AiAgent` 类；`llm_factory.py` 保持为唯一工厂；`weather_analyzer.py` 删除。
- `AiAgent` 同时服务文章总结/对话（经 `AiService`）和天气分析（经 `PublicService`），两处共享同一 `AppState` 注入的实例。

### 接口
- `AiAgent` 公开方法签名与现有 `ArticleSummarizer` / `WeatherAnalyzer` 保持一致，以便 `AiService` / `PublicService` 最小改动。
- `AiService.__init__` 参数名由 `summarizer` 改为 `agent`，类型由 `ArticleSummarizer` 改为 `AiAgent`。
- `analyze_weather_stream` 保留 `on_index_calculated: Callable | None` 回调接口；业务侧（`FishingService.save_ai_analysis_feedback`）仍在 `PublicService` 组装后传入。

### 默认参数统一
- 统一为工厂现有默认值：`temperature=0.3`、`timeout=60`、`num_history_runs=10`。
- ⚠️ 天气分析原用 `temperature=1` / `timeout=30` / `num_history_runs=3`。统一后天气分析的输出风格可能变化（温度降低 → 更确定性）。**需在 staging 验证天气分析输出质量**，若不可接受则在 `analyze_weather_stream` 内部对工厂调用做局部覆盖（保留差异点）。

### 生命周期
- 删除 `weather_analyzer.py` 的模块级全局单例 `weather_analyzer = _create_weather_analyzer()`。
- `AiAgent` 在 `AppState.new_app_state()` 中构造一次，注入 `AiService` 与 `PublicService`。
- `expert_weights`（来自 `FishingExpertScorer.WEIGHTS`）在 `AppState` 构造时传入 `AiAgent`，解决原启动期隐式依赖。

### 层级
- 消除原 `public_service.py` → `core.weather_analyzer` 的 lazy import 反模式；改为显式构造注入。
- `AiAgent` 保持为"纯 AI 执行层"（prompt + 流式 + session），业务副作用（训练反馈）由 service 层回调处理。

### Schema
- 天气分析的 Pydantic 输入 schema 模型从 `weather_analyzer.py` 迁移。推荐放入 `app/schemas/aiagent.py`（与 `WeatherAnalysisInput` 同层），避免 `agent.py` 膨胀。

## Testing Decisions

- **测试外部行为，不测实现**：mock 掉 `llm_factory` 与 `RedisDb`，只断言 `AiAgent` 对工厂的调用参数与返回的流式内容。
- **覆盖模块**：`AiAgent` 的全部公开方法。
- **前例**：参考 `backend/test/core/test_config.py`（core 层单测风格）与 `backend/test/test_fishing_expert.py`（mock 外部依赖）。
- **当前覆盖**：`agent.py` / `weather_analyzer.py` / `llm_factory.py` 均无测试（`grep` 确认）。Commit 1–4 不强制加测试，但 Commit 5 强烈建议补上，作为本次重构的安全网。
- **行为守护**：`analyze_weather_stream` 的「最终钓鱼指数」提取逻辑是纯函数，适合单测。

## Out of Scope

- 不改 `llm_factory.py` 的函数签名（仅确认它被统一调用）。
- 不改前端（`WeatherAnalysis.vue` / RSS 文章视图）——后端接口契约不变。
- 不改 `AiService` 的 SSE 包装接口（`summary_stream` / `chat_stream` 出参格式不变）。
- 不改天气分析 prompt 内容或权重计算（`FishingExpertScorer.WEIGHTS` 原样传入）。
- 不引入新的 AI 功能或模型供应商抽象。
- 不处理 `WeatherAnalyzer.DB` 类变量（`RedisDb(db_url=...)`）——统一走 `create_redis_db()`。
- 不重构 `FishingService.save_ai_analysis_feedback` 或训练逻辑。

## Further Notes

- **风险点**：`temperature` 从 1.0 降到 0.3 对天气分析输出影响最大。建议在 staging 对比统一前后的天气分析报告，若质量回退则把 temperature 作为 `analyze_weather_stream` 的可选参数暴露（默认仍用统一值）。
- **`WeatherAnalyzer` 的 `parse_tide_info_fn` 注入**：当前 `WeatherAnalyzer.__init__` 接收 `parse_tide_info_fn` 但 `analyze_weather_stream` 中未实际使用（`PublicService` 侧的回调自行调用 `parse_tide_info`）。迁移时可省略该注入，进一步简化构造。
- **后续可考虑**：`AiAgent` 内部仍有两簇方法（文章 vs 天气），若未来继续膨胀，可按 prompt 策略拆分，但本次不做。
- **Issue 创建**：仓库 remote 为 gitee，`gh` CLI 无法直接创建 issue。本计划写在 `docs/refactor/unified-ai-agent.md`，可手动贴到 gitee 或转为 devtask spec。
