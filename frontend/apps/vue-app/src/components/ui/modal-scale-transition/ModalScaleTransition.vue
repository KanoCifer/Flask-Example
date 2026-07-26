<template>
  <transition v-bind="mergedAttrs">
    <slot />
  </transition>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue';

// 模态面板入场：opacity + scale-95 → scale-100
// 默认：300ms in / 200ms out，ease-out；含 motion-reduce 守卫。
// 调用方可通过同名 attr 覆盖任一阶段 class。

defineOptions({ name: 'ModalScaleTransition', inheritAttrs: false });

const attrs = useAttrs();

const mergedAttrs = computed(() => ({
  'enter-active-class':
    'transition-all duration-300 ease-out motion-reduce:transition-none motion-reduce:duration-0',
  'enter-from-class': 'opacity-0 scale-95',
  'enter-to-class': 'opacity-100 scale-100',
  'leave-active-class':
    'transition-all duration-200 ease-out motion-reduce:transition-none motion-reduce:duration-0',
  'leave-from-class': 'opacity-100 scale-100',
  'leave-to-class': 'opacity-0 scale-95',
  ...attrs,
}));
</script>
