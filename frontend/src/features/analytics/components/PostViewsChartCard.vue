<template>
  <div class="bg-card h-full rounded-3xl border p-6 shadow-sm">
    <h2 class="text-ink mb-2 flex items-center gap-2 text-sm font-medium">
      <icon-document-text class="size-5" /> 文章阅读量
    </h2>
    <p class="text-muted mb-4 text-xs">浏览量前 {{ MAX_ITEMS - 1 }} 的文章</p>
    <SkeletonCrossfadeTransition>
      <div
        v-if="loading && !data"
        key="loading"
        class="bg-surface h-full min-h-[14rem] animate-pulse rounded-xl"
      ></div>
      <!-- Empty state -->
      <div
        v-else-if="!hasData"
        key="empty"
        class="flex min-h-[14rem] flex-col items-center justify-center gap-2 px-6 text-center"
      >
        <icon-document-text class="text-muted/50 size-8" />
        <p class="text-ink text-sm font-medium">暂无文章阅读数据</p>
        <p class="text-muted max-w-xs text-xs">
          文章发布并获得浏览量后，热门文章将显示在这里。
        </p>
      </div>
      <div v-else key="data" class="h-80 w-full overflow-hidden">
        <v-chart :option="chartOption" autoresize class="h-full w-full" />
      </div>
    </SkeletonCrossfadeTransition>
  </div>
</template>

<script setup lang="ts">
import { IconDocumentText, SkeletonCrossfadeTransition } from '@/components';
import type { PostViewData } from '@/features/analytics/types';
import { useChartColors } from '@/composables';
import { computed } from 'vue';
import VChart from 'vue-echarts';

const MAX_ITEMS = 10;

const props = defineProps<{
  loading: boolean;
  data: PostViewData[] | null;
}>();

const { palette } = useChartColors();

const hasData = computed(() => (props.data ?? []).length > 0);

/** 取 views 最高的 MAX_ITEMS-1 篇，余下合并为「其他」。 */
const chartData = computed<PostViewData[]>(() => {
  const rows = props.data ?? [];
  // Sort asc so largest bar sits at the top of the horizontal chart.
  const sorted = [...rows].sort((a, b) => a.views - b.views);
  if (sorted.length <= MAX_ITEMS) return sorted;
  const head = sorted.slice(0, MAX_ITEMS - 1);
  const othersViews = sorted
    .slice(MAX_ITEMS - 1)
    .reduce((sum, it) => sum + it.views, 0);
  return [...head, { title: '其他', views: othersViews }];
});

const chartOption = computed(() => {
  const p = palette.value;
  const rows = chartData.value;
  const data = rows.map((r) => r.views);
  const maxVal = Math.max(...data, 1);

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      confine: true,
      backgroundColor: p.card,
      borderColor: p.border,
      borderWidth: 1,
      textStyle: { color: p.foreground },
      formatter: (params: unknown) => {
        const arr = params as Array<{ name: string; value: number }>;
        const it = arr[0];
        if (!it) return '';
        return `<div style="font-weight:600;color:${p.foreground};">${it.name}</div><div style="color:${p.mutedForeground};margin-top:2px;">${it.value.toLocaleString()} 次浏览</div>`;
      },
    },
    grid: {
      left: 0,
      right: 48,
      bottom: 0,
      top: 0,
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      show: false,
      max: maxVal * 1.15,
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: rows.map((r) => r.title),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: p.foreground,
        fontSize: 11,
        fontWeight: 500,
      },
    },
    series: [
      {
        name: '阅读量',
        type: 'bar',
        data,
        barMaxWidth: 20,
        itemStyle: {
          color: p.series[0],
          borderRadius: [0, 4, 4, 0],
        },
        label: {
          show: true,
          position: 'right',
          color: p.mutedForeground,
          fontSize: 11,
          fontWeight: 600,
          distance: 8,
          formatter: (params: { value: number }) =>
            params.value.toLocaleString(),
        },
      },
    ],
  };
});
</script>
