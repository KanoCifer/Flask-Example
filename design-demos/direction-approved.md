# Direction Approved — FrontierCard redesign

## 决定（最终）

**方向 C · Animal on Left（无 progress ring）**

用户在第二轮 feedback 中要求：
- 「改成 c 方案，但是不要外围的进度圆环」
- 即采用 C 的 2-列架构（左列动物守卫 + 右列 body），但去掉 C 原版的 SVG 进度环
- 保留 A 的 priority-based 动物路由（不再让动物编码 task character，因为没有 ring 之后，priority 信号需要落到动物本身）
- 保留之前的 bg-card/30 透明底、font-serif 标题、scoped hover 动效

## 选定细节

### 卡片结构（grid grid-cols-[auto_1fr]）

```
+------------------------------------+
| [animal] | badges row              |
| [        ] | title + desc (button) |
| [        ] | footer (due + actions)|
+------------------------------------+
```

- 左列：动物守卫（72px），soft blur halo 背景 + drop-shadow 投影，scoped hover 触发 -5°/1.05 旋转缩放
- 右列：badges（视觉身份） + open 按钮（标题 + 描述） + footer（due_date + 隐藏的 cycle/delete 按钮）
- 整个卡片是 bg-card/30 + border（base.css 的软 box-shadow）

### 动物 routing（沿用 A）

```
P0 紧急 → dog   (alert/loyal)      halo bg-destructive/10
P1 高    → fox   (sharp/quick)      halo bg-warning/15
P2 中    → cat   (independent)      halo bg-accent/10
P3 低    → koala (slow/composed)    halo bg-chart-2/15
```

### 保留的现状行为

- ✓ 整个 card 内容区视觉上层级清晰；open 触发条件 = 点 title/description（按钮只包这两者）
- ✓ cycle / delete 按钮在 footer，hover 才露出（group-hover:opacity-100）
- ✓ 4 套主题 + light/dark 全兼容（只用了语义 token）
- ✓ 前端路由删除 /_dev/card-preview（已用完即弃）

## 已知 trade-off

- 标题截断：左列 72px + gap-3 = 87px 固定开销。3-col 布局下右列只剩 ~230px，~30+ 中文字符会折行（line-clamp-2 兜底）。C 原版 ring 时代已经预警过这个弱点。
- 如果未来要加回某种「紧急度」信号，可考虑：动物加 `outline` 颜色（不破坏形状）或左列背景色。**不恢复 SVG ring**。
