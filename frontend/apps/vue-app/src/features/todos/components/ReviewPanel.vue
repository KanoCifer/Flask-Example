<template>
  <div class="space-y-8">
    <!-- ── 本周复盘：单张 lifted-page 汇总，不再是四张同构指标卡 ── -->
    <section>
      <div class="mb-3 flex items-baseline justify-between">
        <h2 class="text-ink font-serif text-lg font-medium tracking-tight">
          本周复盘
        </h2>
        <span class="text-muted text-xs tabular-nums">{{ weekRange }}</span>
      </div>

      <div class="bg-surface rounded-3xl px-6 py-5">
        <!-- 主图：本周完成数 + 真实同比 -->
        <div class="text-muted font-serif text-xs tracking-widest">
          本周完成
        </div>
        <div class="mt-1.5 flex items-baseline gap-3">
          <span
            class="text-ink font-family-averia text-5xl leading-none font-normal tracking-tight tabular-nums"
          >
            {{ displayValue }}
          </span>
          <span
            class="flex items-center gap-1 text-sm font-medium"
            :class="delta.class"
          >
            <svg
              v-if="delta.dir !== 'flat'"
              class="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                :d="delta.dir === 'up' ? DELTA_UP : DELTA_DOWN"
              />
            </svg>
            {{ delta.label }}
          </span>
        </div>

        <!-- 分隔线：中性 hairline，非 border-left 强调 -->
        <div class="bg-border/70 my-4 h-px" aria-hidden="true" />

        <!-- 支撑行：真实计数，逾期 / P0 有值时着色 -->
        <div class="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <template v-for="(s, i) in supporting" :key="s.label">
            <span v-if="i" class="text-border" aria-hidden="true">·</span>
            <span class="flex items-baseline gap-1.5">
              <span class="text-muted">{{ s.label }}</span>
              <span class="font-medium tabular-nums" :class="s.valueClass">{{
                s.value
              }}</span>
            </span>
          </template>
        </div>
      </div>
    </section>

    <!-- ── 类型分布：横向条形，用 chart token 着色 ── -->
    <section>
      <div class="mb-3 flex items-baseline justify-between">
        <h2 class="text-ink font-serif text-lg font-medium tracking-tight">
          类型分布
        </h2>
        <span class="text-muted text-xs">全部任务</span>
      </div>
      <div class="space-y-3">
        <div
          v-for="row in distributionRows"
          :key="row.type"
          class="flex items-center gap-3"
        >
          <span class="text-ink w-16 shrink-0 text-sm">{{ row.type }}</span>
          <div class="bg-surface h-2 flex-1 overflow-hidden rounded-full">
            <div
              class="animate-progress h-full rounded-full transition-transform"
              :style="{
                width: '100%',
                transform: `scaleX(${row.pct / 100})`,
                backgroundColor: row.color,
                transformOrigin: 'left',
              }"
            />
          </div>
          <span
            class="text-muted w-6 shrink-0 text-right text-xs tabular-nums"
            >{{ row.count }}</span
          >
        </div>
      </div>
    </section>

    <!-- ── 最近完成：复用共享 TaskRow(:done)，与「推进」视图同一行语汇 ── -->
    <section>
      <div class="mb-3 flex items-baseline justify-between">
        <div class="flex items-center gap-2">
          <h2 class="text-ink font-serif text-lg font-medium tracking-tight">
            最近完成
          </h2>
          <span
            v-if="doneThisWeek.length"
            class="text-muted bg-surface/10 inline-block min-w-[1.25rem] rounded-full px-1.5 text-center text-[11px] font-medium tabular-nums"
          >
            {{ doneThisWeek.length }}
          </span>
        </div>
        <span class="text-muted text-xs">按完成时间倒序</span>
      </div>

      <div v-if="doneThisWeek.length" class="space-y-2">
        <TaskRow
          v-for="task in doneThisWeek.slice(0, 8)"
          :key="task.slug"
          :task="task"
          :done="true"
          @open="$emit('open', $event)"
          @delete="$emit('delete', $event)"
        />
        <p
          v-if="doneThisWeek.length > 8"
          class="text-muted/70 px-1 pt-1 text-xs"
        >
          共 {{ doneThisWeek.length }} 个，仅显示最近 8 个
        </p>
      </div>
      <div v-else class="text-muted/70 px-1 py-6 text-center text-sm">
        本周还没有完成的任务
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import TaskRow from './TaskRow.vue';
import { useV3DevTaskStore } from '@/features/todos/stores/v3devtasks';
import {
  completedThisWeek,
  inProgress,
  urgentActive,
  typeDistribution,
} from '@/features/todos/composables';
import { formatCurrentWeekRange } from '@/lib/dayjs';
import type { DevTaskType } from '@/features/todos/api';
import { useAnimateNumber } from '@/composables';

