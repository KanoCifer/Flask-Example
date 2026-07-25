# 002 — analytics: skeleton → data crossfade (7 sites)

- **Status**: DONE
- **Commit**: 5617250e
- **Severity**: MEDIUM
- **Category**: Missed opportunities (finding #2 from the repo sweep)
- **Estimated scope**: 1 new file + 6 modified files (5 chart cards + AnalyticsView)

## Problem

Analytics 仪表盘(`/analytics`)在 7 个站点上以**骨架(`animate-pulse`)**→**空态**→**真实图表**三态切换,但切换之间**没有任何过渡** —— 骨架直接消失,真实内容瞬间出现。同时 `TrendChartCard.vue:64` 显式关闭了 ECharts 内部动画(`animation: false`,作者注释"禁用 animation 避免 setOption 渐变动画时 echarts interpolate1DArray 崩"),所以外层 crossfade 是必要的衔接。

### 受影响站点(已逐一 Read 验证)

| # | 文件 | 行 | 当前结构 |
|---|------|----|----------|
| 1 | `frontend/src/features/analytics/AnalyticsView.vue` | 113-119 / 120-... | 2 态:`loading && !overviewData` → 3 `<StatTile>` |
| 2 | `frontend/src/features/analytics/AnalyticsView.vue` | 300-308 / 311-... | 3 态:`loading && !loginLogsData` → empty → loginLogsList |
| 3 | `frontend/src/features/analytics/components/OsCharts.vue` | 7-10 / 11-18 / 19-21 | 3 态:loading → empty → `<v-chart>` |
| 4 | `frontend/src/features/analytics/components/BrowserAnalytics.vue` | 7-10 / 11-18 / 19-21 | 3 态:同结构 |
| 5 | `frontend/src/features/analytics/components/PopularPagesChartCard.vue` | 7-10 / 11-21 / 22-28 | 3 态:同结构 |
| 6 | `frontend/src/features/analytics/components/PostViewsChartCard.vue` | 7-10 / 11-21 / 22-24 | 3 态:同结构 |
| 7 | `frontend/src/features/analytics/components/TrendChartCard.vue` | 7-10 / 11-21 / 22-24 | 3 态:同结构(`animation: false`) |

### 当前代码(以 OsCharts.vue:7-21 为代表)

```vue
<div
  v-if="loading && !hasOsData"
  class="bg-surface h-56 animate-pulse rounded-xl"
></div>
<div
  v-else-if="!hasOsData"
  class="text-muted flex h-56 flex-col items-center justify-center gap-2 px-4 text-center"
>
  <icon-analytics class="text-muted/50 size-7" />
  <p class="text-sm font-medium">暂无系统数据</p>
  <p class="text-xs">操作系统分布会在访客到达后显示在这里。</p>
</div>
<div v-else class="h-56 w-full overflow-hidden">
  <v-chart :option="osChartOption" autoresize class="h-full w-full" />
</div>
```

(其余 4 个 chart card 与此结构同构;AnalyticsView 的 2 处见下文 "AnalyticsView 接入示例"。)

## Target

### 1. 新增 wrapper:`frontend/src/components/ui/skeleton-crossfade-transition/SkeletonCrossfadeTransition.vue`

完整文件(照搬项目 `ModalFadeTransition.vue` 的同款 computed-attrs 模式,叠加 `mode="out-in"`):

```vue
<template>
  <transition v-bind="mergedAttrs" mode="out-in">
    <slot />
  </transition>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue';

// 默认:200ms in / 100ms out,ease-out,纯 opacity 渐变;含 motion-reduce 守卫。
// 用途:Analytics 仪表盘里骨架(animate-pulse) → 真实图表/列表/统计的瞬切改为淡入淡出。
// 仅适用于"等占位的条件分支组"(loading / empty / data 三态),不适用于位置/尺寸过渡。
// 调用方可通过同名 attr(如 :enter-from-class)覆盖任一阶段 class。

defineOptions({
  name: 'SkeletonCrossfadeTransition',
  inheritAttrs: false,
});

const attrs = useAttrs();

const mergedAttrs = computed(() => ({
  'enter-active-class':
    'transition-opacity duration-200 ease-out motion-reduce:transition-none motion-reduce:duration-0',
  'enter-from-class': 'opacity-0',
  'enter-to-class': 'opacity-100',
  'leave-active-class':
    'transition-opacity duration-100 ease-out motion-reduce:transition-none motion-reduce:duration-0',
  'leave-from-class': 'opacity-100',
  'leave-to-class': 'opacity-0',
  ...attrs,
}));
</script>
```

### 2. 在 `frontend/src/components/index.ts:11` 后追加一行(共 1 行新增)

```ts
export * from './ui/skeleton-crossfade-transition';
```

### 3. 5 个 chart card 接入模式(完全相同的改动)

对 OsCharts.vue / BrowserAnalytics.vue / PopularPagesChartCard.vue / PostViewsChartCard.vue / TrendChartCard.vue:

**(a)** 在 `<script setup>` 中导入:

```ts
import { SkeletonCrossfadeTransition } from '@/components';
```

(各文件现有的 `@/components` 导入已包含所有 Icon、`<v-chart>` 通过 vue-echarts 单独导入,无须新增其它 import。)

**(b)** 把 v-if/v-else-if/v-else 三态包进 wrapper,并给每个分支 root 元素加 `:key`。以 OsCharts.vue 为例:

改前 (OsCharts.vue:1-23):

```vue
<template>
  <div class="flex flex-col">
    <h3 class="text-ink mb-2 flex items-center gap-2 text-sm font-medium">
      <icon-analytics class="size-4" /> 操作系统分布
    </h3>
    <p class="text-muted mb-3 text-xs">按操作系统分类的访问占比</p>
    <div
      v-if="loading && !hasOsData"
      class="bg-surface h-56 animate-pulse rounded-xl"
    ></div>
    <div
      v-else-if="!hasOsData"
      class="text-muted flex h-56 flex-col items-center justify-center gap-2 px-4 text-center"
    >
      <icon-analytics class="text-muted/50 size-7" />
      <p class="text-sm font-medium">暂无系统数据</p>
      <p class="text-xs">操作系统分布会在访客到达后显示在这里。</p>
    </div>
    <div v-else class="h-56 w-full overflow-hidden">
      <v-chart :option="osChartOption" autoresize class="h-full w-full" />
    </div>
  </div>
</template>
```

改后:

```vue
<template>
  <div class="flex flex-col">
    <h3 class="text-ink mb-2 flex items-center gap-2 text-sm font-medium">
      <icon-analytics class="size-4" /> 操作系统分布
    </h3>
    <p class="text-muted mb-3 text-xs">按操作系统分类的访问占比</p>
    <SkeletonCrossfadeTransition>
      <div
        v-if="loading && !hasOsData"
        key="loading"
        class="bg-surface h-56 animate-pulse rounded-xl"
      ></div>
      <div
        v-else-if="!hasOsData"
        key="empty"
        class="text-muted flex h-56 flex-col items-center justify-center gap-2 px-4 text-center"
      >
        <icon-analytics class="text-muted/50 size-7" />
        <p class="text-sm font-medium">暂无系统数据</p>
        <p class="text-xs">操作系统分布会在访客到达后显示在这里。</p>
      </div>
      <div v-else key="data" class="h-56 w-full overflow-hidden">
        <v-chart :option="osChartOption" autoresize class="h-full w-full" />
      </div>
    </SkeletonCrossfadeTransition>
  </div>
</template>
```

其余 4 个 chart card(BrowserAnalytics / PopularPagesChartCard / PostViewsChartCard / TrendChartCard)按**完全同构**的改动:
- import 行加 `SkeletonCrossfadeTransition`
- 把 v-if/v-else-if/v-else 三个 root 元素分别加 `key="loading"` / `key="empty"` / `key="data"`
- 三态用 `<SkeletonCrossfadeTransition>...</SkeletonCrossfadeTransition>` 包起来
- 不动 class、不动文本、不动 v-chart 配置、不动 script setup 中其它逻辑

### 4. `AnalyticsView.vue` 接入(L113 + L300,结构不同单独说明)

**(a) L113(2 态:loading skeleton → 3 个 `<StatTile>`)**

改前 (AnalyticsView.vue:112-120):

```vue
<div class="col-span-1 lg:col-span-3">
  <div v-if="loading && !overviewData" class="grid grid-cols-1 gap-4 sm:grid-cols-3">
    <div
      v-for="i in 3"
      :key="i"
      class="bg-surface/50 h-24 animate-pulse rounded-2xl"
    ></div>
  </div>
  <div v-else-if="overviewData" class="grid grid-cols-1 gap-4 sm:grid-cols-3">
    <StatTile ... />
    ...
```

改后(只为这两个 root `<div>` 整体加 wrapper;`<StatTile>` 内部细节不动):

```vue
<div class="col-span-1 lg:col-span-3">
  <SkeletonCrossfadeTransition>
    <div
      v-if="loading && !overviewData"
      key="loading"
      class="grid grid-cols-1 gap-4 sm:grid-cols-3"
    >
      <div
        v-for="i in 3"
        :key="i"
        class="bg-surface/50 h-24 animate-pulse rounded-2xl"
      ></div>
    </div>
    <div
      v-else-if="overviewData"
      key="data"
      class="grid grid-cols-1 gap-4 sm:grid-cols-3"
    >
      <StatTile ... />
      ...
```

(其余三个 `<StatTile>` 及内容原样保留,只在 wrapper 关闭前补 `</SkeletonCrossfadeTransition>`。)

**(b) L300(3 态:loading skeleton → empty → login logs 列表)**

改前 (AnalyticsView.vue:300-313):

```vue
<!-- Loading -->
<div v-if="loading && !loginLogsData" class="py-8">
  <div class="space-y-3">
    <div
      v-for="i in 5"
      :key="i"
      class="bg-surface h-12 animate-pulse rounded-lg"
    ></div>
  </div>
</div>

<!-- Empty -->
<div
  v-else-if="loginLogsData?.list.length === 0"
  class="text-muted py-12 text-center text-sm"
>
```

改后:

```vue
<SkeletonCrossfadeTransition>
  <!-- Loading -->
  <div v-if="loading && !loginLogsData" key="loading" class="py-8">
    <div class="space-y-3">
      <div
        v-for="i in 5"
        :key="i"
        class="bg-surface h-12 animate-pulse rounded-lg"
      ></div>
    </div>
  </div>

  <!-- Empty -->
  <div
    v-else-if="loginLogsData?.list.length === 0"
    key="empty"
    class="text-muted py-12 text-center text-sm"
  >
```

(后续 v-else 的真实列表段不动,最后补 `</SkeletonCrossfadeTransition>` 收口。)

**(c)** AnalyticsView.vue 的 `<script setup>` 中**已经**从 `@/components` 导入了大量图标组件,只要确保类型上能解析到 `SkeletonCrossfadeTransition`(`components/index.ts` 已重新导出);不新增 import 语句。

## Repo conventions to follow

- **wrapper 文件结构**:`ModalFadeTransition.vue` 是直接范式 —— `<transition v-bind="mergedAttrs">` + `useAttrs` + `mergedAttrs` computed + `inheritAttrs: false`。新 wrapper 完全照搬,只多一个硬编码 `mode="out-in"` 属性。
- **`motion-reduce:duration-0`**:`ModalFadeTransition` 既有的写法,沿用。
- **`@/components` 桶导出**:`components/index.ts:11` 是所有 `*-transition/*` wrapper 的注册点;新增一行保持列表风格统一。
- **chart card 结构**:5 个 chart card 完全同构;`TrendChartCard.vue:64` 的 `animation: false` 是 settled 决策(避免 ECharts `interpolate1DArray` 崩),**不动**。
- **不要新增 `motion-v` / `gsap` / `framer-motion`**:wrapper 是纯 `<transition>` + Tailwind 类。

## Steps

1. **新增 wrapper 文件**:`frontend/src/components/ui/skeleton-crossfade-transition/SkeletonCrossfadeTransition.vue`,内容同上文 "1. 新增 wrapper" 段。
2. **注册导出**:`frontend/src/components/index.ts` 在 line 11 (`export * from './ui/modal-fade-transition';`) 之后追加 `export * from './ui/skeleton-crossfade-transition';`。
3. **改 OsCharts.vue**:照上文 "3. (b) OsCharts 改后" 改。
4. **改 BrowserAnalytics.vue**:同 OsCharts 模式(三态 key + wrapper)。
5. **改 PopularPagesChartCard.vue**:同模式。
6. **改 PostViewsChartCard.vue**:同模式。
7. **改 TrendChartCard.vue**:同模式。
8. **改 AnalyticsView.vue L113**:照上文 "4. (a)"。
9. **改 AnalyticsView.vue L300**:照上文 "4. (b)"。

## Boundaries

- **不要新增** `SkeletonCrossfadeTransition` 之外的 wrapper / 工具。
- **不要改** `TrendChartCard.vue:64` 的 `animation: false`(ECharts 内部动画关闭是 settled 决策,留着)。
- **不要改** 任何 chart card 的 `loading` / `hasXxxData` computed / props / echarts option / class 字符串 / 文本文案。
- **不要改** `AnalyticsView.vue` 的脚本逻辑、props、computed、其它模板片段(只在两处加 wrapper + key,不在邻近区域顺手重构)。
- **不要新增 motion-v / GSAP** 依赖,保持 wrapper 是纯 Vue `<transition>` + Tailwind 类。
- **不要给 skeleton 加 `animation: none`** —— 骨架仍需在等待期间 `animate-pulse`,wrapper 只在切换瞬间接管 opacity。
- **不要把 `SkeletonCrossfadeTransition` 用到非分析页**(本计划范围仅限 analytics 7 个站点)。
- **不要新增空态 key(已是 3 态之一)** 或遗漏 `<SkeletonCrossfadeTransition>` 的开闭标签 —— Vue 的 `<transition>` 必须恰好包住一组 `v-if/v-else-if/v-else` 兄弟。

## Verification

### 机械

```bash
cd /Users/liudetao/Code/ReadingList
pnpm -F frontend type-check      # vue-tsc -b --noEmit 必须 0 error
pnpm -F frontend lint            # 走仓库 lint 流水线
git diff --stat                  # 应见 1 新增 + 6 修改 = 7 文件
git status                       # 确认未误碰其它文件
```

- `components/ui/skeleton-crossfade-transition/SkeletonCrossfadeTransition.vue` 存在。
- `components/index.ts` 包含 `export * from './ui/skeleton-crossfade-transition';`。
- 5 个 chart card 中:每个都含 `import { SkeletonCrossfadeTransition }`、`SkeletonCrossfadeTransition>`、`key="loading"` / `key="empty"` / `key="data"` 三处。
- `AnalyticsView.vue` L113 处含 `SkeletonCrossfadeTransition>` 与 `key="loading"` / `key="data"`,L300 处含 wrapper 与 `key="loading"` / `key="empty"`(以及原 v-else 真列表段,无需 key —— v-else 在三态链上自动跟随)。
- 7 处 `<SkeletonCrossfadeTransition>` 全部正确开闭。

### 肉眼看

1. `pnpm -F frontend dev` 启动前端,登录态进入 `/analytics`,**强制刷新** `Cmd-Shift-R`。
2. 顶部 3 个 `<StatTile>`:`loading` 骨架(`bg-surface/50 h-24 animate-pulse`)→ 真实 tile,渐隐渐显,各 100ms/200ms。
3. 5 个 chart card(趋势/系统/浏览器/热门页面/文章阅读):骨架 → empty / data,渐隐渐显。
4. 用户登录记录列表:骨架 → empty / 真实列表,渐隐渐显。
5. 切换"天数"或刷新触发重新加载:再次观察 skeleton 渐隐 + chart 渐显。
6. 打开 DevTools → **Rendering** → 勾选 **"Emulate CSS prefers-reduced-motion: reduce"**,刷新一次:
   - 7 处站点都应**无渐变**,骨架直接消失,真实内容直接出现(无中间状态)。
7. 关闭 reduced-motion,DevTools → Performance 录制 1 次 skeleton → chart 切换,确认 enter/leave 时长分别为 200ms / 100ms,无 layout thrash(ECharts 内部 SVG 渲染应在 leave 完成后才开始)。
8. 滑窗缩放(ResizeObserver 触发的 `autoresize`):不应在 crossfade 中出现,因为 ECharts 的 autoresize 在 `v-else` 真列表段挂载后才开始监听,`mode="out-in"` 保证 leave 完毕才 enter。

### 完成判定

- 7 处站点 skeleton → 真数据均有 ~300ms 总切换时长(leave 100 + enter 200),无瞬切。
- reduced-motion 用户零过渡,与改动前体感等价。
- ECharts 图表本身仍不内嵌 animation(`TrendChartCard.vue:64` 保持),无 `interpolate1DArray` 崩风险回归。
- 7 文件 diff 范围仅限"加 wrapper + 加 key",无顺手重构。
- 5 个 chart card 的 `loading` / `hasXxxData` / props / echarts option **完全不变**(type-check + 肉眼看双重确认)。

---

## Result (2026-07-25)

由 executor subagent 执行(中途被用户暂停,后续由主审补齐 type-check 与 barrel 修复)。

- **Diff**: 2 新 + 7 改 = 9 文件;`SkeletonCrossfadeTransition.vue` 与 `skeleton-crossfade-transition/index.ts` 是新文件,`components/index.ts` + 5 chart cards + `AnalyticsView.vue` 是修改。
- **type-check**: 初次 FAIL(缺 `skeleton-crossfade-transition/index.ts` 局部 barrel)→ 主审补上 → PASS。
- **lint**: PASS(4 条 test 文件 warning 与本计划无关,改动前已存在)。
- **盲点**: 本计划的 Step 2 只写了"在 `components/index.ts` 追加一行",**没有**说明 `skeleton-crossfade-transition/` 目录里需要本地 `index.ts` barrel —— 现有 `modal-fade-transition/index.ts` / `dropdown-transition/index.ts` 都有一行 `export { default as Xxx } from './Xxx.vue';`。这是 plan 阶段未实地 Read 仓库 wrapper 目录结构的疏忽。
- **TrendChartCard.vue:64** `animation: false` 已确认保持未动。
- **下一步**: 人工肉眼验收 `/analytics` 7 个站点在普通 + reduced-motion 下的切换。