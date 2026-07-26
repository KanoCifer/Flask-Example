<template>
  <span
    class="rounded-full border px-1.5 py-px text-[10px] font-medium"
    :class="cls"
  >
    {{ props.kind === 'subtask' ? 'subtask' : 'spec' }}
  </span>
</template>

<script setup lang="ts">
import type { DevTaskKind } from '@/features/todos/api';

const props = defineProps<{ kind?: DevTaskKind | '' | null }>();

// spec 用中性色（默认，弱化）；subtask 用 primary 强调它是可执行单元
const KIND_CLASS: Record<DevTaskKind, string> = {
  spec: ' text-muted bg-warning/20',
  subtask: 'border-accent/30 bg-accent/5 text-ink',
};

// console.log('props.kind', props.kind);

const cls = KIND_CLASS[props.kind === 'subtask' ? 'subtask' : 'spec'];
</script>
