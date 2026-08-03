<template>
  <div class="space-y-4">
    <TodoFilterBar
      :filter-type="filterType"
      :filter-priority="filterPriority"
      :filter-member="filterMember"
      :member-chips="memberChips"
      v-model:search-term="searchTerm"
      :count="filteredPlanning.length"
      @toggle="(p) => toggleFilter(p.key, p.value)"
    />

    <!-- index list (windowed) -->
    <div ref="listEl" class="overflow-hidden rounded-xl border">
      <div
        v-if="filteredPlanning.length"
        class="relative w-full"
        :style="{ height: totalHeight + 'px' }"
      >
        <div
          v-for="entry in visibleItems"
          :key="entry.task.slug"
          data-planning-row
          class="hover:bg-accent/5 group border-border absolute inset-x-0 top-0 box-border flex cursor-pointer items-center gap-3 border-b px-4 transition-colors"
          :class="{ 'border-b-0!': entry.isLast }"
          :style="{
            transform: `translateY(${entry.top}px)`,
            height: rowHeight + 'px',
          }"
          role="button"
          tabindex="0"
          :aria-label="`任务: ${entry.task.title}`"
          @click="$emit('open', entry.task.slug)"
          @keydown.enter="$emit('open', entry.task.slug)"
        >
          <span
            class="absolute inset-y-0 left-0 w-[2px]"
            :class="typeBarClass(entry.task.type)"
            aria-hidden="true"
          />

          <span
            class="bg-secondary/70 border-secondary text-ink rounded-full border px-2 text-xs whitespace-nowrap tabular-nums"
            >{{ entry.task.slug }}</span
          >

          <span class="text-ink min-w-0 flex-1 truncate font-serif">
            {{ entry.task.title }}
          </span>

          <span
            class="text-muted hidden text-xs whitespace-nowrap tabular-nums sm:inline"
          >
            {{ entry.task.type }} · {{ entry.task.priority }} ·
            {{ entry.task.status }}
          </span>

          <button
            type="button"
            class="text-muted hover:bg-destructive/10 hover:text-destructive focus-visible:ring-ring rounded-md p-2 transition-[color,transform] focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none active:scale-[0.96] active:not-focus-visible:ring-0"
            title="删除"
            aria-label="删除"
            @click.stop="$emit('delete', entry.task.slug)"
          >
            <svg
              class="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>

      <div
        v-else
        class="text-muted/70 flex flex-col items-center justify-center px-4 py-12 text-center"
      >
        <svg
          class="text-muted/30 mb-3 h-7 w-7"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
        <p class="font-serif text-sm">没有匹配的任务</p>
        <p class="text-xs">去新建一个，或放宽筛选条件</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';
import { useV3DevTaskStore } from '@/features/todos/stores/v3devtasks';
import type {
  DevTask,
  DevTaskPriority,
  DevTaskType,
} from '@/features/todos/api';
import TodoFilterBar, { type MemberChip } from './TodoFilterBar.vue';

const store = useV3DevTaskStore();

// 左缘 type-color 细线 — Layer 3 语义 token 映射，不引入新颜色。
// 技术债用 muted-muted（中性灰），对位"结构性、非紧急"的语义。
const TYPE_BAR_CLASS: Record<DevTaskType, string> = {
  功能需求: 'bg-warning',
  问题: 'bg-destructive',
  优化: 'bg-success',
  技术债: 'bg-surface',
};

function typeBarClass(type: DevTaskType): string {
  return TYPE_BAR_CLASS[type];
}

const filterType = ref<Set<DevTaskType>>(new Set());
const filterPriority = ref<Set<DevTaskPriority>>(new Set());
const filterMember = ref<Set<number>>(new Set());
const searchTerm = ref('');

// 复用 store.derived.live（已过滤 is_deleted）与 userTaskCounts（成员 chip）。
// 之前 memberChips 自己再 filter 一遍 store.tasks（重复遍历）。
//
// 注意：见 FrontierPanel —— `toRefs(store.derived)` 会锁住第一次的快照，
// 后续重算不刷新。这里用 per-field computed 包一层。
const live = computed(() => store.derived.live);
const userTaskCounts = computed(() => store.derived.userTaskCounts);

/** 成员 chip —— 从 derived.userTaskCounts 派生，不再自己 filter 全量列表。 */
const memberChips = computed<MemberChip[]>(() => {
  return Array.from(userTaskCounts.value.entries())
    .sort((a: [number, number], b: [number, number]) => b[1] - a[1])
    .map(([userId, count]) => ({
      userId,
      label: `用户 ${userId}`,
      count,
    }));
});