const { displayValue, animateTo } = useAnimateNumber();

const store = useV3DevTaskStore();

// 趋势箭头（trending up / down），仅两条 path，按方向切换。
const DELTA_UP = 'M7 17L17 7M17 7H9M17 7V15';
const DELTA_DOWN = 'M7 7l10 10M17 17H9M17 17V9';

// 分布条颜色沿用 chart token —— 不引入新颜色。
const TYPE_COLORS: Record<DevTaskType, string> = {
  功能需求: 'var(--chart-1)',
  问题: 'var(--chart-4)',
  优化: 'var(--chart-5)',
  技术债: 'var(--chart-2)',
};

const weekRange = formatCurrentWeekRange();

/** 本周自然周起点（周一）—— 与 completedThisWeek 复用同一口径，保证同比不错位。 */
const weekStart = computed(() => {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay() + 1);
  start.setHours(0, 0, 0, 0);
  return start;
});

const doneThisWeek = computed(() => completedThisWeek(store.tasks));

watch(
  doneThisWeek,
  (n) => {
    animateTo(n.length);
  },
  { immediate: true },
);

/** 上周同口径完成数：updated_at 落在 [上周一, 本周一)。 */
const doneLastWeek = computed(() => {
  const start = weekStart.value;
  const prevStart = new Date(start);
  prevStart.setDate(start.getDate() - 7);
  return store.tasks.filter(
    (t) =>
      t.status === '已完成' &&
      !t.is_deleted &&
      t.updated_at &&
      new Date(t.updated_at) >= prevStart &&
      new Date(t.updated_at) < start,
  ).length;
});

/** 真实同比：本周完成 − 上周完成。语义着色（增→success，减→destructive）。 */
const delta = computed(() => {
  const d = doneThisWeek.value.length - doneLastWeek.value;
  if (d > 0) {
    return { dir: 'up' as const, class: 'text-success', label: `较上周 +${d}` };
  }
  if (d < 0) {
    return {
      dir: 'down' as const,
      class: 'text-destructive',
      label: `较上周 ${d}`,
    };
  }
  return {
    dir: 'flat' as const,
    class: 'text-muted',
    label: '与上周持平',
  };
});

const createdThisWeek = computed(
  () =>
    store.tasks.filter(
      (t) =>
        !t.is_deleted &&
        t.created_at &&
        new Date(t.created_at) >= weekStart.value,
    ).length,
);

/** 逾期：有截止日、已过期、仍未完成。YYYY-MM-DD 可按字典序比较。 */
const overdue = computed(() => {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return store.tasks.filter(
    (t) =>
      !t.is_deleted &&
      t.status !== '已完成' &&
      t.due_date &&
      t.due_date < todayStr,
  ).length;
});

const supporting = computed(() => {
  const overdueCount = overdue.value;
  const p0 = urgentActive(store.tasks);
  return [
    {
      label: '新建',
      value: createdThisWeek.value,
      valueClass: 'text-ink',
    },
    {
      label: '进行中',
      value: inProgress(store.tasks).length,
      valueClass: 'text-ink',
    },
    {
      label: '逾期',
      value: overdueCount,
      valueClass: overdueCount ? 'text-destructive' : 'text-ink',
    },
    {
      label: 'P0',
      value: p0,
      valueClass: p0 ? 'text-warning' : 'text-ink',
    },
  ];
});

const distributionRows = computed(() => {
  const dist = typeDistribution(store.tasks);
  const total = Object.values(dist).reduce((a, b) => a + b, 0) || 1;
  return (Object.keys(dist) as DevTaskType[]).map((type) => ({
    type,
    count: dist[type],
    pct: (dist[type] / total) * 100,
    color: TYPE_COLORS[type],
  }));
});

defineEmits<{
  open: [slug: string];
  delete: [slug: string];
}>();
</script>

<style lang="scss" scoped>
.animate-progress {
  will-change: width;
  animation: progress 0.8s ease-out;
}

@keyframes progress {
  0% {
    width: 0;
  }
  100% {
    width: 100%;
  }
}
</style>
