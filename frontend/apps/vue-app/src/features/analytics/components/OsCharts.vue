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

<script setup lang="ts">
import { IconAnalytics, SkeletonCrossfadeTransition } from '@/components';
import { useChartColors } from '@/composables';
import { computed } from 'vue';
import VChart from 'vue-echarts';

const MAX_SLICES = 5;

interface OsStat {
  os_name: string;
  count: number;
}

interface Props {
  loading: boolean;
  osStats: OsStat[] | null;
}

const props = defineProps<Props>();

const { palette } = useChartColors();

const hasOsData = computed(() => (props.osStats ?? []).length > 0);

const total = computed(() =>
  (props.osStats ?? []).reduce((s, it) => s + it.count, 0),
);

/** Head of the distribution + an "Other" tail if > MAX_SLICES buckets. */
const chartRows = computed<Array<OsStat & { pct: number }>>(() => {
  const raw = [...(props.osStats ?? [])].sort((a, b) => b.count - a.count);
  const t = total.value || 1;
  if (raw.length <= MAX_SLICES) {
    return raw.map((r) => ({ ...r, pct: (r.count / t) * 100 }));
  }
  const head = raw.slice(0, MAX_SLICES - 1);
  const othersCount = raw
    .slice(MAX_SLICES - 1)
    .reduce((s, it) => s + it.count, 0);
  return [
    ...head.map((r) => ({ ...r, pct: (r.count / t) * 100 })),
    { os_name: '其他', count: othersCount, pct: (othersCount / t) * 100 },
  ];
});

const osChartOption = computed(() => {
  const p = palette.value;
  const rows = chartRows.value;
  // Render largest-at-top: invert the descending sort.
  const display = [...rows].reverse();

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
        const row = display.find((r) => r.os_name === it.name);
        const pct = row ? row.pct.toFixed(1) : '0';
        return `<div style="font-weight:600;color:${p.foreground};">${it.name}</div><div style="color:${p.mutedForeground};margin-top:2px;">${it.value.toLocaleString()} (${pct}%)</div>`;
      },
    },
    grid: {
      left: 0,
      right: 56,
      bottom: 0,
      top: 0,
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      show: false,
      max: Math.max(...rows.map((r) => r.count), 1) * 1.2,
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: display.map((r) => r.os_name),
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
        name: 'OS',
        type: 'bar',
        data: display.map((r, i) => ({
          value: r.count,
          itemStyle: {
            color: p.series[i % p.series.length],
            borderRadius: [0, 4, 4, 0],
          },
        })),
        barMaxWidth: 20,
        label: {
          show: true,
          position: 'right',
          color: p.mutedForeground,
          fontSize: 10,
          fontWeight: 600,
          distance: 8,
          formatter: (params: { dataIndex: number }) => {
            const row = display[params.dataIndex];
            if (!row) return '';
            return `${row.pct.toFixed(1)}%`;
          },
        },
      },
    ],
  };
});
</script>
