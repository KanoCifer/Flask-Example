<template>
  <div class="bg-page flex min-h-screen flex-col">
    <BookShelfHero
      :book-count="isLoading ? null : displayedBooks.length"
      :is-syncing="isSyncing"
      @sync="handleSync"
    >
      <template #ribbon>
        <BookShelfStatsBar :weekly-snapshot="statsStore.weeklySnapshot" />
      </template>
    </BookShelfHero>

    <!-- Books Section -->
    <div class="flex-1 pb-8">
      <div class="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:px-10">
        <BookShelfStateView
          v-if="isLoading || errorMessage || visibleBooks.length === 0"
          :is-loading="isLoading"
          :error-message="errorMessage"
          :is-empty="visibleBooks.length === 0"
          @retry="fetchBooks"
        />

        <!-- Has books: toolbar + (reading rail) + grid/list -->
        <template v-else>
          <BookShelfToolbar
            v-model:searchQuery="searchQuery"
            v-model:filter="filter"
            v-model:sort="sort"
            v-model:density="density"
            :counts="counts"
          />

          <!-- 「你正在读」横向 rail:仅 filter=all 且非搜索状态时显示 -->
          <BookShelfReadingRail
            v-if="showReadingRail"
            :books="recentReading"
            @select="selectBook"
          />

          <!-- 「接下来读什么」推荐 rail:同样仅 filter=all 且非搜索状态时显示 -->
          <BookShelfRecommendRail
            v-if="showRecommendRail"
            :books="recommends"
            :loading="isLoadingRecommends"
            :has-more="hasMoreRecommends"
            :error="recommendError"
            @refresh="reloadRecommends"
            @load-more="loadMoreRecommends"
          />

          <!-- 分区标题(filter=all 时给"全部书架"一个 section 标识) -->
          <header
            v-if="filter === 'all' && (showReadingRail || showRecommendRail)"
            class="mt-2 mb-3 flex items-baseline justify-between"
          >
            <h2 class="text-ink font-serif text-xl font-bold md:text-2xl">
              全部书架
            </h2>
            <span class="text-muted text-xs tabular-nums">
              {{ displayedBooks.length }} 本
            </span>
          </header>

          <!-- No results -->
          <div
            v-if="displayedBooks.length === 0"
            class="flex flex-col items-center justify-center py-16"
          >
            <p class="text-muted text-sm">
              {{ noResultMessage }}
            </p>
          </div>

          <!-- List variant -->
          <div v-else-if="density === 'list'" class="flex flex-col gap-2">
            <WereadBookCard
              v-for="(book, index) in displayedBooks"
              :key="book.bookId"
              :book="book"
              :index="index"
              variant="list"
              @select="selectBook"
            />
          </div>

          <!-- Grid variant -->
          <div v-else :class="gridClass">
            <WereadBookCard
              v-for="(book, index) in displayedBooks"
              :key="book.bookId"
              :book="book"
              :index="index"
              @select="selectBook"
            />
          </div>
        </template>
      </div>
    </div>

    <!-- 详情面板 -->
    <WereadBookDetailPanel :book="selectedBook" :open="isOpen" @close="close" />
  </div>
</template>

<script setup lang="ts">
import { useWereadShelf } from '@/features/books/composables';
import { useRecommends } from '@/features/books/composables/useRecommends';
import { useReadStatsStore } from '@/features/books/stores/readStats';
import WereadBookCard from '@/features/books/components/WereadBookCard.vue';
import WereadBookDetailPanel from '@/features/books/components/WereadBookDetailPanel.vue';
import { useWereadBookDetailSingleton } from '@/features/books/composables/useWereadBookDetailSingleton';
import { onMounted } from 'vue';
import BookShelfHero from './components/BookShelfHero.vue';
import BookShelfReadingRail from './components/BookShelfReadingRail.vue';
import BookShelfRecommendRail from './components/BookShelfRecommendRail.vue';
import BookShelfStatsBar from './components/BookShelfStatsBar.vue';
import BookShelfStateView from './components/BookShelfStateView.vue';
import BookShelfToolbar from './components/BookShelfToolbar.vue';
import { useShelfView } from './composables/useShelfView';

const statsStore = useReadStatsStore();
const {
  recommends,
  isLoadingRecommends,
  recommendError,
  hasMoreRecommends,
  fetchRecommends,
} = useRecommends();

const {
  isLoading,
  errorMessage,
  isSyncing,
  visibleBooks,
  fetchBooks,
  handleSync,
} = useWereadShelf();

// ── 详情面板状态 (单例 — 整个应用共享同一份) ────────────────
const { selectedBook, isOpen, selectBook, close } =
  useWereadBookDetailSingleton();

// ── 视图状态机: 偏好 / 分桶 / 排序 / 派生 UI ───────────────
const {
  searchQuery,
  filter,
  sort,
  density,
  counts,
  recentReading,
  showReadingRail,
  showRecommendRail,
  displayedBooks,
  gridClass,
  noResultMessage,
} = useShelfView(visibleBooks);

function reloadRecommends() {
  fetchRecommends(true);
}
function loadMoreRecommends() {
  fetchRecommends(false);
}

onMounted(async () => {
  await Promise.all([fetchBooks(), statsStore.fetchCurrentAll()]);
  // 推荐独立拉取(已被 BookStats 拉过则不重复)
  if (recommends.value.length === 0) {
    fetchRecommends(true);
  }
});
</script>
