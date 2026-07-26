<script setup lang="ts">
import { useScroll } from '@vueuse/core';
import { computed } from 'vue';
import { ArrowUp } from '@lucide/vue';

const { y } = useScroll(window);

// 页面滚动超过 300px 才显示回顶
const isVisible = computed(() => y.value > 300);

const scrollToTop = () => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  });
};
</script>

<template>
  <Transition
    enter-active-class="transition-[transform,opacity] transform-gpu duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-opacity"
    enter-from-class="opacity-0 translate-y-4 scale-90 motion-reduce:translate-y-0 motion-reduce:scale-100"
    enter-to-class="opacity-100 translate-y-0 scale-100"
    leave-active-class="!transition-all transform-gpu duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-opacity"
    leave-from-class="opacity-100 translate-y-0 scale-100"
    leave-to-class="opacity-0 translate-y-4 scale-90 motion-reduce:translate-y-0 motion-reduce:scale-100"
  >
    <button
      v-show="isVisible"
      @click="scrollToTop"
      class="fixed bottom-16 left-1/2 z-10 flex -translate-x-1/2 transform-gpu cursor-pointer items-center justify-center gap-1.5 overflow-hidden rounded-full bg-black px-4 py-2 font-serif text-white shadow-lg transition-transform duration-200 ease-out hover:shadow-xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.97] [@media(hover:hover)_and_(pointer:fine)]:hover:scale-105"
      aria-label="回到顶部"
    >
      Back to Top
      <ArrowUp />
    </button>
  </Transition>
</template>
