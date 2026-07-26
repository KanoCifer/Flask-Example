<script setup lang="ts">
import { defineComponent, h, type PropType } from 'vue';
import VChart from 'vue-echarts';
import type { StatusDetailData } from '@/features/status/types';

type Tone = 'success' | 'warning' | 'destructive';

const TONE_DOT: Record<Tone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
};

defineProps({
  serverStatus: {
    type: Object as PropType<StatusDetailData | null>,
    required: true,
  },
  chartOption: {
    type: Object as PropType<Record<string, unknown>>,
    required: true,
  },
  latencyHistory: {
    type: Array as PropType<number[]>,
    required: true,
  },
});

function bytesToMB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function percent(value: number, total: number): number {
  if (!total) return 0;
  return Math.min(100, Math.max(0, (value / total) * 100));
}

function resourceTone(pct: number): Tone {
  if (pct >= 85) return 'destructive';
  if (pct >= 65) return 'warning';
  return 'success';
}

const ResourceBar = defineComponent({
  name: 'ResourceBar',
  props: {
    label: { type: String, required: true },
    value: { type: Number, required: true },
    tone: { type: String as PropType<Tone>, required: true },
    unit: { type: String, default: '%' },
    decimals: { type: Number, default: 1 },
    cap: { type: Number, default: 100 },
    rightDetail: { type: String, default: '' },
  },
  setup(props) {
    return () => {
      const barWidth = Math.min(
        100,
        Math.max(0, (props.value / props.cap) * 100),
      );
      return h('div', { class: 'space-y-1.5' }, [
        h(
          'div',
          {
            class: 'flex items-baseline justify-between gap-3 text-[13px]',
          },
          [
            h('span', { class: 'text-ink/85' }, props.label),
            h(
              'span',
              { class: 'text-ink font-mono tabular-nums' },
              props.rightDetail ||
                `${props.value.toFixed(props.decimals)}${props.unit}`,
            ),
          ],
        ),
        h(
          'div',
          { class: 'bg-surface relative h-1 overflow-hidden rounded-full' },
          [
            h('div', {
              class: `absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out ${TONE_DOT[props.tone]}`,
              style: { width: `${barWidth}%` },
            }),
          ],
        ),
      ]);
    };
  },
});
</script>

<template>
  <div class="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
    <!-- 资源 -->
    <section class="space-y-5" aria-label="系统资源">
      <header class="flex items-baseline justify-between">
        <h2 class="text-ink font-serif text-[20px] tracking-[-0.01em]">
          系统资源
        </h2>
        <span v-if="serverStatus" class="text-muted text-[12px] tabular-nums">
          {{ serverStatus.system.os_name }}
        </span>
      </header>

      <div v-if="serverStatus" class="space-y-4">
        <ResourceBar
          label="CPU 使用率"
          :value="serverStatus.system.cpu_percent"
          :tone="resourceTone(serverStatus.system.cpu_percent)"
          :decimals="1"
        />
        <ResourceBar
          label="内存使用率"
          :value="serverStatus.system.memory_usage_percent"
          :tone="resourceTone(serverStatus.system.memory_usage_percent)"
          :decimals="1"
        />
        <ResourceBar
          label="负载 (1m)"
          :value="serverStatus.system.load_average['1m']"
          :tone="
            resourceTone(percent(serverStatus.system.load_average['1m'], 4))
          "
          unit=""
          :decimals="2"
          :cap="4"
        />
        <ResourceBar
          label="堆 / 总占用"
          :value="
            percent(
              serverStatus.service.heap_memory_bytes,
              serverStatus.service.total_memory_bytes,
            )
          "
          :tone="
            resourceTone(
              percent(
                serverStatus.service.heap_memory_bytes,
                serverStatus.service.total_memory_bytes,
              ),
            )
          "
          :decimals="1"
          :right-detail="`${bytesToMB(serverStatus.service.heap_memory_bytes)} / ${bytesToMB(serverStatus.service.total_memory_bytes)}`"
        />
      </div>
      <div v-else class="space-y-4">
        <div class="bg-surface h-3 w-full animate-pulse rounded" />
        <div class="bg-surface h-3 w-2/3 animate-pulse rounded" />
        <div class="bg-surface h-3 w-1/2 animate-pulse rounded" />
      </div>
    </section>

    <!-- 延迟图 -->
    <section class="space-y-5" aria-label="API 延迟趋势">
      <header class="flex items-baseline justify-between">
        <h2 class="text-ink font-serif text-[20px] tracking-[-0.01em]">
          API 延迟趋势
        </h2>
        <span class="text-muted text-[12px] tabular-nums">
          最近 60s · 毫秒
        </span>
      </header>
      <div class="h-[220px]">
        <v-chart
          v-if="latencyHistory.length > 1"
          :option="chartOption"
          autoresize
        />
        <div
          v-else
          class="text-muted flex h-full items-center justify-center text-[13px]"
        >
          等待数据…
        </div>
      </div>
    </section>
  </div>
</template>
