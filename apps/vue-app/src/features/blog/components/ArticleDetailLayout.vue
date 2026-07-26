<script setup lang="ts">
import { formatDate } from '@/lib/dayjs';
import { useScroll } from '@vueuse/core';
import { computed } from 'vue';
import { useRouter } from 'vue-router';

const props = defineProps<{
  title: string;
  author?: string;
  authorInitial?: string;
  publishedDate?: string;
  updatedDate?: string;
  tags?: string[];
  isLoading: boolean;
  errorMessage?: string;
  backLink: string;
  backText?: string;
}>();

const router = useRouter();
const { y } = useScroll(window);

const titleStyle = computed(() => ({
  transform: `translateY(${y.value * 0.4}px)`,
}));

const sectionStyle = computed(() => {
  const width = Math.min(1, 0.9 + y.value * 0.0005);
  return {
    width: `${width * 100}vw`,
  };
});

const goBack = () => {
  router.push(props.backLink);
};

const displayDate = computed(() => {
  if (
    props.publishedDate &&
    props.updatedDate &&
    props.updatedDate !== props.publishedDate
  ) {
    return formatDate(props.updatedDate);
  }
  return props.publishedDate ? formatDate(props.publishedDate) : '';
});

const formattedDate = computed(() =>
  props.publishedDate ? formatDate(props.publishedDate) : '',
);
</script>

<template>
  <div class="relative">
    <!-- Title Section with Parallax -->
    <div
      class="relative -z-5 mx-0 mt-60 flex flex-col items-center justify-center bg-transparent"
      :style="titleStyle"
    >
      <!-- Loading State -->
      <div
        v-if="isLoading"
        class="flex min-h-[60vh] flex-col items-center justify-center"
      >
        <div
          class="h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"
        ></div>
        <p class="mt-4 text-gray-600 dark:text-gray-400">加载中...</p>
      </div>

      <div v-else>
        <h1 class="max-w-6xl text-center font-serif text-7xl text-gray-50">
          {{ title }}
        </h1>
        <!-- Author and Date Info -->
        <div
          class="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-400"
        >
          <div class="flex items-center gap-2">
            <div
              class="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br from-blue-500 to-sky-600 text-lg font-bold text-white"
            >
              {{
                author?.charAt(0).toUpperCase() ||
                authorInitial?.charAt(0).toUpperCase() ||
                'K'
              }}
            </div>
            <span class="font-medium text-gray-200"
              >@{{ author || 'Kurroome' }}</span
            >
          </div>
          <span class="text-gray-50">·</span>
          <div class="flex items-center gap-1">
            <svg
              class="h-4 w-4 text-gray-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span class="text-gray-50">
              {{ displayDate || formattedDate || '未知时间' }}
            </span>
          </div>
          <span
            v-if="tags && tags.length > 0"
            class="flex flex-wrap items-center gap-1.5"
          >
            <svg
              class="h-4 w-4 text-gray-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
            <router-link
              v-for="tag in tags"
              :key="tag"
              :to="`/blog?tag=${encodeURIComponent(tag)}`"
              class="text-blue-400 hover:text-blue-800 hover:underline dark:hover:text-blue-300"
            >
              #{{ tag }}
            </router-link>
          </span>
        </div>
      </div>
    </div>

    <!-- Content Section -->
    <div class="relative mt-24 min-h-screen overflow-hidden">
      <!-- 背景层 -->
      <div
        :style="sectionStyle"
        class="absolute inset-y-0 left-1/2 -z-5 -translate-x-1/2 rounded-t-[40px] bg-blue-50 dark:bg-slate-900"
      />

      <div class="mx-auto mt-20 max-w-4xl">
        <!-- Back button -->
        <div class="mb-6 flex items-center justify-between">
          <button
            @click="goBack"
            class="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-200 dark:bg-slate-800 dark:text-blue-300 dark:hover:bg-slate-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="2"
              stroke="currentColor"
              class="h-4 w-4"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
              />
            </svg>
            {{ backText || '返回' }}
          </button>

          <!-- Actions Slot -->
          <slot name="actions" />
        </div>

        <!-- Loading State -->
        <div v-if="isLoading" class="space-y-6">
          <div
            class="animate-pulse overflow-hidden rounded-2xl border border-blue-100 bg-white p-8 dark:border-slate-700 dark:bg-slate-800"
          >
            <div class="mb-6 h-8 w-3/4 rounded bg-blue-200 dark:bg-slate-700" />
            <div class="mb-8 flex gap-4">
              <div class="h-4 w-24 rounded bg-blue-100 dark:bg-slate-700" />
              <div class="h-4 w-32 rounded bg-blue-100 dark:bg-slate-700" />
            </div>
            <div class="space-y-4">
              <div class="h-4 w-full rounded bg-blue-100 dark:bg-slate-700" />
              <div class="h-4 w-full rounded bg-blue-100 dark:bg-slate-700" />
              <div class="h-4 w-5/6 rounded bg-blue-100 dark:bg-slate-700" />
              <div class="h-4 w-full rounded bg-blue-100 dark:bg-slate-700" />
              <div class="h-4 w-4/5 rounded bg-blue-100 dark:bg-slate-700" />
            </div>
          </div>
        </div>

        <!-- Error State -->
        <div
          v-else-if="errorMessage"
          class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-red-200 bg-red-50 py-16 text-center dark:border-red-800 dark:bg-red-900/20"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="mb-4 h-12 w-12 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
          <p class="text-lg font-medium text-red-600 dark:text-red-400">
            加载失败
          </p>
          <p class="mt-1 text-sm text-red-500">{{ errorMessage }}</p>
          <button
            class="mt-4 cursor-pointer rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            重试
          </button>
        </div>

        <!-- Main Content -->
        <div v-else>
          <slot />
        </div>
      </div>
    </div>
  </div>
</template>
