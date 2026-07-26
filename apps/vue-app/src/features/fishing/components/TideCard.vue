<script setup lang="ts">
import { useChartColors, withAlpha } from '@/composables';
import {
  HARBOR_OPTIONS,
  useTidePanelStore,
} from '@/features/fishing/stores/tidePanel';
import { HoverDropdown } from '@/components';
import { Check, ChevronDown } from '@lucide/vue';
import DashboardCard from './DashboardCard.vue';
import dayjs from 'dayjs';
import { storeToRefs } from 'pinia';
import { computed, onMounted } from 'vue';
import VChart from 'vue-echarts';

const tidePanelStore = useTidePanelStore();
const {
  panelTideData,
  tideLoading,
  selectedHarbor: selectedHarborState,
  selectedDate: selectedDateState,
  panelTideSpotName,
} = storeToRefs(tidePanelStore);

const tideData = computed(() => panelTideData.value);
const loading = computed(() => tideLoading.value);
const tideSpotName = computed(() => panelTideSpotName.value);
const { palette } = useChartColors();

const selectedHarbor = computed({
  get: () => selectedHarborState.value,
  set: (value: string) => tidePanelStore.setSelectedHarbor(value),
});
const selectedDate = computed({
  get: () => selectedDateState.value,
  set: (value: string) => tidePanelStore.setSelectedDate(value),
});

const dateOptions = computed(() =>
  Array(8)
    .fill(null)
    .map((_, i) => {
      const d = dayjs().add(i, 'day');
      return {
        value: d.format('YYYYMMDD'),
        label: d.format('MM-DD'),
        weekday: d.format('dd'),
      };
    }),
);

const todayStr = computed(() => {
  const opt = dateOptions.value.find((o) => o.value === selectedDate.value);
  return opt ? `${opt.label} ${opt.weekday}` : dayjs().format('YYYY-MM-DD');
});

const selectedHarborName = computed(() => {
  const opt = HARBOR_OPTIONS.find((o) => o.code === selectedHarbor.value);
  return opt?.name ?? '选择港口';
});

/**
 * 当前潮向:拿逐时曲线里「现在」所处点与下一点比高度,得涨/落/平。
 * 纯展示,失败时返回 null 不影响任何交互。
 */
const tideTrend = computed<'rising' | 'falling' | 'slack' | null>(() => {
  const hourly = tideData.value?.tideHourly;
  if (!hourly || hourly.length < 2) return null;
  const now = dayjs();
  let idx = -1;
  hourly.forEach((point, i) => {
    if (!dayjs(point.fxTime).isAfter(now)) idx = i;
  });
  if (idx < 0) idx = 0;
  const next = hourly[Math.min(idx + 1, hourly.length - 1)];
  const cur = hourly[idx];
  const delta = Number(next.height) - Number(cur.height);
  if (Math.abs(delta) < 0.03) return 'slack';
  return delta > 0 ? 'rising' : 'falling';
});

const trendLabel = computed(() => {
  switch (tideTrend.value) {
    case 'rising':
      return '涨潮';
    case 'falling':
      return '落潮';
    case 'slack':
      return '平潮';
    default:
      return '';
  }
});

/** 选完之后立刻关闭 dropdown — slot 暴露的 close() 在两个 picker 都要 */
function pickHarbor(code: string, close: () => void) {
  selectedHarbor.value = code;
  close();
}

function pickDate(value: string, close: () => void) {
  selectedDate.value = value;
  close();
}

const highTide = computed(() => {
  if (!tideData.value) return null;
  const highs = tideData.value.tideTable.filter((t) => t.type === 'H');
  if (highs.length === 0) return null;
  const maxEntry = highs.reduce((acc, h) =>
    Number(h.height) > Number(acc.height) ? h : acc,
  );
  return {
    height: Number(maxEntry.height),
    time: dayjs(maxEntry.fxTime).format('HH:mm'),
    fxTime: maxEntry.fxTime,
  };
});

const lowTide = computed(() => {
  if (!tideData.value) return null;
  const lows = tideData.value.tideTable.filter((t) => t.type === 'L');
  if (lows.length === 0) return null;
  const minEntry = lows.reduce((acc, l) =>
    Number(l.height) < Number(acc.height) ? l : acc,
  );
  return {
    height: Number(minEntry.height),
    time: dayjs(minEntry.fxTime).format('HH:mm'),
    fxTime: minEntry.fxTime,
  };
});

