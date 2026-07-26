<script setup lang="ts">
import { useBackgroundStore } from '@/stores';
import { useThemeStore } from '@/stores';

defineProps<{ isEntryView: boolean }>();

const bgStore = useBackgroundStore();
const themeStore = useThemeStore();
</script>

<template>
  <div
    class="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    aria-hidden="true"
  >
    <div
      :style="{
        ...bgStore.backgroundStyle,
        transform: `scale(${themeStore.bgScale})`,
        animationPlayState: isEntryView ? 'running' : 'paused',
      }"
      class="hero-gradient absolute inset-0 h-full w-full transform-gpu"
    />

    <!-- 模糊 + 亮度蒙版层：用 backdrop-filter 作用在下方 img 上，避免 filter 在 img 自身上翻倍占用 GPU 纹理 -->
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
