<template>
  <Teleport to="body">
    <ModalFadeTransition>
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        @click="onClose"
      >
        <div
          class="bg-page fixed top-1/2 left-1/2 z-60 h-[60vh] w-[90vw] max-w-md min-w-0 -translate-x-1/2 -translate-y-1/2 rounded-2xl p-4"
          @click.stop
        >
          <button
            class="bg-destructive text-destructive-muted hover:bg-destructive/90 absolute top-4 right-4 z-50 rounded-full px-1.5 py-1.5"
            @click="onClose"
          >
            <svg
              class="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <v-chart :option="chartOption" autoresize class="h-full w-full" />
        </div>
      </div>
    </ModalFadeTransition>
  </Teleport>
</template>

<script setup lang="ts">
import { useChartColors, withAlpha } from '@/composables';
import type { Device } from '@/features/device/types';
import dayjs from 'dayjs';
import { computed } from 'vue';
import VChart from 'vue-echarts';
import { ModalFadeTransition } from '@/components';

const props = defineProps<{
  data: Device;
  isOpen: boolean;
  onClose: () => void;
}>();

const { palette } = useChartColors();

const chartOption = computed(() => {
  const p = palette.value;
  const purchaseDate = dayjs(props.data.purchase_date);
  const now = dayjs();

  const usedDays = now.diff(purchaseDate, 'day');
  const currentDailyCost =
    usedDays > 0 ? props.data.price / usedDays : props.data.price;

  const predictDays = 180;
  const currentTimeIndex = usedDays;

  const xAxisData: string[] = [];
  const seriesData: number[] = [];
  for (let i = 0; i <= usedDays + predictDays; i++) {
    const date = purchaseDate.add(i, 'day');
    xAxisData.push(date.format('YYYY-MM-DD'));
    const dailyCost = i > 0 ? props.data.price / i : props.data.price;
    seriesData.push(dailyCost);
  }

  return {
    backgroundColor: 'transparent',
    title: {
      text: `Daily Cost Trend: ${props.data.name}`,
      subtext: `Current: ¥${currentDailyCost.toFixed(2)}/day | Total: ¥${props.data.price}`,
      left: 0,
      top: 8,
      textStyle: { fontSize: 16, fontWeight: 'bold', color: p.foreground },
      subtextStyle: { fontSize: 12, color: p.mutedForeground },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: p.card,
      textStyle: { color: p.foreground },
      formatter: (params: { name: string; value: number }[]) => {
        const param = params[0];
        return `${param.name}<br/>Daily Cost: <b>¥${param.value.toFixed(2)}</b>`;
      },
    },
    grid: {
      top: '22%',
      containLabel: false,
    },
    xAxis: {
      type: 'category',
      data: xAxisData,
      axisLine: { lineStyle: { color: p.border } },
      axisLabel: {
        color: p.mutedForeground,
        fontSize: 10,
        interval: 30,
        rotate: 45,
      },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'log',
      name: '¥/day',
      max: Math.ceil(props.data.price * 1.1),
      nameTextStyle: { color: p.foreground, fontSize: 11 },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: p.border, opacity: 0.5 } },
      axisLabel: { color: p.mutedForeground },
    },
    series: [
      {
        type: 'line',
        smooth: true,
        data: seriesData,
        lineStyle: { color: p.series[0], width: 2 },
        itemStyle: { color: p.series[0] },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: withAlpha(p.series[0], 0.35) },
              { offset: 1, color: withAlpha(p.series[0], 0.02) },
            ],
          },
        },
        markLine:
          currentTimeIndex > 0
            ? {
                symbol: ['none', 'none'],
                lineStyle: {
                  color: p.warning,
                  type: 'dashed',
                  width: 1.5,
                },
                label: {
                  show: true,
                  formatter: '现在',
                  color: p.warning,
                  fontWeight: '600',
                  fontSize: 12,
                },
                data: [{ xAxis: currentTimeIndex }],
              }
            : undefined,
      },
    ],
  };
});
</script>
