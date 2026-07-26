<script setup lang="ts">
/**
 * 钓鱼野趣 · 环境层
 *
 * 页面底噪层:数尾极淡的鱼影自水中缓缓游过,像纸背下的池水。
 * - 纯装饰,`aria-hidden` + `pointer-events-none`,不参与布局与交互
 * - 颜色走 --muted-text (oklch),不硬编码;透明度压到 6~10% —— 若隐若现
 * - prefers-reduced-motion 下整层隐藏,不做任何漂移
 *
 * 鱼形为极简剪影(杏仁身 + 三角尾 + 眼点),作为「母题」而非写实插画。
 */
</script>

<template>
  <div class="fishing-ambient" aria-hidden="true">
    <svg
      v-for="fish in 3"
      :key="fish"
      class="fishing-ambient__fish"
      :class="`fishing-ambient__fish--${fish}`"
      viewBox="0 0 64 32"
      fill="currentColor"
    >
      <path d="M4 16C14 5 34 5 44 16C34 27 14 27 4 16Z" opacity="0.9" />
      <path d="M44 16L62 7L56 16L62 25Z" />
      <circle cx="16" cy="14" r="1.6" fill="var(--page)" />
    </svg>
  </div>
</template>

<style scoped>
.fishing-ambient {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
  color: var(--muted-text);
}

.fishing-ambient__fish {
  position: absolute;
  width: 72px;
  height: 36px;
  opacity: 0;
  will-change: transform;
}

/* 三尾鱼:不同泳道 / 尺度 / 速度 / 深浅,避免机械同步 */
.fishing-ambient__fish--1 {
  top: 18%;
  transform: scale(1.15);
}
.fishing-ambient__fish--2 {
  top: 52%;
  transform: scale(0.8);
}
.fishing-ambient__fish--3 {
  top: 74%;
  transform: scale(1);
}

@media (prefers-reduced-motion: no-preference) {
  .fishing-ambient__fish--1 {
    animation: fish-swim-rtl 46s linear infinite;
  }
  .fishing-ambient__fish--2 {
    animation: fish-swim-ltr 62s linear infinite;
    animation-delay: -18s;
  }
  .fishing-ambient__fish--3 {
    animation: fish-swim-rtl 54s linear infinite;
    animation-delay: -34s;
  }
}

/* 右→左:鱼头朝左,scaleX(-1);左→右:鱼头朝右。透明度中段浮现,两端隐没 */
@keyframes fish-swim-rtl {
  0% {
    opacity: 0;
    transform: translateX(8vw) scaleX(-1) scale(1);
  }
  12%,
  88% {
    opacity: 0.08;
  }
  100% {
    opacity: 0;
    transform: translateX(-100vw) scaleX(-1) scale(1);
  }
}
@keyframes fish-swim-ltr {
  0% {
    opacity: 0;
    transform: translateX(-80vw) scale(0.8);
  }
  12%,
  88% {
    opacity: 0.07;
  }
  100% {
    opacity: 0;
    transform: translateX(100vw) scale(0.8);
  }
}
</style>
