# 003 — ai: 思考过程折叠文本补齐淡入淡出(2 站点)

- **Status**: DONE
- **Commit**: 5617250e
- **Severity**: MEDIUM
- **Category**: Missed opportunities (finding #1 from the repo sweep)
- **Estimated scope**: 1 file, 2 inline `<Transition>` blocks

## Problem

`AiCompanion.vue` 里有两处几乎相同的"思考过程"折叠 UI(briefing 与 chat turn 各一处),按钮控制 `isReasoningOpen(msg)`。按钮的箭头 `<ChevronRight>` 已经有 `transition-transform duration-200 motion-reduce:transition-none` + `rotate-90` 的平滑旋转(好),**但思考过程的文本 `<div>` 没有过渡** —— `v-if="isReasoningOpen(msg)"` 直接 mount/unmount,用户正读这段文字时它就瞬切。

频率:偶尔(对话展开) / 目的:避免突变 + 状态指示 / 速度:enter 200 / leave 150 在 300ms UI 预算内 / 功能:文本渐显不会阻碍阅读。

### 当前代码(`frontend/src/features/ai/components/AiCompanion.vue:240-245`,第二处 L298-303 结构同构)

```vue
<button
  type="button"
  class="text-muted hover:text-ink focus-visible:ring-ring/40 inline-flex cursor-pointer items-center gap-1 text-xs transition-colors focus:outline-none focus-visible:ring-2"
  :aria-expanded="isReasoningOpen(msg)"
  @click="toggleReasoning(msg)"
>
  <ChevronRight
    class="h-3 w-3 shrink-0 transition-transform duration-200 motion-reduce:transition-none"
    :class="isReasoningOpen(msg) && 'rotate-90'"
    aria-hidden="true"
  />
  <span>思考过程</span>
</button>
<div
  v-if="isReasoningOpen(msg)"
  class="text-muted mt-1.5 text-xs leading-relaxed whitespace-pre-wrap"
>
  {{ msg.reasoning }}
</div>
```

(第二处 `frontend/src/features/ai/components/AiCompanion.vue:298-303` 类结构,文本不同:`{{ msg.reasoning }}`。)

## Target

**只把"思考过程文本"的 `<div v-if>` 包进 Vue 内置的 `<Transition>`**,不动按钮、不动 Chevron、不动 toggle 逻辑。两处站点用相同的内联类配置(`enter-active-class` / `enter-from-class` / `enter-to-class` / `leave-active-class` / `leave-from-class` / `leave-to-class`)。

### 目标代码(站点 1:`AiCompanion.vue:240-246`)

改前:

```vue
<div
  v-if="isReasoningOpen(msg)"
  class="text-muted mt-1.5 text-xs leading-relaxed whitespace-pre-wrap"
>
  {{ msg.reasoning }}
</div>
```

改后:

```vue
<Transition
  enter-active-class="transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none motion-reduce:duration-0"
  enter-from-class="opacity-0 -translate-y-1"
  enter-to-class="opacity-100 translate-y-0"
  leave-active-class="transition-[transform,opacity] duration-150 ease-out motion-reduce:transition-none motion-reduce:duration-0"
  leave-from-class="opacity-100 translate-y-0"
  leave-to-class="opacity-0 -translate-y-1"
>
  <div
    v-if="isReasoningOpen(msg)"
    class="text-muted mt-1.5 origin-top text-xs leading-relaxed whitespace-pre-wrap"
  >
    {{ msg.reasoning }}
  </div>
</Transition>
```

**注意**:
- `origin-top`(Tailwind `transform-origin: top`)让文本"从按钮下方落出",不是从中心缩放。
- `v-if` 直接挂在子 `<div>` 上,Vue 会自动追踪该元素的 mount/unmount 触发过渡;**不需要** `:key`。
- 不引入 `filter: blur()` / `scale-95`(那是 `DropdownTransition` 用于 popover 卡片的词汇,文本渐显用不到)。

### 目标代码(站点 2:`AiCompanion.vue:298-304`)

改前:

```vue
<div
  v-if="isReasoningOpen(msg)"
  class="text-muted mt-1.5 text-xs leading-relaxed whitespace-pre-wrap"
>
  {{ msg.reasoning }}
</div>
```

改后:

```vue
<Transition
  enter-active-class="transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none motion-reduce:duration-0"
  enter-from-class="opacity-0 -translate-y-1"
  enter-to-class="opacity-100 translate-y-0"
  leave-active-class="transition-[transform,opacity] duration-150 ease-out motion-reduce:transition-none motion-reduce:duration-0"
  leave-from-class="opacity-100 translate-y-0"
  leave-to-class="opacity-0 -translate-y-1"
>
  <div
    v-if="isReasoningOpen(msg)"
    class="text-muted mt-1.5 origin-top text-xs leading-relaxed whitespace-pre-wrap"
  >
    {{ msg.reasoning }}
  </div>
</Transition>
```

(与站点 1 完全同构 —— 仅作为独立 `<Transition>` 实例各自管各自的过渡。Vue 允许多个 `<Transition>` 实例并存,不影响其他动画。)

## Repo conventions to follow

- **`<Transition>` 内置组件 + 类钩子模式**:与项目 `ModalFadeTransition`(`frontend/src/components/ui/modal-fade-transition/ModalFadeTransition.vue:17-27`)的 `enter-active-class` / `enter-from-class` 等写法一致。本计划**不**抽新 wrapper —— 2 个站点同在 1 个文件里,inline 更直接。
- **缓动与时长**:200ms in / 150ms out / `ease-out`,对齐 `ModalFadeTransition` 与 `DropdownTransition` 已落地数值。
- **reduced-motion 守卫**:`motion-reduce:transition-none motion-reduce:duration-0`,沿用 `ModalFadeTransition` 的写法。`DropdownTransition` 目前**没有**这个守卫 —— 这是它的空白(不在本计划范围,Hard Rule #5)。
- **transform-origin**:`origin-top` 让文本从按钮方向"落下",符合"折叠展开"的语义(`popovers` 用 `center` 或触发器锚点,文本块用 `top`)。
- **不动 Chevron**:`AiCompanion.vue:233-237` 与 `:291-295` 的 `<ChevronRight>` 自带 `transition-transform duration-200 motion-reduce:transition-none` + `rotate-90`,settled,不重提。
- **不动按钮文字 / 图标 / class**:按钮的 `text-muted hover:text-ink focus-visible:ring-ring/40 ... transition-colors` 已经是 settled hover 处理,不与新过渡冲突。
- **不动 `isReasoningOpen` / `toggleReasoning`**:逻辑在 `AiCompanion.vue:111-119`,本计划零触及。

## Steps

1. **站点 1**:`frontend/src/features/ai/components/AiCompanion.vue:240-245` 的 `<div v-if>` 替换为 `<Transition>` + `<div v-if>` 子元素,`<div>` 加 `origin-top` class。
2. **站点 2**:`frontend/src/features/ai/components/AiCompanion.vue:298-303` 的 `<div v-if>` 同样替换,class 加 `origin-top`。

(只动这两段 `<div v-if>...</div>`,不改 `<button>` / Chevron / 任何其它 class / 任何 script setup / 任何 props。)

## Boundaries

- **不要新增 wrapper**(`AccordionTransition.vue` / `index.ts` / `components/index.ts` 注册)。2 个站点同在 1 文件,inline 是正解;抽 wrapper 是过度工程。
- **不要改** `AiCompanion.vue` 里任何 `motion.div` / `AnimatePresence` / `SPRING_BOUNCE` / `motion-v` 相关代码(对话轮次与 briefing 卡片的入场动画是 settled)。
- **不要改** `<button>` 的 class、`ChevronRight` 的 class、`aria-expanded` 绑定、`@click` 处理器。
- **不要改** `<div v-if="msg.reasoning">` 外层容器(站点 1 的 `:226-246`、站点 2 的 `:281-304`)的 `border-ink/10 mb-2 border-b pb-2` class —— 它是按钮 + 折叠内容的共享外框,不参与过渡。
- **不要改** `text-muted mt-1.5 text-xs leading-relaxed whitespace-pre-wrap` 中的 `mt-1.5`(`<div>` 与按钮的间距);**只**追加 `origin-top`。
- **不要引入 `motion-v` 的 `<motion.div>`**:本计划用 Vue 内置 `<Transition>` + Tailwind 类,够用且更轻。
- **不要动** `DropdownTransition.vue` —— 它缺 reduced-motion 守卫是已存在的现状,本计划不重提。
- **不要改** `isReasoningOpen` / `toggleReasoning` 函数本体(`AiCompanion.vue:111-119`)。

## Verification

### 机械

```bash
cd /Users/liudetao/Code/ReadingList
pnpm -F frontend type-check      # vue-tsc -b --noEmit 必须 0 error
pnpm -F frontend lint            # 走仓库 lint 流水线
git diff --stat                  # 仅 AiCompanion.vue 一文件
git status                       # 确认无其它文件被误碰
```

- `AiCompanion.vue` 出现 2 次 `<Transition`、2 次 `</Transition>`、2 次 `origin-top`。
- `<div v-if="isReasoningOpen(msg)">` 在文件中恰好出现 2 次(两站点),各自被 `<Transition>` 包住。
- 6 个 class hook 字符串(`enter-active-class` / `enter-from-class` / `enter-to-class` / `leave-active-class` / `leave-from-class` / `leave-to-class`)在文件中恰好各出现 2 次。

### 肉眼看

1. `pnpm -F frontend dev` 启动前端,登录态进入 `/ai` 或任一带 AiCompanion 的页面。
2. 触发"思考过程"折叠:
   - 展开时:**文本从按钮下方渐落** —— 透明度 0→1 + translateY(-4px)→0,200ms ease-out。
   - 收起时:**文本反向淡出** —— translateY(0)→(-4px) + 透明度 1→0,150ms ease-out。
   - Chevron 仍按既有节奏 200ms 旋转 90°(settled,不动)。
3. 反复点击折叠 / 展开:**不卡顿**。Vue 内置 `<Transition>` 是 CSS 过渡(非 keyframes),快速触发会 retarget,不会重置回 0。
4. 同时展开多条消息的折叠:多个 `<Transition>` 实例互不影响,各自独立。
5. 打开 DevTools → **Rendering** → 勾选 **"Emulate CSS prefers-reduced-motion: reduce"**:
   - **文本无渐落、无位移**,瞬切显示/隐藏。
   - Chevron 旋转仍遵守 `motion-reduce:transition-none`(已存在,settled),reduced-motion 下应静止。
6. Performance 录制单次展开 → 收起:确认 enter 阶段耗时 ~200ms、leave ~150ms;reduced-motion 录制确认 enter/leave 都瞬时完成。

### 完成判定

- 两站点思考过程文本均有"从按钮下方淡落"的渐显与反向淡出,无瞬切。
- 反复点击无重置、无卡顿。
- reduced-motion 用户体感与改动前等价(瞬切),但视觉一致。
- Chevron 旋转与折叠文本过渡**同步感**对得上(都是 ~150-200ms 区间)。
- `AiCompanion.vue` 是**唯一**修改的文件,其它 motion-v / spring / AnimatePresence 代码**完全不变**(type-check + 肉眼看双重确认)。

---

## Result (2026-07-25)

由 executor subagent 执行,主审 approve。

- **Diff**: `AiCompanion.vue` +28 / −10,仅 1 文件(计划范围)。
- **type-check**: PASS。
- **lint**: PASS(4 条与本计划无关的 test 文件 warning 改动前已存在)。
- **盲点**: 站点 1 与站点 2 缩进差 2 格(14 vs 16),因为两者嵌套深度不同;executor 正确处理。
- **类钩子核对**: 6 × 2 = 12 个钩子、`Transition`/`</Transition>` × 2、`origin-top` × 2、`<div v-if="isReasoningOpen(msg)">` × 2 —— 全部如计划。
- **未触碰**: `<button>` / `<ChevronRight>` / 外层容器 / `isReasoningOpen` / `toggleReasoning` / motion-v / AnimatePresence / SPRING_BOUNCE。
- **下一步**: 人工肉眼验收 AiCompanion 嵌入面(`/ai`、`RssArticleView` 等)的折叠展开手感。