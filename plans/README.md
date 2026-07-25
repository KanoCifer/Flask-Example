# Animation Plans

`/improve-animations` 产出的可执行计划。每个 plan 是一份自包含的"零上下文"说明书,可交给任何 executor agent 执行。

## 索引

| # | 标题 | 严重度 | 状态 | 关联 | 预估范围 |
|---|------|--------|------|------|----------|
| [001](001-bookshelf-list-stagger.md) | books: 列表变体补齐 stagger 入场 + book-card 加 reduced-motion 守卫 | MEDIUM | DONE | 仓库扫描 finding #3 | 1 file / +10 −2 行 |
| [002](002-analytics-skeleton-crossfade.md) | analytics: skeleton → data crossfade (7 站点) | MEDIUM | DONE | 仓库扫描 finding #2 | 2 new + 7 modified files |
| [003](003-aicompanion-reasoning-accordion.md) | ai: 思考过程折叠文本补齐淡入淡出 (2 站点) | MEDIUM | DONE | 仓库扫描 finding #1 | 1 file / +28 −10 |

## 执行顺序

1. **001** — ✅ 已完成。
2. **002** — ✅ 已完成。
3. **003** — ✅ 已完成。

## 通用规约

- 每个 plan 含 **Problem / Target / Steps / Boundaries / Verification** 五段。
- 数字值(时长、缓动、关键帧)直接来自 [AUDIT.md](../.claude/skills/improve-animations/AUDIT.md),不写"差不多"。
- 改动落点严格在 plan 的 `Boundaries` 段内;范围外不动。
- 完成后,executor 应把对应 plan 的 `Status` 改为 `DONE`,并在 Verification 段记录结果摘要。
