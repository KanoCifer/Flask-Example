<script setup lang="ts">
import { motion } from 'motion-v';
import { EASE } from '@/constants';

interface Props {
  tone?: 'default' | 'hero';
  interactive?: boolean;
  padding?: 'default' | 'tight' | 'none';
  as?: 'article' | 'section' | 'div';
}

const props = withDefaults(defineProps<Props>(), {
  tone: 'default',
  interactive: false,
  padding: 'default',
  as: 'article',
});

/**
 * motion-v 不支持动态 :is,把 as 映射到具体 motion 组件
 * (article / section / div 三种,够用)
 */
const motionMap = {
  article: motion.article,
  section: motion.section,
  div: motion.div,
} as const;
</script>

<template>
  <component
    :is="motionMap[as]"
    :transition="EASE"
    class="group fishing-card bg-card relative flex h-full flex-col overflow-hidden rounded-3xl border shadow-sm"
    :class="[
      tone === 'hero' && 'shadow-md',
      interactive && 'fishing-card--interactive cursor-pointer',
      padding === 'default' && 'p-6',
      padding === 'tight' && 'p-4',
    ]"
  >
    <!-- Hero 专属装饰:渐变描边 (mask 技巧) + 斜向扫光 -->
    <template v-if="tone === 'hero'">
      <span class="hero-glow" aria-hidden="true" />
      <span class="hero-sweep" aria-hidden="true" />
    </template>
    <slot />
  </component>
</template>

<style scoped>
/*
 * 卡片基础 transition —— 仅 border-color 由 CSS 控制 (motion-v 接管 transform/shadow)
 */
.fishing-card {
  transition: border-color 240ms ease;
  will-change: transform;
}

.hero-glow {
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(
    135deg,
    transparent 0%,
    transparent 40%,
    oklch(from var(--color-accent) l c h / 0.55) 100%
  );
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  opacity: 0;
  transition: opacity 360ms ease;
  pointer-events: none;
  z-index: 0;
}
.fishing-card--hero:hover .hero-glow {
  opacity: 1;
}

.hero-sweep {
  position: absolute;
  top: 0;
  left: -40%;
  width: 32%;
  height: 100%;
  background: linear-gradient(
    100deg,
    transparent,
    oklch(from var(--color-accent) l c h / 0.18),
    transparent
  );
  opacity: 0;
  transition:
    left 720ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 320ms ease;
  pointer-events: none;
  z-index: 0;
}
.fishing-card--hero:hover .hero-sweep {
  left: 110%;
  opacity: 1;
}

/* reduced motion: 关闭扫光;motion-v 自带 whileHover 也会因 prefers-reduced-motion 自动降级 */
@media (prefers-reduced-motion: reduce) {
  .hero-sweep {
    display: none;
  }
}
</style>