/** 把 fxTime ISO 字符串映射到 tideHourly 数组中最近的 index,供 markPoint 用 */
function findHourlyIndex(targetFxTime: string | undefined): number {
  if (!tideData.value || !targetFxTime) return -1;
  const target = dayjs(targetFxTime).valueOf();
  let bestIdx = -1;
  let bestDelta = Infinity;
  tideData.value.tideHourly.forEach((pt, idx) => {
    const delta = Math.abs(dayjs(pt.fxTime).valueOf() - target);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestIdx = idx;
    }
  });
  return bestIdx;
}

const tideOptions = computed(() => {
  if (!tideData.value) return {};
  const p = palette.value;

  const hourly = tideData.value.tideHourly;
  const now = dayjs();
  let currentTimeIndex = -1;
  hourly.forEach((point, index) => {
    const pointTime = dayjs(point.fxTime);
    if (pointTime.isBefore(now) || pointTime.isSame(now)) {
      currentTimeIndex = index;
    }
  });

  // markPoint data 数组:把当日的高潮 / 低潮标到曲线上
  const markPointData: Array<{
    name: string;
    value: string;
    coord: [number, number];
    itemStyle: { color: string };
  }> = [];
  if (highTide.value) {
    const idx = findHourlyIndex(highTide.value.fxTime);
    if (idx >= 0) {
      markPointData.push({
        name: `高潮 ${highTide.value.time}`,
        value: `${highTide.value.height.toFixed(2)}m`,
        coord: [idx, highTide.value.height],
        itemStyle: { color: p.warning },
      });
    }
  }
  if (lowTide.value) {
    const idx = findHourlyIndex(lowTide.value.fxTime);
    if (idx >= 0) {
      markPointData.push({
        name: `低潮 ${lowTide.value.time}`,
        value: `${lowTide.value.height.toFixed(2)}m`,
        coord: [idx, lowTide.value.height],
        itemStyle: { color: p.primary },
      });
    }
  }

  return {
    backgroundColor: 'transparent',
    // 关键:禁用 animation 避免 setOption 时 echarts interpolate1DArray 崩
    // (3-stop 渐变 + markPoint pin coord 都参与动画时容易出问题)
    tooltip: {
      trigger: 'axis',
      backgroundColor: p.card,
      borderColor: withAlpha(p.border, 0.08),
      borderWidth: 1,
      borderRadius: 10,
      padding: [10, 14],
      textStyle: { color: p.foreground, fontSize: 12 },
      formatter: (params: unknown) => {
        const arr = params as Array<{ axisValue: string; data: number }>;
        const param = arr[0];
        if (!param) return '';
        const timeStr = dayjs(param.axisValue).format('HH:mm');
        return `<div style="padding:2px 0;">
          <div style="font-weight:600;margin-bottom:4px;font-size:11px;color:${p.mutedForeground};">${timeStr}</div>
          <div>潮高 <span style="color:${p.primary};font-weight:700;margin-left:8px;">${param.data.toFixed(2)} m</span></div>
        </div>`;
      },
    },
    grid: { left: 8, right: 8, top: 28, bottom: 8, containLabel: true },
    xAxis: {
      type: 'category',
      data: hourly.map((point) => point.fxTime),
      axisLabel: {
        formatter: (value: string) => dayjs(value).format('HH:mm'),
        color: p.mutedForeground,
        fontSize: 10,
        interval: Math.max(0, Math.floor(hourly.length / 6) - 1),
      },
      axisLine: { lineStyle: { color: p.border } },
      axisTick: { show: false },
      splitLine: { show: false },
      boundaryGap: false,
    },
    yAxis: {
      type: 'value',
      splitNumber: 3,
      axisLabel: {
        color: p.mutedForeground,
        fontSize: 10,
        formatter: (v: number) => `${v}m`,
      },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: {
        lineStyle: { color: p.border, type: 'dashed', opacity: 0.5 },
      },
    },
    series: [
      {
        name: '潮高',
        data: hourly.map((point) => Number(point.height)),
        type: 'line',
        smooth: 0.4,
        symbol: 'none',
        lineStyle: { color: p.primary, width: 2.5 },
        itemStyle: { color: p.primary },
        // hover 时 echarts 6 默认会把 series 切到 emphasis,把面积 + markPoint
        // 推到 blur 态(opacity 接近 0),整张图看似变白消失。显式禁用 emphasis
        // 并把 blur 锁回原透明度,确保 hover 时图形保持稳定
        emphasis: { disabled: true },
        blur: {
          areaStyle: { opacity: 1 },
          itemStyle: { opacity: 1 },
          lineStyle: { opacity: 1 },
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: withAlpha(p.primary, 0.18) },
              { offset: 0.7, color: withAlpha(p.primary, 0.04) },
              { offset: 1, color: withAlpha(p.primary, 0) },
            ],
          },
        },
        markLine:
          currentTimeIndex >= 0
            ? {
                symbol: ['none', 'none'],
                lineStyle: { color: p.warning, type: 'dashed', width: 1 },
                label: {
                  show: true,
                  formatter: '现在',
                  color: p.warning,
                  fontWeight: 600,
                  fontSize: 10,
                  position: 'insideEndTop',
                },
                data: [{ xAxis: currentTimeIndex }],
              }
            : undefined,
        markPoint: {
          symbol: 'circle',
          symbolSize: 9,
          data: markPointData,
          // dot 风格:实心圆 + 卡片色描边,hover 时的数据走 tooltip 不走 label,
          // 避免在曲线上叠一个大标签挡住波形
          itemStyle: {
            borderColor: p.card,
            borderWidth: 2,
          },
          label: { show: false },
        },
      },
    ],
  };
});