// 单次遍历完成 is_deleted + status + 三个 Set + 搜索词。
// 之前 5 个链式 filter 等于 5 次全量遍历。
const filteredPlanning = computed<DevTask[]>(() => {
  const q = searchTerm.value.trim().toLowerCase();
  const ts = filterType.value;
  const ps = filterPriority.value;
  const ms = filterMember.value;
  const hasQ = q.length > 0;
  const out: DevTask[] = [];
  for (const t of live.value) {
    if (t.status === '已完成') continue;
    if (ts.size && !ts.has(t.type)) continue;
    if (ps.size && !ps.has(t.priority)) continue;
    if (ms.size && !ms.has(t.user_id)) continue;
    if (hasQ && !(t.title ?? '').toLowerCase().includes(q)) continue;
    out.push(t);
  }
  return out;
});

function toggleFilter(
  key: 'type' | 'priority' | 'member',
  val: DevTaskType | DevTaskPriority | number,
) {
  if (key === 'type') {
    const v = val as DevTaskType;
    const s = filterType.value;
    if (s.has(v)) s.delete(v);
    else s.add(v);
  } else if (key === 'priority') {
    const v = val as DevTaskPriority;
    const s = filterPriority.value;
    if (s.has(v)) s.delete(v);
    else s.add(v);
  } else {
    const v = val as number;
    const s = filterMember.value;
    if (s.has(v)) s.delete(v);
    else s.add(v);
  }
}

// ── 窗口化渲染（自定义实现，不引入虚拟列表库） ──────────────────────────
//
// PlanningPanel 每行本质上是定高 —— 单行文本 + 操作按钮，`py-3` + 边框 ≈ 48–52px。
// 任务最多 ~200 条（来自 `GET v3/dev-tasks?per_page=200`），200 行 DOM 在 <main>
// 滚动时持续 paint/layout，是 tab 切换与滚动的可见成本。
//
// 思路：用单行高度 + 当前列表的 `getBoundingClientRect()` 推算可见索引区间，
// 只渲染 `[start - OVERSCAN, end + OVERSCAN]`。总高度用 `count * rowHeight` 的
// 撑高 div 占位，保留外部滚动容器的滚动行为。
//
// 为什么不引 vue-virtual-scroller / @tanstack/vue-virtual：
//  - 行高稳定，不需要 dynamic-height API。
//  - 滚动容器是祖先 <main>（TodoListView 里的 `overflow-y-auto`），不是 window，
//    也不是列表本身。vue-virtual-scroller 的 RecycleScroller 默认监听自身容器，
//    需要包一层；@tanstack/vue-virtual 的 useWindowVirtualizer 与 <main> 滚动对不上。
//  - 此处实现的核心是 ~30 行：一个 `getBoundingClientRect` + 一个 scroll/resize
//    listener，少一层依赖少一个维护负担。

/** 行高估算 —— mount 后用真实测量值覆盖。 */
const ROW_HEIGHT_FALLBACK = 48;
/** 视口上下各多渲染多少行 —— 避免快速滚动时露出空白。 */
const OVERSCAN = 8;

const listEl = ref<HTMLElement | null>(null);
/** 当前已测量的真实行高（px）。 */
const rowHeight = ref(ROW_HEIGHT_FALLBACK);
/** 滚动容器顶部相对 list 容器顶部的偏移（px）；正数表示已向下滚动到 list 内部。 */
const scrollOffset = ref(0);
/** 滚动容器的可视高度（px）。默认取 window.innerHeight，mount 时校正。 */
const viewportHeight = ref(0);

const totalHeight = computed(
  () => filteredPlanning.value.length * rowHeight.value,
);

const visibleRange = computed(() => {
  const count = filteredPlanning.value.length;
  if (count === 0) return { start: 0, end: 0 };
  const rh = rowHeight.value;
  // 已向下滚动的距离（list 顶部已离开视口顶端的距离）
  const scrolled = Math.max(0, scrollOffset.value);
  const start = Math.max(0, Math.floor(scrolled / rh) - OVERSCAN);
  const visibleCount = Math.ceil(viewportHeight.value / rh) + 1;
  const end = Math.min(count, start + visibleCount + OVERSCAN * 2);
  return { start, end };
});

