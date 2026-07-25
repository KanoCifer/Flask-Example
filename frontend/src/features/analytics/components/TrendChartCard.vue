<template>
  <div class="bg-card h-full rounded-3xl border p-6 shadow-sm">
    <h2 class="text-ink mb-4 flex items-center gap-2 text-sm font-medium">
      <icon-trend class="size-5" />
      访问趋势 · 最近 {{ selectedDays }} 天
    </h2>
    <SkeletonCrossfadeTransition>
      <div
        v-if="loading && !overviewData"
        key="loading"
        class="bg-surface h-72 animate-pulse rounded-xl"
      ></div>
      <!-- Empty state -->
      <div
        v-else-if="!hasTrendData"
        key="empty"
        class="flex h-72 flex-col items-center justify-center gap-2 px-6 text-center"
      >
        <icon-trend class="text-muted/50 size-8" />
        <p class="text-ink text-sm font-medium">暂无访问记录</p>
        <p class="text-muted max-w-xs text-xs">
          网站开始接收流量后，近 {{ selectedDays }} 天的访问趋势将显示在这里。
        </p>
      </div>
      <div v-else key="data" class="h-72 w-full overflow-hidden">
        <v-chart :option="trendChartOption" autoresize class="h-full w-full" />
      </div>
    </SkeletonCrossfadeTransition>
  </div>
</template>

<script setup lang="ts">
import { IconTrend, SkeletonCrossfadeTransition } from '@/components';
import { useChartColors, withAlpha } from '@/composables';
import dayjs from 'dayjs';
import { computed } from 'vue';
import VChart from 'vue-echarts';

interface OverviewData {
  daily_trend: { date: string; count: number }[];
  period_days: number;
  [key: string]: unknown;
}

const props = defineProps<{
  loading: boolean;
  overviewData: OverviewData | null;
  selectedDays: number;
}>();

const { palette } = useChartColors();

const hasTrendData = computed(
  () => (props.overviewData?.daily_trend ?? []).length > 0,
);

const trendChartOption = computed(() => {
  const p = palette.value;
  const data = props.overviewData?.daily_trend ?? [];
  const sortedData = [...data].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const stroke = p.series[0];

  return {
    // 禁用 animation 避免 setOption 渐变动画时 echarts interpolate1DArray 崩
    animation: false,
    tooltip: {
      trigger: 'axis',
      confine: true,
      backgroundColor: p.card,
      borderColor: p.border,
      borderWidth: 1,
      textStyle: { color: p.foreground },
      axisPointer: {
        type: 'line',
        lineStyle: { color: withAlpha(p.foreground, 0.18), width: 1 },
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: sortedData.map((d) => d.date),
      axisLine: { lineStyle: { color: p.border } },
      axisLabel: {
        color: p.mutedForeground,
        formatter: (value: string) => dayjs(value).format('MM/DD'),
      },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisLabel: { color: p.mutedForeground },
      splitLine: { lineStyle: { color: withAlpha(p.border, 0.45) } },
    },
    series: [
      {
        name: '访问量',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2, color: stroke, cap: 'round' },
        itemStyle: { color: stroke },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: withAlpha(stroke, 0.18) },
              { offset: 1, color: withAlpha(stroke, 0.02) },
            ],
          },
        },
        data: sortedData.map((d) => d.count),
      },
    ],
  };
});
</script>
