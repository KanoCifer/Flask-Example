<template>
  <span
    class="rounded-full border px-1.5 py-px text-[10px] font-medium"
    :class="cls"
  >
    {{ type }}
  </span>
</template>

<script setup lang="ts">
import type { DevTaskType } from '@/features/todos/api';

const props = defineProps<{ type: DevTaskType }>();

// 类型色路由到 chart token，与 ReviewPanel 的类型分布条保持同一映射。
// chart 系列在所有 4 个主题下都定义过 light/dark，无需硬编码。
const TYPE_CLASS: Record<DevTaskType, string> = {
  功能需求: 'border-chart-1/40 bg-chart-1/10 text-chart-1',
  问题: 'border-chart-4/40 bg-chart-4/10 text-chart-4',
  优化: 'border-chart-5/40 bg-chart-5/10 text-chart-5',
  技术债: 'border-chart-2/40 bg-chart-2/10 text-chart-2',
};

const cls = TYPE_CLASS[props.type] ?? ' text-muted';
</script>
