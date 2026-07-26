<script setup lang="ts">
import type { ReadStatsMode } from '@/features/books/api';
import dayjs from 'dayjs';
import { ref, toRef } from 'vue';
import {
  useYearHeatmapView,
  type HeatmapCell,
  type YearlyHeatmapData,
} from '../composables/useYearHeatmapView';

const props = defineProps<{
  /** dayUnixSec(字符串) -> 当日阅读秒数;null 时不渲染 */
  heatmap: YearlyHeatmapData;
  year: number;
  mode: ReadStatsMode;
}>();

// 把非 ref 的 props 包成 ref,让 narrow composable 可以订阅
const heatmapRef = toRef(props, 'heatmap');
const yearRef = toRef(props, 'year');
const modeRef = toRef(props, 'mode');

const { hasData, subtitle, view, totalActiveDays, maxSeconds, formatDuration } =
  useYearHeatmapView(heatmapRef, yearRef, modeRef);

// ── 显示常量 ──────────────────────────────────────────────
// 仅显示 Mon / Wed / Fri,与 GitHub contribution graph 一致;
// 其余 4 行的日期由列对齐位置推断。
const WEEKDAY_LABELS = ['', '一', '', '三', '', '五', ''] as const;
// Tooltip 用全量 周一..周日;dayjs.day() 0=Sun,1=Mon..6=Sat
const WEEKDAY_CN = ['日', '一', '二', '三', '四', '五', '六'] as const;
// L0(无数据 / 越界空槽) 用 muted,1..4 走 primary 的 4 级透明度
const INTENSITY_CLASS = [
  'bg-surface',
  'bg-accent/20',
  'bg-accent/40',
  'bg-accent/70',
  'bg-accent',
] as const;

function cellClass(cell: HeatmapCell | null) {
  return INTENSITY_CLASS[cell?.level ?? 0];
}

// ── Tooltip state ─────────────────────────────────────────
// 单例 tooltip:全网格共享一个浮层;移动鼠标到新 cell 时更新坐标与内容。
// 用 Teleport to="body" + position:fixed 渲染到顶层,避开容器
// overflow-x:auto 裁剪问题。
const tooltipCell = ref<HeatmapCell | null>(null);
const tooltipLeft = ref(0);
const tooltipTop = ref(0);
let showTimer: ReturnType<typeof setTimeout> | null = null;

function formatTooltipDate(dateStr: string): string {
  return `${dateStr} 周${WEEKDAY_CN[dayjs(dateStr).day()]}`;
}

function onCellEnter(event: MouseEvent, cell: HeatmapCell) {
  if (showTimer) clearTimeout(showTimer);
  showTimer = setTimeout(() => {
    const cellEl = event.currentTarget as HTMLElement | null;
    if (!cellEl) return;
    const rect = cellEl.getBoundingClientRect();
    // 视口坐标:Teleport+fixed 直接吃
    tooltipLeft.value = rect.left + rect.width / 2;
    tooltipTop.value = rect.top - 6;
    tooltipCell.value = cell;
  }, 120);
}

function onCellLeave() {
  if (showTimer) {
    clearTimeout(showTimer);
    showTimer = null;
  }
  tooltipCell.value = null;
}
</script>

