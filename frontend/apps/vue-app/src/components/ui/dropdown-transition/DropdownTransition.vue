<template>
  <transition v-bind="mergedAttrs">
    <slot />
  </transition>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue';

// Dropdown 入退场：从触发器方向滑入 + 缩放 + 淡入。
// - 默认 `down`：scale 锚点在右上（origin-top-right），与所有 caller 的 `top-full right-0` 布局对齐
// - `up`：锚点在右上，向上滑入，给将来的"从下方弹出"留位
// 200ms in / 150ms out，ease-smooth-out；含 motion-reduce 守卫。
// 调用方可通过同名 attr 覆盖任一阶段 class。

defineOptions({ name: 'DropdownTransition', inheritAttrs: false });

const { direction = 'down' } = defineProps<{
  direction?: 'down' | 'up';
}>();

const attrs = useAttrs();

const enterFrom = computed(() =>
  direction === 'down'
    ? 'opacity-0 translate-y-1 scale-95 origin-top-right blur-[3px]'
    : 'opacity-0 -translate-y-1 scale-95 origin-bottom-right blur-[3px]',
);
const leaveTo = computed(() =>
  direction === 'down'
    ? 'opacity-0 translate-y-1 scale-95 origin-top-right blur-[3px]'
    : 'opacity-0 -translate-y-1 scale-95 origin-bottom-right blur-[3px]',
);

const mergedAttrs = computed(() => ({
  'enter-active-class':
    'transition-[opacity,translate,scale,filter] duration-200 transform-gpu ease-[var(--ease-smooth-out)] motion-reduce:transition-none motion-reduce:duration-0',
  'enter-from-class': enterFrom.value,
  'enter-to-class': 'opacity-100 translate-y-0 scale-100 blur-0',
  'leave-active-class':
    'transition-[opacity,translate,scale,filter] duration-150 transform-gpu ease-[var(--ease-smooth-out)] motion-reduce:transition-none motion-reduce:duration-0',
  'leave-from-class': 'opacity-100 translate-y-0 scale-100 blur-0',
  'leave-to-class': leaveTo.value,
  ...attrs,
}));
</script>