onMounted(() => {
  if (!panelTideData.value) {
    void tidePanelStore.fetchPanelTide(
      selectedHarborState.value,
      selectedDateState.value,
    );
  }
});
</script>

<template>
  <DashboardCard>
    <!-- Header -->
    <div class="mb-1 flex items-start justify-between gap-2">
      <div class="min-w-0">
        <h3 class="text-ink font-serif text-lg font-semibold tracking-tight">
          潮汐预报
        </h3>
        <p class="text-muted mt-1 flex items-center gap-1.5 truncate text-sm">
          <span class="truncate">{{ tideSpotName }} · {{ todayStr }}</span>
          <span
            v-if="trendLabel"
            class="text-accent inline-flex shrink-0 items-center gap-0.5 text-xs font-medium"
          >
            <span aria-hidden="true">·</span>{{ trendLabel }}
          </span>
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-1.5">
        <HoverDropdown
          panel-class="bg-page absolute top-full right-0 z-50 mt-2 w-44 rounded-2xl p-1.5 ring-1 ring-black/5 backdrop-blur-xs dark:ring-white/10"
        >
          <template #trigger="{ isOpen }">
            <button
              type="button"
              aria-label="选择港口"
              :aria-expanded="isOpen || undefined"
              aria-haspopup="true"
              class="bg-page text-ink hover:ring-accent focus:ring-accent flex cursor-pointer items-center gap-1 rounded-lg border px-1.5 py-1 text-xs transition-shadow focus:ring-1 focus:outline-none"
            >
              <span>{{ selectedHarborName }}</span>
              <ChevronDown
                :size="12"
                class="transition-transform duration-150"
                :class="{ 'rotate-180': isOpen }"
              />
            </button>
          </template>
          <template #default="{ close }">
            <button
              v-for="opt in HARBOR_OPTIONS"
              :key="opt.code"
              type="button"
              @click="pickHarbor(opt.code, close)"
              class="hover:bg-surface text-ink flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs"
            >
              <span>{{ opt.name }}</span>
              <Check
                v-if="opt.code === selectedHarbor"
                :size="14"
                class="text-accent"
              />
            </button>
          </template>
        </HoverDropdown>

        <HoverDropdown
          panel-class="bg-page absolute top-full right-0 z-50 mt-2 w-36 rounded-2xl p-1.5 ring-1 ring-black/5 backdrop-blur-xs dark:ring-white/10"
        >
          <template #trigger="{ isOpen }">
            <button
              type="button"
              aria-label="选择日期"
              :aria-expanded="isOpen || undefined"
              aria-haspopup="true"
              class="bg-page text-ink hover:ring-accent focus:ring-accent flex cursor-pointer items-center gap-1 rounded-lg border px-1.5 py-1 text-xs transition-shadow focus:ring-1 focus:outline-none"
            >
              <span>{{ todayStr }}</span>
              <ChevronDown
                :size="12"
                class="transition-transform duration-150"
                :class="{ 'rotate-180': isOpen }"
              />
            </button>
          </template>
          <template #default="{ close }">
            <button
              v-for="opt in dateOptions"
              :key="opt.value"
              type="button"
              @click="pickDate(opt.value, close)"
              class="hover:bg-surface text-ink flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs"
            >
              <span>{{ opt.label }} {{ opt.weekday }}</span>
              <Check
                v-if="opt.value === selectedDate"
                :size="14"
                class="text-accent"
              />
            </button>
          </template>
        </HoverDropdown>
      </div>
    </div>

    <!-- Loading -->
    <div
      v-if="loading"
      class="flex flex-1 flex-col items-center justify-center py-12"
    >
      <div
        class="border-t-accent h-10 w-10 animate-spin rounded-full border-2"
      />
      <span class="text-muted mt-3 text-sm">获取潮汐数据...</span>
    </div>

    <!-- 数据 -->
    <div v-else-if="tideData" class="mt-3 flex flex-1 flex-col">
      <!-- 潮汐历读数:满潮 | 干潮,两列排印 + 印刷竖线,不套卡片 -->
      <div
        class="grid grid-cols-[1fr_auto_1fr] content-center items-center gap-x-5"
      >
        <!-- 满潮 -->
        <div class="min-w-0">
          <div class="flex items-baseline justify-between gap-2">
            <span
              class="text-muted inline-flex items-center gap-1.5 text-xs font-medium tracking-wide"
            >
              <span class="bg-warning h-1.5 w-1.5 rounded-full" aria-hidden />
              满潮
            </span>
            <span class="text-muted text-xs tabular-nums">
              {{ highTide?.time ?? '--:--' }}
            </span>
          </div>
          <p
            class="text-ink mt-1.5 text-xl leading-none font-semibold tabular-nums"
          >
            {{ highTide ? highTide.height.toFixed(2) : '--'
            }}<span class="text-muted ml-1 font-sans text-base font-normal"
              >m</span
            >
          </p>
        </div>

        <!-- 印刷竖线分隔:非卡片,纯排印分割 -->
        <div
          class="my-1 w-px self-stretch"
          :style="{
            backgroundImage:
              'repeating-linear-gradient(to bottom, var(--color-border) 0 3px, transparent 3px 7px)',
          }"
          aria-hidden="true"
        />

        <!-- 干潮 -->
        <div class="min-w-0">
          <div class="flex items-baseline justify-between gap-2">
            <span
              class="text-muted inline-flex items-center gap-1.5 text-xs font-medium tracking-wide"
            >
              <span class="bg-accent h-1.5 w-1.5 rounded-full" aria-hidden />
              干潮
            </span>
            <span class="text-muted text-xs tabular-nums">
              {{ lowTide?.time ?? '--:--' }}
            </span>
          </div>
          <p
            class="text-ink mt-1.5 text-xl leading-none font-semibold tabular-nums"
          >
            {{ lowTide ? lowTide.height.toFixed(2) : '--'
            }}<span class="text-muted ml-1 font-sans text-base font-normal"
              >m</span
            >
          </p>
        </div>
      </div>

      <!-- 印刷横线:把读数与水墨潮汐带分开 -->
      <div
        class="my-1 h-px w-full shrink-0"
        :style="{
          backgroundImage:
            'repeating-linear-gradient(to right, var(--color-border) 0 4px, transparent 4px 8px)',
        }"
        aria-hidden="true"
      />

      <!-- 水墨潮汐带:flex-1 与读数区平均分配剩余高度 -->
      <div class="h-full min-h-[160px] flex-1">
        <v-chart
          :option="tideOptions"
          style="width: 100%; height: 100%"
          autoresize
        />
      </div>
    </div>

    <!-- 空态 -->
    <div v-else class="flex flex-1 flex-col items-center justify-center py-8">
      <div
        class="bg-surface mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="text-muted h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <p class="text-ink text-sm">暂无潮汐数据</p>
    </div>
  </DashboardCard>
</template>
