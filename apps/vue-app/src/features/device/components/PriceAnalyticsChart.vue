<template>
  <Teleport to="body">
    <ModalFadeTransition>
      <div
        v-if="isOpen"
        class="fixed inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        @click="onClose"
      >
        <div
          class="bg-page fixed top-1/2 left-1/2 z-50 h-[60vh] w-[90vw] max-w-md min-w-0 -translate-x-1/2 -translate-y-1/2 rounded-2xl p-4"
          @click.stop
        >
          <v-chart :option="chartOption" autoresize class="h-full w-full" />
        </div>
      </div>
    </ModalFadeTransition>
  </Teleport>
</template>

<script setup lang="ts">
import { useChartColors } from '@/composables';
import type { Device } from '@/features/device/types';
import { computed } from 'vue';
import VChart from 'vue-echarts';
import { ModalFadeTransition } from '@/components';

const props = defineProps<{
  data: Device[];
  isOpen: boolean;
  onClose: () => void;
}>();

const { palette } = useChartColors();

const chartOption = computed(() => {
  const p = palette.value;
  return {
    title: {
      text: 'Device Price Distribution',
      left: 0,
      top: 15,
      textStyle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: p.foreground,
      },
    },
    tooltip: {
      trigger: 'item',
    },
    legend: {
      top: 'bottom',
    },
    toolbox: {
      show: true,
      feature: {
        mark: { show: true },
        dataView: { show: true, readOnly: true },
        restore: { show: true },
        saveAsImage: { show: true },
      },
    },
    itemStyle: {
      borderRadius: 8,
    },
    series: [
      {
        color: p.series,
        type: 'pie',
        data: props.data.map((device) => ({
          name: device.name,
          value: device.price,
        })),
        roseType: 'area',
        colorBy: 'data',
        legendHoverLink: true,
      },
    ],
  };
});
</script>