<template>
  <section v-if="hasData" class="mb-14">
    <h2
      class="text-ink font-serif text-2xl font-semibold tracking-tight sm:text-3xl"
    >
      本年的阅读足迹
    </h2>
    <p class="text-muted mt-2 mb-5 text-sm">
      {{ subtitle }}
    </p>

    <div
      class="bg-page/50 overflow-x-auto rounded-lg border p-3 sm:p-4"
      role="img"
      :aria-label="`${year}年阅读足迹,共${totalActiveDays}天有阅读`"
    >
      <div class="min-w-[640px]">
        <!--
          单 grid 控制所有定位:
          - col 0:周次标签列(auto)
          - col 1..53:数据列(minmax(0, 1fr))
          - row 0:月份标签(auto)
          - row 1..7:数据行(minmax(0, 1fr),与 7 个 cell 行对齐)
          所有 item 显式 gridColumn/gridRow,避开 auto-flow 的不确定性。
        -->
        <div
          class="grid gap-[3px]"
          :style="{
            gridTemplateColumns: `auto repeat(${view.weeks.length}, minmax(0, 1fr))`,
            gridTemplateRows: 'auto repeat(7, minmax(0, 1fr))',
          }"
        >
          <!-- row 0 col 0:空角 -->
          <div />

          <!-- row 0 col 1..N:月份标签(只在该月 1 日所在周列显示) -->
          <div
            v-for="m in view.monthLabels"
            :key="`m-${m.month}`"
            class="text-muted h-3 text-[10px] leading-3"
            :style="{ gridColumn: m.weekIdx + 2, gridRow: 1 }"
          >
            {{ m.month }}月
          </div>

          <!-- row 1..7 col 0:周次标签(一/三/五) -->
          <div
            v-for="(l, i) in WEEKDAY_LABELS"
            :key="`wlabel-${i}`"
            class="text-muted flex items-center justify-end pr-1.5 text-[10px] leading-3"
            :style="{ gridColumn: 1, gridRow: i + 2 }"
          >
            {{ l }}
          </div>

          <!-- row 1..7 col 1..N:cells(7×53 = 371 个) -->
          <template v-for="(week, wi) in view.weeks" :key="`w-${wi}`">
            <div
              v-for="(cell, di) in week"
              :key="`c-${wi}-${di}`"
              class="aspect-square cursor-help rounded-[2px] transition-transform hover:z-10 hover:scale-125"
              :class="cellClass(cell)"
              :style="{ gridColumn: wi + 2, gridRow: di + 2 }"
              :title="cell ? formatTooltipDate(cell.date) : ''"
              @mouseenter="cell && onCellEnter($event, cell)"
              @mouseleave="onCellLeave"
            />
          </template>
        </div>

        <!-- 图例:行尾右对齐,5 个色块配 少/多 文字 -->
        <div
          class="text-muted mt-3 flex items-center justify-end gap-2 text-[10px] sm:text-xs"
        >
          <span>少</span>
          <div class="flex items-center gap-[2px]">
            <div
              v-for="(cls, i) in INTENSITY_CLASS"
              :key="`leg-${i}`"
              class="h-[10px] w-[10px] rounded-[2px] sm:h-[11px] sm:w-[11px]"
              :class="cls"
            />
          </div>
          <span>多</span>
        </div>
      </div>
    </div>

    <!--
      Tooltip:Teleport 到 body,position:fixed,视口坐标;
      容器 overflow-x:auto 不会裁剪它。pointer-events:none 避免遮挡鼠标事件。
    -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-100 ease-out"
        enter-from-class="translate-y-1 opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition duration-75 ease-out"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="tooltipCell"
          class="bg-page text-ink pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-md border px-2.5 py-1.5 text-xs whitespace-nowrap shadow-md"
          :style="{ left: `${tooltipLeft}px`, top: `${tooltipTop}px` }"
        >
          <div class="text-ink font-medium tabular-nums">
            {{ formatTooltipDate(tooltipCell.date) }}
          </div>
          <div
            class="text-muted mt-0.5 text-[11px] tabular-nums"
            :class="tooltipCell.secs > 0 ? '' : 'text-muted/70 italic'"
          >
            {{
              tooltipCell.secs > 0 ? formatDuration(tooltipCell.secs) : '未读'
            }}
          </div>
        </div>
      </Transition>
    </Teleport>

    <p v-if="totalActiveDays > 0" class="text-muted mt-3 text-xs sm:text-sm">
      共
      <span class="text-ink font-medium tabular-nums">
        {{ totalActiveDays }}
      </span>
      天有阅读记录,最多的一天
      <span class="text-ink font-medium tabular-nums">
        {{ formatDuration(maxSeconds) }}
      </span>
    </p>
  </section>
</template>
