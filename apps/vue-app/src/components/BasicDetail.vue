<template>
  <div>
    <!-- Hero: warm paper-fold 翻页式开场 -->
    <section
      ref="heroRef"
      class="relative mx-0 mt-16 flex flex-col items-center justify-center sm:mt-24"
      :style="titleStyle"
      aria-labelledby="basic-detail-title"
    >
      <!-- 极淡主题色光晕，10 套主题共用语义 token -->
      <!-- <div
        aria-hidden="true"
        class="from-accent/8 via-accent/0 to-accent/0 pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b"
      ></div> -->

      <div
        class="text-ink/80 mb-3 flex items-center gap-2 text-xs tracking-[0.3em] uppercase mix-blend-multiply"
      >
        <span class="bg-accent/60 inline-block h-px w-6"></span>
        <span>kanocifer</span>
        <span class="bg-accent/60 inline-block h-px w-6"></span>
      </div>

      <h1
        id="basic-detail-title"
        class="text-ink max-w-6xl px-6 text-center font-serif font-medium tracking-tight text-balance sm:text-5xl md:text-6xl lg:text-7xl"
        :aria-label="title"
      >
        <span
          v-for="(word, i) in titleWords"
          :key="`${word}-${i}`"
          class="title-word inline-block"
          :style="wordStyle(i)"
          :aria-hidden="true"
          >{{ word }}<span v-if="i < titleWords.length - 1">&nbsp;</span></span
        >
      </h1>

      <!-- 副标题徽章 -->
      <div
        class="text-muted mt-6 flex flex-wrap items-center justify-center gap-3 text-sm"
      >
        <span
          class="bg-page text-ink inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium tracking-wide"
        >
          <span
            class="bg-accent mr-2 inline-block h-1.5 w-1.5 rounded-full"
          ></span>
          {{ subtitle }}
        </span>
      </div>

      <!-- 滚动指示器：滚出视口后淡出 -->
      <a
        href="#main-content"
        :class="[
          'scroll-indicator hover:text-ink text-ink/60 mt-12 inline-flex flex-col items-center gap-1 text-xs transition-opacity duration-500',
          indicatorVisible ? 'opacity-100' : 'pointer-events-none opacity-0',
        ]"
        @click.prevent="scrollToContent"
      >
        <span class="tracking-[0.2em] uppercase">Scroll</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 14l-7 7m0 0l-7-7m7 7V3"
          />
        </svg>
      </a>
    </section>

    <!-- 主体区域：外层只定位，背景 div 单独做 scaleX 扩张，内容不动 -->
    <section ref="contentRef" class="relative mt-12 w-full sm:mt-16">
      <!-- 背景层：scaleX 动效只作用在这一层 -->
      <div
        aria-hidden="true"
        :style="sectionStyle"
        class="bg-page/95 absolute inset-0 rounded-t-[40px]"
        style="contain: layout style"
      ></div>

      <!-- 内容层：原地不动 -->
      <div class="relative mx-auto max-w-6xl">
        <div
          id="main-content"
          ref="gridRef"
          class="staggered-grid mx-6 grid grid-cols-1 gap-6 pt-16 sm:mx-8 sm:pt-20 lg:grid-cols-3"
        >
          <slot />
        </div>
      </div>

      <div class="relative mt-12 flex justify-center pb-12 sm:pb-16">
        <Button
          :aria-label="onBack ? '返回' : '返回上一页'"
          size="lg"
          class="rounded-full!"
          @click="onBack === undefined ? $router.back() : onBack()"
        >
          <Undo2 class="h-5 w-5" /><span>返回上一页</span>
        </Button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useMediaQuery, useScroll } from '@vueuse/core';
import { computed, onMounted, ref, watch } from 'vue';
import { Button } from './ui/button';
import { Undo2 } from '@lucide/vue';

const { y } = useScroll(window);
const isSmallScreen = useMediaQuery('(max-width: 768px)');

const props = defineProps<{
  title: string;
  subtitle: string;
  onBack?: () => void;
}>();

const heroRef = ref<HTMLElement | null>(null);
const contentRef = ref<HTMLElement | null>(null);
const gridRef = ref<HTMLElement | null>(null);
const indicatorVisible = ref(true);

// 标题按词拆分（保留空白与标点）
const titleWords = computed(() => {
  return props.title
    .split(/(\s+)/)
    .filter((s) => s.length > 0 && !/^\s+$/.test(s));
});

// prefers-reduced-motion 探测
const prefersReducedMotion = ref(false);
onMounted(() => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion.value = mq.matches;
    mq.addEventListener('change', (e) => {
      prefersReducedMotion.value = e.matches;
    });
  }
});

// 视差：hero 标题轻微上移（系数 0.35，比原 0.6 收敛）
const titleStyle = computed(() => {
  if (prefersReducedMotion.value) return {};
  return { transform: `translateY(${y.value * 0.35}px)` };
});

// 主体卡片随滚动 scaleX 扩张：从 0.85 闭合到 1，小屏关闭
// 用 rAF 节流避免 Safari 每像素触发 style 重写
// 初始值必须匹配 y=0 时的 scale，避免首帧从 1 跳到 0.85 的闪烁
const rawScale = ref(Math.min(1, 0.85 + y.value * 0.0005));
const ticking = ref(false);

const updateScale = () => {
  rawScale.value = Math.min(1, 0.85 + y.value * 0.0005);
  ticking.value = false;
};

watch(y, () => {
  if (!ticking.value) {
    ticking.value = true;
    requestAnimationFrame(updateScale);
  }
});

const sectionStyle = computed(() => {
  if (prefersReducedMotion.value || isSmallScreen.value) {
    return { width: '100%' };
  }
  return {
    transform: `translateZ(0) scaleX(${rawScale.value})`,
    transformOrigin: 'top center',
    willChange: 'transform',
    width: '100%',
  };
});

// 词级 stagger：每个词延迟 60ms，最多 8 词（>8 词保护，避免标题过长时入场过慢）
const wordStyle = (i: number) => {
  if (prefersReducedMotion.value) {
    return { opacity: 1, transform: 'none' };
  }
  const delay = Math.min(i, 8) * 60;
  return {
    opacity: 0,
    transform: 'translateY(12px)',
    animation: 'title-word-in 600ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
    animationDelay: `${delay}ms`,
  };
};

// 滚动指示器：滚到内容区后淡出
const updateIndicator = () => {
  if (!contentRef.value) {
    indicatorVisible.value = true;
    return;
  }
  const rect = contentRef.value.getBoundingClientRect();
  // 主体卡片顶部进入视口上方 80px 时隐藏
  indicatorVisible.value = rect.top > 80;
};

watch(y, updateIndicator);
onMounted(() => {
  updateIndicator();
  window.addEventListener('resize', updateIndicator, { passive: true });
});

const scrollToContent = () => {
  if (!contentRef.value) return;
  const top =
    contentRef.value.getBoundingClientRect().top + window.scrollY - 16;
  window.scrollTo({
    top,
    behavior: prefersReducedMotion.value ? 'auto' : 'smooth',
  });
};
</script>

<style scoped>
@keyframes title-word-in {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .title-word {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
  .scroll-indicator {
    transition: none !important;
  }
}
</style>
