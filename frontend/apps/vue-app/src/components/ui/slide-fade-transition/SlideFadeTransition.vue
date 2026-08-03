<template>
  <transition v-bind="mergedAttrs" mode="out-in">
    <slot />
  </transition>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue';

// 垂直方向 slide+fade：opacity + translate-y-1。
// 默认：200ms in / 150ms out，ease-out；含 motion-reduce 守卫。
// 调用方可通过同名 attr 覆盖任一阶段 class。
//
// 之前 4 个 tab 都用 `transition-[...,filter] + blur-[4px]`：blur 把整个面板
// 子树（成百张含 <img> + drop-shadow 滤镜的卡片）每帧重新栅格化，是「切
// tab 很卡」的根因。这里只保留 opacity + translate（GPU 合成层属性，不触发
// paint），需要 hover-reveal 类效果请用子组件自己的 transition，不要叠到这里。

defineOptions({ name: 'SlideFadeTransition', inheritAttrs: false });

const attrs = useAttrs();

const mergedAttrs = computed(() => ({
  'enter-active-class':
    'transition-[opacity,translate] duration-200 transform-gpu ease-out motion-reduce:transition-none motion-reduce:duration-0',
  'enter-from-class': 'opacity-0 translate-y-1',
  'enter-to-class': 'opacity-100 translate-y-0',
  'leave-active-class':
    'transition-[opacity,translate] duration-150 transform-gpu ease-out motion-reduce:transition-none motion-reduce:duration-0',
  'leave-from-class': 'opacity-100 translate-y-0',
  'leave-to-class': 'opacity-0 -translate-y-1',
  ...attrs,
}));
</script>
