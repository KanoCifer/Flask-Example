<template>
  <span
    class="rounded-full border px-1.5 py-px text-[10px] font-medium"
    :class="cls"
  >
    {{ priority }}
  </span>
</template>

<script setup lang="ts">
import type { DevTaskPriority } from '@/features/todos/api';

const props = defineProps<{ priority: DevTaskPriority }>();

// P0 是页面唯一的 destructive 强调位；P1 走 warning；P2/P3 走中性色阶。
// 不引入新颜色，遵守 One-Voice Rule：accent 只留给最重要的一处。
const PRIORITY_CLASS: Record<DevTaskPriority, string> = {
  'P0 紧急': 'border-destructive/40 bg-destructive/10 text-destructive',
  'P1 高': 'border-warning/40 bg-warning/10 text-warning',
  'P2 中': ' text-muted',
  'P3 低': ' text-muted/70',
};

const cls = PRIORITY_CLASS[props.priority] ?? ' text-muted';
</script>
