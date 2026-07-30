# FrontierCard redesign — 设计 spec（Phase 3 固化输入）

> 三版 mockup 的唯一共同输入。写薄了 → 三版都飘。

## 1. 这是什么

`FrontierCard.vue` 是 `kanocifer.chat` 个人网站中"现在能做什么"板块（FrontierPanel）的任务卡片单元。一张卡片 = 一个未阻塞、可立即推进的开发任务。

整个站点是 `kuro neko`（黑猫）品牌，主题走 paper / sage / mist / blush 四套（4 个 light + 4 个 dark），全部用 OKLCH 定义的语义化 token：
`--ink`（主文字）、`--card`（卡片底）、`--surface`（半透明覆盖）、`--muted-text`（次文字）、`--accent`（单一强调）、`--destructive`/`--warning`、`--chart-1..5`（类型色）。

## 2. 现有 card 的事实

- `apps/vue-app/src/features/todos/components/FrontierCard.vue`（已读）
- 上方一排 badge（type/priority/kind/scope/slug）+ 大标题 + 两行描述；底部左侧 due_date，右侧 hover 才出现的 cycle/delete 按钮
- 列布局：sm 2 列 / lg 3 列（CSS columns + `break-inside-avoid`）
- 入场动画：`frontier-card-enter` 错峰 stagger
- 现有 TypeBadge / PriorityBadge / KindBadge 走的是 `border-chart-N/40 bg-chart-N/10 text-chart-N` 模式

## 3. 用户要什么（以及没明说的）

用户原话：「设计一下任务卡片，apps/vue-app/public/images/animal-badge 可使用 badge 装饰」。

**没明说但已沉淀在项目里的事实**：
1. `public/images/animal-badge/` 下已有 8 张动物（cat / deer / dog / fox / koala / panda / penguin / rabbit），都是柔和插画、圆角方形 PNG、约 480×480
2. 项目里其他卡片已经在用这些 badge —— `BentoNavCard`（导航图标）、`BentoReadingList`（首页装饰）、`TodoCard`（导航 tile）、`LoginView`/`RegisterView`（空状态），用法都是 `h-9 w-9` 或 `h-6 w-6` 的小圆角 chip
3. **这些 badge 此前从未进入任务卡本身** —— 这是新增的视觉母题

**隐含期待**（基于上下文推断，不是用户原话）：
- 不是"加个图标装饰"那么简单 —— 8 只动物、4 种 priority、4 种 type 暗示了一种**身份系统**的潜力
- 但也别过度 —— 任务管理面板的底线是可读性、信息密度、扫读速度
- 站点气质：纸色暖调、衬线（`font-serif`）、编辑式克制，不是 Notion/Linear 那种 SaaS 模式

## 4. 目标受众 + 场景

- **唯一用户**：网站主人自己（`kuro neko` / 黑猫），非协作场景，没有团队、没有评论、没有 @mention
- **使用场景**：每天打开 1-3 次，扫一遍"现在能做什么"，挑一个推进，3-10 秒的扫读时间
- **屏幕**：笔记本为主（columns 布局在 lg 屏 3 列），距离 1m
- **温度**：安静 · 克制 · 编辑感，不是兴奋 / 紧迫 / 仪式感

## 5. 核心信息（卡片必须承载）

| 字段 | 类型 | 必显 | 用途 |
|---|---|---|---|
| type | 功能需求/问题/优化/技术债 | ✓ | 一眼分类 |
| priority | P0/P1/P2/P3 | ✓ | 一眼判断紧急度 |
| kind | spec / subtask | ✓ | 区分可拆解 vs 可执行 |
| scope | string | optional | 上下文（哪个模块）|
| slug | "task-3" | optional | 跨处引用 |
| title | string | ✓ | 主要信息 |
| description | markdown (2 行截断) | optional | 上下文 |
| due_date | YYYY-MM-DD | optional | 截止日（含 overdue 状态）|
| status | 待评估/待排期/进行中/已搁置/已完成 | implicit | 通过 cycle 按钮推进 |

## 6. 视觉母题假设（form 推导第五问）

**内容独有的视觉元素**：8 个**具名动物**（每个有性格：狐狸灵巧、考拉缓慢、企鹅冷静、兔子跳跃、熊猫沉稳、鹿警觉、狗忠诚、猫独立）。它们和 priority/type 之间存在**自然映射**（P0 紧急 → 狗/狼系警觉；P3 低 → 考拉/熊猫系从容；spec → 鹿系警觉巡游；subtask → 兔子系敏捷可执行）。

**form 种子**：每张卡片是"一只动物在守这块任务" —— 不是 icon 装饰，是 identity。三版要回答的同一个问题：**动物和卡片是什么结构关系**？

- 方向一：动物是头像（**身份 / 性格**）—— 跟 priority/kind 路由，作为"是谁在守"
- 方向二：动物是封面（**章节扉页**）—— 顶部装饰带，编辑式留白，body 走衬线长文
- 方向三：动物是状态（**环 / 度量**）—— 嵌在圆环里表达紧急度 / 截止日，body 走数据 grid

## 7. 硬约束

- **尺寸**：卡片在 lg 屏 columns-3 布局里 ≈ 320-360px 宽（用视口 1440px 演示），padding 16px，radius 24px（`rounded-3xl` 保持）
- **可读性硬底线**：正文 ≥14px、tag 字号 11-12px、对比度 ≥4.5:1
- **语义化 Tailwind**：禁止硬编码颜色，全部走 `text-ink` / `bg-card` / `bg-surface` / `text-muted` / `border-border` / `text-destructive` / `text-warning` / `text-chart-1..5` / `bg-accent/10` 等
- **保留现有交互**：open（点卡片本身）、cycle（推状态）、delete；hover 才出现的 action 区
- **保留 badge 行为**：TypeBadge / PriorityBadge / KindBadge 仍要存在 —— 动物**不是替代**badge，是**新增**的视觉层
- **保留入场 stagger 动画**（`frontier-card-enter`，错峰 40ms）
- **动物图片路径**：`/images/animal-badge/{name}.png`（8 选 1，按 mockup 内逻辑路由）
- **必须 base64 内嵌**（单文件交付，双击能开）
- **不写假数据** —— mockup 内出现的任务标题/描述如果是占位必须标 `<!-- placeholder -->`
- **不引新依赖** —— 纯 HTML+CSS，Tailwind 走 CDN `<script src="https://cdn.tailwindcss.com">` 即可（演示态）
- **不能是 PowerPoint 式横排** —— 三版布局骨架必须互异

## 8. 演示形态

- 3 个独立 HTML：`design-demos/A-avatar.html` / `B-band.html` / `C-ring.html`
- 每版展示 6 张卡片的 masonry 网格（2 列 × 3 行），覆盖所有 priority + type + kind 组合各至少 1 个
- 演示 1 个 hover 态卡片（露出 action 区）
- 输出尺寸 1440×900，浏览器里双击能开，Playwright 截图
- 文件存**项目根目录** `design-demos/`，**不要**用 `_temp/`
