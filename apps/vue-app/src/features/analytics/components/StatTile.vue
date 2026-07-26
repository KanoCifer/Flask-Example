<template>
  <div class="bg-card flex flex-col gap-2 rounded-2xl border p-4">
    <div class="flex items-center justify-between">
      <span
        class="text-muted font-mono text-[10px] font-medium tracking-[0.18em] uppercase"
        >{{ label }}</span
      >
      <div
        class="flex h-7 w-7 items-center justify-center rounded-md"
        :class="accent"
      >
        <slot name="icon" />
      </div>
    </div>
    <span
      class="text-ink block text-2xl leading-tight font-medium tabular-nums"
    >
      {{ formattedValue }}
    </span>
    <div v-if="$slots.footer" class="text-xs">
      <slot name="footer" />
    </div>
    <!-- Optional sparkline: a 14-point mini trend rendered as pure SVG. -->
    <svg
      v-if="hasSparkline"
      :viewBox="`0 0 ${sparkWidth} ${sparkHeight}`"
      class="mt-auto h-6 w-full"
      :class="sparklineClass"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
        :points="sparkpolyline"
      />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  label: string;
  value: number | string;
  accent: string;
  valueSuffix?: string;
  /** Numeric trend series (asc order). Empty = no sparkline. */
  sparkline?: number[];
  /** Tailwind text-* class whose currentColor becomes the sparkline stroke. */
  sparklineClass?: string;
}>();

const sparkWidth = 120;
const sparkHeight = 24;

const formattedValue = computed(() => {
  const v = props.value;
  if (typeof v === 'number') {
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
    if (v >= 1_000) return (v / 1_000).toFixed(1) + 'K';
    return v.toLocaleString();
  }
  return v;
});

const hasSparkline = computed(() => (props.sparkline?.length ?? 0) >= 2);

/** Map the points viewBox-polyline coordinates. */
const sparkpolyline = computed(() => {
  const data = props.sparkline ?? [];
  if (data.length < 2) return '';
  const max = Math.max(...data, 1);
  const stepX = sparkWidth / (data.length - 1);
  return data
    .map((d, i) => {
      const x = i * stepX;
      const y = sparkHeight - (d / max) * (sparkHeight - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
});
</script>