const visibleItems = computed(() => {
  const { start, end } = visibleRange.value;
  const rh = rowHeight.value;
  const total = filteredPlanning.value.length;
  const lastSlug = total > 0 ? filteredPlanning.value[total - 1]?.slug : null;
  const items: { task: DevTask; top: number; isLast: boolean }[] = [];
  for (let i = start; i < end; i++) {
    const task = filteredPlanning.value[i];
    if (!task) continue;
    items.push({ task, top: i * rh, isLast: task.slug === lastSlug });
  }
  return items;
});

/**
 * 找最近的纵向可滚动祖先。
 * TodoListView 的 <main class="overflow-y-auto"> 才是真正的滚动容器；
 * 不能假设是 window。
 *
 * 不强制 `scrollHeight > clientHeight` —— 列表从空到非空时 <main> 才变长，
 * 但 listener 必须在那一刻之前就挂上，否则会错过首条出现的滚动事件。
 */
function findScrollParent(el: HTMLElement | null): HTMLElement | Window {
  let cur: HTMLElement | null = el?.parentElement ?? null;
  while (cur && cur !== document.body) {
    const style = getComputedStyle(cur);
    const overflowY = style.overflowY;
    if (
      overflowY === 'auto' ||
      overflowY === 'scroll' ||
      overflowY === 'overlay'
    ) {
      return cur;
    }
    cur = cur.parentElement;
  }
  return window;
}

let scrollParent: HTMLElement | Window = window;

/** 同步滚动容器的可视高度 / list 相对滚动容器顶部的偏移。 */
function measureViewport() {
  viewportHeight.value =
    scrollParent === window
      ? window.innerHeight
      : (scrollParent as HTMLElement).clientHeight;
  const el = listEl.value;
  if (!el) {
    scrollOffset.value = 0;
    return;
  }
  const rect = el.getBoundingClientRect();
  // list 顶部相对视口顶端的偏移；为负时表示 list 顶部已在视口上方，
  // 此时偏移量 = -rect.top，即 list 内部已滚过的距离。
  scrollOffset.value = -rect.top;
}

/** 测量真实行高 —— 用列表里第一个 rendered DOM 节点的高度。 */
function measureRowHeight() {
  const el = listEl.value;
  if (!el) return;
  const firstRow = el.querySelector<HTMLElement>(
    '[data-planning-row]',
  );
  if (!firstRow) return;
  const h = firstRow.getBoundingClientRect().height;
  if (h > 0 && Math.abs(h - rowHeight.value) > 0.5) {
    rowHeight.value = h;
  }
}

let rafId: number | null = null;
/** 用 rAF 节流 scroll/resize —— scroll 事件 60fps 触发，但布局计算每帧最多一次。 */
function onScrollOrResize() {
  if (rafId !== null) return;
  rafId = requestAnimationFrame(() => {
    rafId = null;
    measureViewport();
  });
}

let resizeObserver: ResizeObserver | null = null;
let attached = false;

function attach() {
  if (attached) return;
  scrollParent = findScrollParent(listEl.value);
  scrollParent.addEventListener('scroll', onScrollOrResize, { passive: true });
  window.addEventListener('resize', onScrollOrResize, { passive: true });
  if (listEl.value && 'ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(() => onScrollOrResize());
    resizeObserver.observe(listEl.value);
  }
  attached = true;
}

function detach() {
  if (!attached) return;
  if (scrollParent && scrollParent !== window) {
    scrollParent.removeEventListener('scroll', onScrollOrResize);
  } else {
    window.removeEventListener('scroll', onScrollOrResize);
  }
  window.removeEventListener('resize', onScrollOrResize);
  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = null;
  resizeObserver?.disconnect();
  resizeObserver = null;
  attached = false;
}

onMounted(() => {
  // 第一次 measure 用 window 兜底；nextTick 后 DOM 上 <main> 已挂载，
  // 此时再 findScrollParent 能找到正确的 overflow 祖先，再挂监听。
  measureViewport();
  nextTick(() => {
    measureRowHeight();
    measureViewport();
    attach();
    measureViewport();
  });
});

onBeforeUnmount(() => {
  detach();
});

// 列表内容变化（filter / search / store update）后，重新测一次行高 ——
// 不同 filter 可能让行变高（如标题更长），但通常不影响。保险起见量一下。
watch(filteredPlanning, () => {
  nextTick(() => {
    measureRowHeight();
    measureViewport();
  });
});

defineEmits<{
  open: [slug: string];
  delete: [slug: string];
}>();
</script>