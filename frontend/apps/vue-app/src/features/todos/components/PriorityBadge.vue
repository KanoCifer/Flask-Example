<template>
  <span
    :class="[
      'inline-flex h-5 items-center rounded-full border px-2 text-xs font-medium tracking-[0.01em] whitespace-nowrap',
      cls,
    ]"
  >
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { DevTaskPriority } from '@/features/todos/api';

const props = defineProps<{ priority: DevTaskPriority }>();

// C-ring.html 1:1 配色：P0/destructive · P1/warning-15 · P2/chart-2 · P3/中性（border-border bg-surface text-muted）
const PRIORITY_MAP: Record<DevTaskPriority, { label: string; cls: string }> = {
  'P0 紧急': { label: 'P0', cls: 'border-destructive/40 bg-destructive/10 text-destructive' },
  'P1 高': { label: 'P1', cls: 'border-warning/40 bg-warning/15 text-warning' },
  'P2 中': { label: 'P2', cls: 'border-chart-2/40 bg-chart-2/10 text-chart-2' },
  'P3 低': { label: 'P3', cls: 'border-border bg-surface text-muted' },
};

const entry = computed(() => PRIORITY_MAP[props.priority]);
const label = computed(() => entry.value.label);
const cls = computed(() => entry.value.cls);
</script>
