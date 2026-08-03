<template>
  <section
    role="listitem"
    class="bg-surface/40 smooth-shadow-ring flex max-h-[calc(100dvh-10rem)] min-h-96 flex-col overflow-hidden overscroll-contain rounded-[28px] border p-3 shadow-md transition-colors contain-[layout_paint_scroll_style]"
    :class="
      dragOver ? 'border-accent/60 bg-accent/5 ring-accent/30 ring-1' : ''
    "
    @dragover.prevent="$emit('dragover')"
    @dragleave="$emit('dragleave')"
    @drop.prevent="$emit('drop')"
  >
    <!-- 列头 -->
    <header class="mb-2 flex items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <span
          class="h-2 w-2 rounded-full"
          :class="column.dotClass"
          aria-hidden="true"
        />
        <h3 class="text-ink font-serif text-sm font-medium tracking-tight">
          {{ column.label }}
        </h3>
        <span
          class="text-muted bg-page rounded-full px-1.5 py-px text-[10px] tabular-nums"
        >
          {{ totalCount }}
        </span>
      </div>
    </header>

    <!-- 泳道 + 卡片（窗口化） -->
    <div
      ref="innerEl"
      class="flex min-h-0 flex-1 flex-col overflow-y-auto"
      :class="lanes.length ? 'gap-0' : 'gap-3'"
    >
      <div
        v-if="lanes.length"
        class="relative w-full shrink-0"
        :style="{ height: totalHeight + 'px' }"
      >
        <div
          v-for="entry in visibleLanes"
          :key="entry.userId"
          data-kanban-lane
          :data-user-id="entry.userId"
          class="absolute inset-x-0 top-0"
          :style="{ transform: `translateY(${entry.top}px)` }"
        >
          <div
            class="text-muted flex items-center gap-1.5 px-1 font-serif text-xs tracking-widest"
          >
            <MemberAvatar :user-id="entry.userId" size="xs" />
            {{ entry.label }}
            <span class="text-muted/60 tabular-nums">·</span>
            <span class="text-muted/60 tabular-nums">{{
              entry.tasks.length
            }}</span>
          </div>

          <div class="mt-2 flex flex-col gap-2 px-4">
            <KanbanCard
              v-for="task in entry.tasks"
              :key="task.slug"
              :task="task"
              :is-dragging="draggedSlug === task.slug"
              @open="$emit('open', task.slug)"
              @cycle="$emit('cycle', task.slug)"
              @delete="$emit('delete', task.slug)"
              @dragstart="$emit('dragstart', task.slug)"
              @dragend="$emit('dragend')"
            />
          </div>
        </div>
      </div>

      <Transition name="fade-fast">
        <div
          v-if="!lanes.length"
          class="text-muted/60 flex flex-1 flex-col items-center justify-center gap-1.5 py-6 text-center text-xs"
        >
          <template v-if="dragOver">
            <span class="font-serif text-sm">松开以放置</span>
          </template>
          <template v-else>
            <svg
              class="text-muted/30 h-5 w-5"
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
            <span class="font-serif text-sm">此列暂无任务</span>
            <span class="text-muted/50">从待办拖一个过来</span>
          </template>
        </div>
      </Transition>
    </div>
  </section>
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
import type { DevTask } from '@/features/todos/api';
import type { KanbanColumn } from '@/features/todos/composables/devTaskPolicy';
import KanbanCard from './KanbanCard.vue';
import MemberAvatar from './MemberAvatar.vue';

interface Lane {
  userId: number;
  label: string;
  tasks: DevTask[];
}

interface LaneEntry {
  userId: number;
  label: string;
  tasks: DevTask[];
  /** 顶部 px 偏移（相对 spacer 顶端） */
  top: number;
  /** 估计高度（用于累积偏移；首次 render 后用真实测量值替换） */
  height: number;
}

const props = defineProps<{
  column: KanbanColumn;
  lanes: Lane[];
  /** 拖拽状态 —— 由父组件 KanbanPanel 持有并下发。 */
  draggedSlug: string | null;
  dragOver: boolean;
  /** 全列卡片数（用于列头计数，含本 panel 的筛选过滤之前的总数）。 */
  totalCount: number;
}>();

defineEmits<{
  open: [slug: string];
  cycle: [slug: string];
  delete: [slug: string];
  dragstart: [slug: string];
  dragend: [];
  dragover: [];
  dragleave: [];
  drop: [];
}>();

// ── 窗口化（每泳道为窗口单位） ─────────────────────────────
//
// 每条 lane 高度不固定（卡片数 1–N，~120–500px）。渲染时测一次，记到 measuredHeights。
// `top` 是该 lane 在 spacer 里的累积偏移；lane 之间的视觉间距 12px 直接加在下一个 lane 的 top。
//
// 为什么不引虚拟列表库：见 PlanningPanel。少一个依赖，少一层包装。
const OVERSCAN = 1; // 泳道通常大块；overscan 1 个足够。

/** lane 高度估算 —— 首屏渲染前用，未测量过的 lane 用此值。 */
const LANE_HEIGHT_FALLBACK = 180;
/** 泳道之间的视觉间距 —— 原来 flex `gap-3` 是 12px。 */
const LANE_GAP = 12;

