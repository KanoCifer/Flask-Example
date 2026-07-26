<script setup lang="ts">
import { computed } from 'vue';
import { usePageBack } from './usePageBack';

const props = withDefaults(
  defineProps<{
    title: string;
    /** 副标题(放 title 下方小字)— 单行简短描述 */
    subtitle?: string;
    /** 顶部小字 eyebrow(放 title 上方)— 例如「微信读书」 */
    eyebrow?: string;
    /** 是否显示返回按钮 */
    back?: boolean;
    /** 无 history 时 push 的兜底路径 */
    backFallback?: string;
    /** 背景图 URL */
    background?: string;
    /** hero 高度,'sm' = 30vh(Stats 风格),'md' = 40vh(BookShelf 风格,默认) */
    size?: 'sm' | 'md';
  }>(),
  {
    subtitle: undefined,
    eyebrow: undefined,
    back: true,
    backFallback: '/',
    background: '/card/card-1.jpeg',
    size: 'md',
  },
);

const { back: goBack } = usePageBack();

const heightClass = computed(() =>
  props.size === 'sm' ? 'h-[30vh] md:h-[35vh]' : 'h-[40vh] md:h-[45vh]',
);
</script>

<template>
  <div :class="['relative flex-shrink-0 overflow-hidden', heightClass]">
    <img :src="background" alt="" class="h-full w-full object-cover" />
    <div
      class="from-page/40 via-page/5 to-page/40 pointer-events-none absolute inset-0 bg-gradient-to-b"
    />

    <!-- 顶栏:返回按钮(左) + actions(右) -->
    <div
      class="absolute top-0 right-0 left-0 z-10 flex items-center justify-between px-4 py-4 md:px-6"
    >
      <button
        v-if="back"
        type="button"
        class="bg-page/60 hover:bg-secondary flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-md transition-colors"
        aria-label="返回"
        @click="goBack(backFallback)"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="2"
          stroke="currentColor"
          class="text-ink h-5 w-5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
          />
        </svg>
      </button>
      <span v-else />

      <div v-if="$slots.actions" class="flex items-center gap-2">
        <slot name="actions" />
      </div>
    </div>

    <!-- 标题区:有 ribbon 时让出底部空间(56/64px),无 ribbon 时贴底 -->
    <div
      v-if="$slots.default || title"
      :class="[
        'absolute right-0 left-0 z-10 px-6 md:px-10',
        $slots.ribbon ? 'bottom-14 md:bottom-16' : 'bottom-0 pb-6 md:pb-8',
      ]"
    >
      <slot>
        <h1
          class="font-serif text-3xl font-bold text-white drop-shadow-lg md:text-5xl"
        >
          {{ title }}
        </h1>
        <div v-if="eyebrow || subtitle" class="mt-2 flex items-center gap-3">
          <span v-if="eyebrow" class="text-sm text-white/75 md:text-base">{{
            eyebrow
          }}</span>
          <span
            v-if="eyebrow && subtitle"
            class="h-1 w-1 rounded-full bg-white/40"
          />
          <span v-if="subtitle" class="text-sm text-white/75 md:text-base">{{
            subtitle
          }}</span>
        </div>
      </slot>
    </div>

    <!-- 底部 ribbon slot(贴 hero 底,给 BookShelfStatsBar 等统计条用) -->
    <div v-if="$slots.ribbon" class="absolute right-0 bottom-0 left-0 z-10">
      <slot name="ribbon" />
    </div>
  </div>
</template>
