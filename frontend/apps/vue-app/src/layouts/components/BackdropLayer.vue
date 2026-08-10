<script setup lang="ts">
/*
 * 背景层 —— 渲染 .scheme-bg 容器（其内部渐变由
 * styles/backgrounds.css 中的 [data-color-scheme] 选择器驱动，
 * 跟随 themeStore.scheme 切换）。
 *
 * scale / blur / brightness 三个调整仍生效：
 *   · scale 直接作用于 .scheme-bg 容器
 *   · blur + brightness 通过额外的 backdrop-filter 蒙版层实现
 */
import { useThemeStore } from '@/stores';

defineProps<{ isEntryView: boolean }>();

const themeStore = useThemeStore();
</script>

<template>
  <div
    class="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    aria-hidden="true"
  >
    <div
      :style="{
        transform: `scale(${themeStore.bgScale})`,
        animationPlayState: isEntryView ? 'running' : 'paused',
      }"
      class="scheme-bg transform-gpu"
    />

    <!-- 模糊 + 亮度蒙版层：用 backdrop-filter 作用在下方渐变上，避免 filter 在同一节点上翻倍占用 GPU 纹理 -->
    <div
      v-if="themeStore.bgBlur > 0 || themeStore.bgBrightness !== 1"
      class="pointer-events-none absolute inset-0"
      :style="{
        backdropFilter: `blur(${themeStore.bgBlur}px) brightness(${themeStore.bgBrightness})`,
        WebkitBackdropFilter: `blur(${themeStore.bgBlur}px) brightness(${themeStore.bgBrightness})`,
      }"
    />
  </div>
</template>
