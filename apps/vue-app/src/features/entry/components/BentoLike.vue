<template>
  <motion.div
    :initial="{ scale: 0 }"
    :animate="{ scale: 1 }"
    :whileHover="HOVER_SCALE_UP"
    :whilePress="{ scale: 0.9 }"
    class="bg-page/55 ring-border/30 relative cursor-pointer rounded-full ring"
    @click="playAnimation"
  >
    <span
      class="bg-accent text-ink absolute top-2 right-0 z-10 flex translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full px-1 py-0.5 text-[10px]"
      >{{ likesCount }}</span
    >
    <div ref="containerRef" class="bento-like-animation h-12 w-12"></div>
  </motion.div>
</template>

<script setup lang="ts">
import { useLikeSummary } from '@/features/blog';
import type { AnimationItem } from 'lottie-web';
import { motion } from 'motion-v';
import { HOVER_SCALE_UP } from '@/constants';
import { onMounted, onUnmounted, ref } from 'vue';

const { likesCount, like, isSubmitting } = useLikeSummary();
const containerRef = ref<HTMLElement | null>(null);
const anim = ref<AnimationItem | null>(null);

onMounted(async () => {
  // 动态导入lottie-web，实现代码拆分
  const lottie = await import('lottie-web');
  const animationData = await import('@/assets/Success Micro Interaction.json');
  anim.value = lottie.default.loadAnimation({
    container: containerRef.value as Element,
    renderer: 'svg',
    loop: false,
    autoplay: false,
    animationData: animationData.default,
  });

  anim.value.goToAndStop(anim.value.totalFrames - 1, true);

  anim.value.addEventListener('complete', () => {
    if (anim.value) {
      anim.value.goToAndStop(anim.value.totalFrames - 1, true);
    }
  });
});

const playAnimation = async () => {
  if (isSubmitting.value || !anim.value) return;

  anim.value.goToAndStop(0, true);
  anim.value.play();

  await like();
};

onUnmounted(() => {
  if (anim.value) {
    anim.value.destroy();
  }
});
</script>
