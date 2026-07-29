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
import type { DevTaskType } from '@/features/todos/api';

const props = defineProps<{ type: DevTaskType }>();

// C-ring.html 1:1 配色：feature/chart-1 · bug/chart-5 · optimization/chart-2 · tech-debt/chart-4
const TYPE_MAP: Record<DevTaskType, { label: string; cls: string }> = {
  功能需求: { label: 'feature', cls: 'border-chart-1/40 bg-chart-1/10 text-chart-1' },
  问题: { label: 'bug', cls: 'border-chart-5/40 bg-chart-5/10 text-chart-5' },
  优化: { label: 'optimization', cls: 'border-chart-2/40 bg-chart-2/10 text-chart-2' },
  技术债: { label: 'tech-debt', cls: 'border-chart-4/40 bg-chart-4/10 text-chart-4' },
};

const entry = computed(() => TYPE_MAP[props.type]);
const label = computed(() => entry.value.label);
const cls = computed(() => entry.value.cls);
</script>
