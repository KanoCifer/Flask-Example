<script setup lang="ts">
import type { BookRecommendItem } from '@/features/books/api';
import { computed, ref } from 'vue';
import BookRecommendDetail from './BookRecommendDetail.vue';

const props = withDefaults(
  defineProps<{
    books: BookRecommendItem[];
    loading: boolean;
    hasMore: boolean;
    error?: string;
    /** skeleton 卡片数;首次 loading 展示 */
    skeletonCount?: number;
    /** section 容器 class;wrapper 控制间距/边距 */
    sectionClass?: string;
    /** 列表容器 class;控制 gap / 滚动行为 */
    listClass?: string;
    /** 完全没数据且没 loading 且没 error 时是否隐藏整段;
     *  true = 隐藏(BookShelf 行为,保留这一块让用户感知存在);
     *  false = 显示 empty(Stats 行为) */
    hideWhenEmpty?: boolean;
  }>(),
  {
    skeletonCount: 6,
    sectionClass: 'mb-8',
    listClass:
      '-mx-4 flex snap-x snap-mandatory [scrollbar-width:none] gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:gap-4 sm:px-6 md:-mx-10 md:px-10 [&::-webkit-scrollbar]:hidden',
    error: undefined,
    hideWhenEmpty: false,
  },
);

const emit = defineEmits<{
  (e: 'refresh'): void;
  (e: 'loadMore'): void;
}>();

const showSkeleton = computed(() => props.loading && props.books.length === 0);

/** 是否整段隐藏 — 用于 rail:任何一种有意义的状态(loading/有数据/error)都保留 */
const isHidden = computed(
  () =>
    props.hideWhenEmpty &&
    !props.loading &&
    props.books.length === 0 &&
    !props.error,
);

/** 当前打开的推荐书;null = 模态关闭 */
const activeBook = ref<BookRecommendItem | null>(null);

function openBook(book: BookRecommendItem): void {
  activeBook.value = book;
}

function closeBook(): void {
  activeBook.value = null;
}

/** 0-100 整数 → 0-10 分显示用的小数(供 card slot 消费) */
function ratingScore(v: number): string {
  if (!v || v <= 0) return '--';
  return ((v / 100) * 10).toFixed(1);
}
</script>

<template>
  <section v-if="!isHidden" :class="sectionClass">
    <!-- Header (wrapper 提供:title + refresh) -->
    <slot
      name="header"
      :loading="loading"
      :on-refresh="() => emit('refresh')"
    />

    <!-- Skeleton(默认紧凑卡片;wrapper 可用 #skeleton 整段覆盖) -->
    <slot v-if="showSkeleton" name="skeleton" :count="skeletonCount">
      <div
        class="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:gap-4 sm:px-6 md:-mx-10 md:px-10"
      >
        <div
          v-for="i in skeletonCount"
          :key="i"
          class="w-28 flex-shrink-0 animate-pulse sm:w-32 md:w-36"
        >
          <div class="bg-surface aspect-3/4 rounded-xl" />
          <div class="mt-2 space-y-1.5 px-1">
            <div class="bg-surface h-3 w-5/6 rounded" />
            <div class="bg-surface h-2.5 w-1/2 rounded" />
          </div>
        </div>
      </div>
    </slot>

    <!-- Error(默认边框+重试按钮;wrapper 可用 #error 整段覆盖) -->
    <slot
      v-else-if="error && books.length === 0"
      name="error"
      :error="error"
      :on-retry="() => emit('refresh')"
    >
      <div
        class="/60 text-muted flex flex-col items-center justify-center rounded-2xl border border-dashed py-8 text-center text-sm"
      >
        <p class="text-destructive mb-3 text-xs">{{ error }}</p>
        <button
          type="button"
          class="bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-lg px-3 py-1 text-xs font-medium transition-colors"
          @click="emit('refresh')"
        >
          重试
        </button>
      </div>
    </slot>

    <!-- Empty(默认占位;wrapper 可用 #empty 整段覆盖) -->
    <slot v-else-if="!loading && books.length === 0" name="empty">
      <div
        class="/60 text-muted rounded-2xl border border-dashed py-8 text-center text-xs"
      >
        暂时没有推荐
      </div>
    </slot>

    <!-- Carousel -->
    <div v-else :class="listClass">
      <slot
        v-for="book in books"
        :key="book.bookId"
        name="card"
        :book="book"
        :open="openBook"
        :rating-score="ratingScore"
      />

      <!-- Load more -->
      <slot
        v-if="hasMore"
        name="load-more"
        :loading="loading"
        :on-load-more="() => emit('loadMore')"
      >
        <button
          type="button"
          class="/60 text-muted hover:border-accent/40 hover:text-ink flex w-28 flex-shrink-0 snap-start flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed text-xs transition-colors disabled:opacity-50 sm:w-32 md:w-36"
          :disabled="loading"
          @click="emit('loadMore')"
          aria-label="加载更多推荐"
        >
          <span>{{ loading ? '加载中…' : '更多' }}</span>
        </button>
      </slot>
    </div>

    <BookRecommendDetail :book="activeBook" @close="closeBook" />
  </section>
</template>