const innerEl = ref<HTMLElement | null>(null);
const scrollOffset = ref(0);
const viewportHeight = ref(0);
/** userId → 测得的真实高度（px）。未测量则用 fallback。 */
const measuredHeights = ref<Map<number, number>>(new Map());

/** 当前 lanes（顺序 = 渲染顺序），附上 top 与 height。 */
const laneEntries = computed<LaneEntry[]>(() => {
  let offset = 0;
  const out: LaneEntry[] = [];
  for (const lane of props.lanes) {
    const height =
      measuredHeights.value.get(lane.userId) ?? LANE_HEIGHT_FALLBACK;
    out.push({
      userId: lane.userId,
      label: lane.label,
      tasks: lane.tasks,
      top: offset,
      height,
    });
    offset += height + LANE_GAP;
  }
  return out;
});

const totalHeight = computed(() => {
  const list = laneEntries.value;
  if (list.length === 0) return 0;
  // 末尾泳道之后不再加 LANE_GAP —— 视觉上最后一个泳道贴着列容器底部。
  const last = list[list.length - 1];
  return last.top + last.height;
});

/** 当前可视泳道索引区间。 */
const visibleRange = computed(() => {
  const list = laneEntries.value;
  const count = list.length;
  if (count === 0) return { start: 0, end: 0 };
  // start：第一个 top ≤ scrolled 的 lane（含部分可见），再 OVERSCAN 1 个以提供平滑滚动。
  let start = 0;
  let acc = 0;
  const scrolled = Math.max(0, scrollOffset.value);
  for (let i = 0; i < count; i++) {
    if (acc >= scrolled) {
      start = Math.max(0, i - OVERSCAN);
      break;
    }
    acc += list[i].height + LANE_GAP;
  }
  // end：第一个 top > scrolled + viewport 的 lane（即已完全滚出视口底部）。
  //     渲染到该 lane 之前 —— 即把"部分可见"的 lane 也包含进来。
  const bottom = scrolled + viewportHeight.value;
  let end = start;
  for (let i = start; i < count; i++) {
    if (list[i].top > bottom) break;
    end = i + 1;
  }
  end = Math.min(count, end + OVERSCAN);
  return { start, end };
});

const visibleLanes = computed(() =>
  laneEntries.value.slice(visibleRange.value.start, visibleRange.value.end),
);

function measureViewport() {
  const el = innerEl.value;
  viewportHeight.value = el?.clientHeight ?? 0;
  // 滚动容器是 `el` 本身（它的 scrollTop），不是 window。
  // —— 列头 sticky 在 el 顶部，lanes 跟着 el.scrollTop 走。
  scrollOffset.value = el?.scrollTop ?? 0;
}

/** 测量已渲染泳道的真实高度并缓存。 */
function measureLaneHeights() {
  const el = innerEl.value;
  if (!el) return;
  const lanes = el.querySelectorAll<HTMLElement>('[data-kanban-lane]');
  const next = new Map(measuredHeights.value);
  let changed = false;
  for (const laneEl of lanes) {
    const raw = laneEl.dataset.userId;
    const userId = Number(raw);
    if (!raw || !Number.isFinite(userId)) continue;
    const h = laneEl.getBoundingClientRect().height;
    if (h > 0 && (next.get(userId) ?? -1) !== h) {
      next.set(userId, h);
      changed = true;
    }
  }
  if (changed) measuredHeights.value = next;
}

let rafId: number | null = null;
function onScrollOrResize() {
  if (rafId !== null) return;
  rafId = requestAnimationFrame(() => {
    rafId = null;
    measureViewport();
  });
}

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  measureViewport();
  nextTick(() => {
    measureLaneHeights();
    measureViewport();
  });
  // 内层 overflow-y-auto 才是真正的滚动容器 —— 监听它。
  innerEl.value?.addEventListener('scroll', onScrollOrResize, {
    passive: true,
  });
  window.addEventListener('resize', onScrollOrResize, { passive: true });
  if (innerEl.value && 'ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(() => onScrollOrResize());
    resizeObserver.observe(innerEl.value);
  }
});

onBeforeUnmount(() => {
  innerEl.value?.removeEventListener('scroll', onScrollOrResize);
  window.removeEventListener('resize', onScrollOrResize);
  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = null;
  resizeObserver?.disconnect();
  resizeObserver = null;
});

watch(
  () => props.lanes,
  () => {
    nextTick(() => {
      measureLaneHeights();
      measureViewport();
    });
  },
  { deep: false },
);
</script>

<style scoped>
/* ── Empty-state fade (FADE_FAST: 0.18s ease-in, 0.12s ease-out) ── */
.fade-fast-enter-active {
  opacity: 0;
  animation: ffi-opacity-in 0.18s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
.fade-fast-leave-active {
  animation: ffi-opacity-out 0.12s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
@keyframes ffi-opacity-in {
  to {
    opacity: 1;
  }
}
@keyframes ffi-opacity-out {
  to {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .fade-fast-enter-active,
  .fade-fast-leave-active {
    animation-duration: 0.01ms;
  }
}
</style>