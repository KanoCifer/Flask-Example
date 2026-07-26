<template>
  <div
    class="flex flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8"
  >
    <div
      class="bg-page/70 mx-auto max-w-md rounded-4xl p-8 text-center backdrop-blur-sm"
    >
      <!-- 404 数字动画 + fox 吉祥物 -->
      <div class="relative mx-auto flex items-center justify-center gap-3">
        <div class="relative h-32 w-32">
          <div
            class="bg-accent/15 absolute inset-0 animate-pulse rounded-full"
          ></div>
          <div class="relative flex h-full items-center justify-center">
            <span class="text-ink text-6xl font-extrabold tracking-tight"
              >404</span
            >
          </div>
        </div>
        <img
          src="/images/animal-badge/fox.png"
          alt="Fox mascot"
          class="size-24 -translate-y-2 drop-shadow-md transition-transform duration-500 hover:scale-105 hover:-rotate-6"
          loading="lazy"
        />
      </div>

      <!-- 标题 -->
      <h1 class="text-ink mt-8 font-serif text-3xl font-bold sm:text-4xl">
        页面未找到
      </h1>

      <!-- 描述 -->
      <p class="text-muted mt-4 text-lg">
        抱歉，您访问的页面不存在或已被移动。
      </p>

      <!-- 可能的原因 -->
      <div class="text-muted mt-6 space-y-2 text-sm">
        <p>• 网址可能拼写错误</p>
        <p>• 页面可能已被删除</p>
        <p>• 链接可能已过期</p>
      </div>

      <!-- 导航按钮 -->
      <div class="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <RouterLink
          to="/"
          class="bg-accent text-contrast hover:bg-accent/90 focus:ring-ring inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-medium transition-all hover:shadow-lg focus:ring-2 focus:ring-offset-2 focus:outline-none"
        >
          <svg
            class="mr-2 h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            ></path>
          </svg>
          返回首页
        </RouterLink>

        <button
          type="button"
          class="bg-page text-ink ring-border hover:bg-surface focus:ring-ring inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-medium ring-1 transition-all ring-inset focus:ring-2 focus:outline-none"
          @click="goBack"
        >
          <svg
            class="mr-2 h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 19l-7-7 7-7"
            ></path>
          </svg>
          上一页
        </button>
      </div>
    </div>

    <!-- 装饰元素 -->
    <div class="text-muted mt-16 flex gap-2">
      <div class="h-1 w-1 animate-bounce rounded-full bg-current"></div>
      <div
        class="h-1 w-1 animate-bounce rounded-full bg-current"
        style="animation-delay: 0.1s"
      ></div>
      <div
        class="h-1 w-1 animate-bounce rounded-full bg-current"
        style="animation-delay: 0.2s"
      ></div>
    </div>
    <div class="mt-8">
      <Vue3Lottie
        :width="320"
        :height="320"
        :animationData="animationData"
        :loop="true"
        :autoplay="true"
        class="rounded-4xl"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import animationJson from '@/assets/404.json';
import { defineAsyncComponent, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const Vue3Lottie = defineAsyncComponent(() =>
  import('vue3-lottie').then((m) => m.Vue3Lottie),
);
const animationData = ref<Record<string, unknown> | null>(null);
onMounted(() => {
  animationData.value = animationJson;
});
const router = useRouter();

const goBack = () => {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push('/');
  }
};
</script>
