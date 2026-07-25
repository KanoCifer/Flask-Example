<template>
  <transition v-bind="mergedAttrs" mode="out-in">
    <slot />
  </transition>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue';

// 默认:200ms in / 100ms out,ease-out,纯 opacity 渐变;含 motion-reduce 守卫。
// 用途:Analytics 仪表盘里骨架(animate-pulse) → 真实图表/列表/统计的瞬切改为淡入淡出。
// 仅适用于"等占位的条件分支组"(loading / empty / data 三态),不适用于位置/尺寸过渡。
// 调用方可通过同名 attr(如 :enter-from-class)覆盖任一阶段 class。

defineOptions({
  name: 'SkeletonCrossfadeTransition',
  inheritAttrs: false,
});

const attrs = useAttrs();

const mergedAttrs = computed(() => ({
  'enter-active-class':
    'transition-opacity duration-200 ease-out motion-reduce:transition-none motion-reduce:duration-0',
  'enter-from-class': 'opacity-0',
  'enter-to-class': 'opacity-100',
  'leave-active-class':
    'transition-opacity duration-100 ease-out motion-reduce:transition-none motion-reduce:duration-0',
  'leave-from-class': 'opacity-100',
  'leave-to-class': 'opacity-0',
  ...attrs,
}));
</script>
