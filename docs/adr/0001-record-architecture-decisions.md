# ADR 0001: Record Architecture Decisions

- **Status**: Accepted
- **Date**: 2026-07-26
- **Author**: Kuroome

## Context

项目 `docs/rules/` 下积累了大量文档，但其中包含两类本质不同的内容：**规约**(rules)和**决策记录**(architecture decisions)。规约告诉开发者"怎么做"，决策记录回答"为什么这么做"。

此前二者混放在 `docs/rules/` 下，导致：

- 决策的上下文和备选方案随时间模糊
- 新人只看到最终约定，不理解背后 trade-off
- 日后推翻旧决策时缺乏历史依据

## Decision

采用 [Michael Nygard 的 ADR 格式](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)，在 `docs/adr/` 下记录每项架构决策。

### 格式

```markdown
# ADR NNNN: Title

- **Status**: [Proposed | Accepted | Deprecated | Superseded]
- **Date**: YYYY-MM-DD
- **Author**: who made the decision

## Context

背景、动机、约束条件。

## Decision

我们做了什么选择。

## Consequences

正面和负面后果。

## Alternatives Considered (可选)

备选方案及为何放弃。
```

### 编号规则

顺序递增，永不复用。被替代的记录通过 `Superseded by ADR NNNN` 标记。

### 与 rules 的关系

- `docs/adr/` — 记录**决策**：为什么这样设计、备选方案、trade-off
- `docs/rules/` — 记录**规约**：开发者必须遵守的具体行为规范

ADR 可以引用 rules，rules 也可以引用 ADR。同一主题可以同时存在 ADR（记理由）和 rules（定行为）。

## Consequences

Positive:

- 决策上下文持久化，新人 onboarding 成本降低
- 为未来推翻旧决策提供完整的 rationale 审计链
- 代码审查中"为什么这么设计"的讨论有了归宿

Negative:

- 需要 maintainer 在做出架构决策时同步写 ADR
- 过少的决策不值得记（避免过度文档化）
