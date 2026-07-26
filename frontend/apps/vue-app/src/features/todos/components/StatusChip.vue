<template>
  <span
    class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium"
    :class="cls"
  >
    <span class="h-1.5 w-1.5 rounded-full" :class="dotCls" />
    {{ status }}
  </span>
</template>

<script setup lang="ts">
import type { DevTaskStatus } from '@/features/todos/api';

const props = defineProps<{ status: DevTaskStatus }>();

const STATUS_CLASS: Record<DevTaskStatus, string> = {
  待评估: ' text-muted',
  待排期: 'border-chart-3/40 bg-chart-3/10 text-chart-3',
  进行中: 'border-accent/40 bg-accent/10 text-ink',
  已搁置:
    'border-amber-300/50 bg-amber-50/60 text-amber-700 dark:border-amber-700/50 dark:bg-amber-950/20 dark:text-amber-400',
  已完成:
    'border-emerald-300/50 bg-emerald-50/60 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-950/20 dark:text-emerald-400',
};

const STATUS_DOT: Record<DevTaskStatus, string> = {
  待评估: 'bg-surface',
  待排期: 'bg-chart-3',
  进行中: 'bg-accent',
  已搁置: 'bg-amber-500',
  已完成: 'bg-emerald-500',
};

const cls = STATUS_CLASS[props.status] ?? ' text-muted';
const dotCls = STATUS_DOT[props.status] ?? 'bg-surface';
</script>
