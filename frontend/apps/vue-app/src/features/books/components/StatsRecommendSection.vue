<template>
  <BookRecommendGrid
    :books="books"
    :loading="loading"
    :has-more="hasMore"
    :error="error"
    section-class="mb-14"
    :list-class="listClass"
    @refresh="$emit('refresh')"
    @load-more="$emit('loadMore')"
  >
    <template #header="{ loading: isLoading, onRefresh }">
      <div class="mb-6 flex items-end justify-between gap-4">
        <div>
          <p class="text-muted mb-1 text-sm">读完这些之后</p>
          <h2
            class="text-ink font-serif text-2xl font-semibold tracking-tight sm:text-3xl"
          >
            接下来读什么
          </h2>
        </div>
        <button
          type="button"
          class="text-muted hover:text-ink hover:bg-surface inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="isLoading"
          @click="onRefresh"
          aria-label="换一批"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="2"
            stroke="currentColor"
            class="h-4 w-4"
            :class="{ 'animate-spin': isLoading }"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
            />
          </svg>
          换一批
        </button>
      </div>
    </template>

    <template #skeleton="{ count }">
      <div
        class="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 md:-mx-10 md:px-10"
      >
        <div
          v-for="i in count"
          :key="i"
          class="bg-page flex w-56 flex-shrink-0 animate-pulse flex-col gap-3 rounded-2xl p-4"
        >
          <div class="bg-surface aspect-[2/3] w-full rounded-md" />
          <div class="bg-surface h-4 w-3/4 rounded" />
          <div class="bg-surface h-3 w-1/2 rounded" />
          <div class="bg-surface h-3 w-full rounded" />
        </div>
      </div>
    </template>

    <template #card="{ book, open, ratingScore }">
      <button
        type="button"
        class="group bg-page hover:border-accent/40 flex w-56 flex-shrink-0 snap-start flex-col gap-3 rounded-2xl border border-transparent p-4 text-left transition-colors sm:w-60"
        @click="open(book)"
      >
        <Motion
          :layoutId="RECOMMEND_COVER_LAYOUT_ID_PREFIX + book.bookId"
          class="bg-surface relative aspect-[2/3] w-full overflow-hidden rounded-md shadow-sm"
        >
          <img
            v-if="book.cover"
            :src="book.cover"
            :alt="book.title"
            loading="lazy"
            class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <span
            v-if="book.newRating > 0"
            class="bg-page/80 text-ink absolute top-2 right-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums backdrop-blur-md"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              class="text-ink h-3 w-3"
              aria-hidden="true"
            >
              <path
                fill-rule="evenodd"
                d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.007Z"
                clip-rule="evenodd"
              />
            </svg>
            {{ ratingScore(book.newRating) }}
          </span>
        </Motion>
        <div class="min-w-0">
          <p class="text-ink line-clamp-2 font-serif text-base leading-tight">
            {{ book.title }}
          </p>
          <p v-if="book.author" class="text-muted mt-1 truncate text-xs">
            {{ book.author }}
          </p>
        </div>
        <p
          v-if="book.reason"
          class="text-muted line-clamp-2 text-xs leading-relaxed"
        >
          {{ book.reason }}
        </p>
        <p
          v-if="book.readingCount"
          class="text-muted/80 mt-auto text-[11px] tabular-nums"
        >
          {{ readingCountLabel(book.readingCount) }}
        </p>
      </button>
    </template>

    <template #load-more="{ loading: isLoading, onLoadMore }">
      <button
        type="button"
        class="text-muted hover:text-ink hover:border-accent/40 flex w-40 flex-shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-2xl border border-dashed text-sm transition-colors disabled:opacity-50 sm:w-44"
        :disabled="isLoading"
        @click="onLoadMore"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="2"
          stroke="currentColor"
          class="h-5 w-5"
          :class="{ 'animate-spin': isLoading }"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
          />
        </svg>
        <span>{{ isLoading ? '加载中…' : '更多推荐' }}</span>
      </button>
    </template>
  </BookRecommendGrid>
</template>

<script setup lang="ts">
import type { BookRecommendItem } from '@/features/books/api';
import { Motion } from 'motion-v';
import { computed } from 'vue';
import BookRecommendGrid from '@/features/books/components/BookRecommendGrid.vue';
import { RECOMMEND_COVER_LAYOUT_ID_PREFIX } from '@/features/books/lib/recommendLayoutId';

defineProps<{
  books: BookRecommendItem[];
  loading: boolean;
  hasMore: boolean;
  error?: string;
}>();

defineEmits<{
  (e: 'refresh'): void;
  (e: 'loadMore'): void;
}>();

/** N 人在读 → "1.2 万人在读" / "342 人在读" */
function readingCountLabel(n: number): string {
  if (!n || n <= 0) return '';
  if (n >= 10000) return `${(n / 10000).toFixed(1)} 万人在读`;
  return `${n} 人在读`;
}

/** 宽卡片场景的 carousel 容器:gap-4 + 滚动 snap 留 1rem padding */
const listClass = computed(
  () =>
    '-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 md:-mx-10 md:px-10 [scroll-padding-inline:1rem]',
);
</script>
