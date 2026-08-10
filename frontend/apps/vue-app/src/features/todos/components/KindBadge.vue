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
import type { DevTaskKind } from '@/features/todos/api';

const props = defineProps<{ kind?: DevTaskKind | '' | null }>();

// C-ring.html 1:1 配色：spec/chart-3 · subtask/chart-2
const KIND_MAP: Record<DevTaskKind, { label: string; cls: string }> = {
  spec: { label: 'spec', cls: 'border-chart-3/40 bg-chart-3/10 text-chart-3' },
  subtask: {
    label: 'subtask',
    cls: 'border-chart-2/40 bg-chart-2/10 text-chart-2',
  },
};

const entry = computed(
  () => KIND_MAP[props.kind === 'subtask' ? 'subtask' : 'spec'],
);
const label = computed(() => entry.value.label);
const cls = computed(() => entry.value.cls);
</script>
