<template>
  <section id="rss-articles" class="bg-card rounded-2xl border p-6">
    <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-ink text-xl font-bold">文章列表</h2>
        <p class="text-muted mt-1 text-sm">搜索与分页阅读已保存文章</p>
      </div>
      <button
        type="button"
        class="bg-accent text-ink hover:bg-accent/90 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        :disabled="articlesLoading"
        @click="$emit('refresh')"
      >
        {{ articlesLoading ? '加载中...' : '刷新文章' }}
      </button>
    </div>

    <div class="mb-4 flex flex-col gap-3 lg:flex-row">
      <div class="relative flex-1">
        <input
          :value="searchQuery"
          type="search"
          placeholder="搜索文章标题和内容..."
          class="bg-page text-ink placeholder:text-muted focus:border-accent focus:ring-accent/20 w-full rounded-xl border py-3 pr-24 pl-4 text-sm focus:ring-2 focus:outline-none"
          @input="
            $emit(
              'update:searchQuery',
              ($event.target as HTMLInputElement).value,
            )
          "
          @keyup.enter="$emit('search')"
        />
        <div class="absolute inset-y-0 right-2 flex items-center gap-1">
          <button
            type="button"
            class="text-ink hover:bg-surface rounded-md px-2 py-1 text-xs font-medium transition-colors"
            @click="$emit('search')"
          >
            搜索
          </button>
          <button
            v-if="searchQuery"
            type="button"
            class="text-ink hover:bg-surface rounded-md px-2 py-1 text-xs font-medium transition-colors"
            @click="$emit('clearSearch')"
          >
            清空
          </button>
        </div>
      </div>
    </div>

    <div v-if="selectedFeedUrl" class="mb-4 flex items-center gap-2">
      <span
        class="bg-accent/15 text-ink rounded-full px-3 py-1 text-xs font-medium"
      >
        当前来源: {{ selectedFeedUrl }}
      </span>
      <button
        type="button"
        class="border-accent/30 text-ink hover:bg-surface rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors"
        @click="$emit('clearFeedFilter')"
      >
        清除筛选
      </button>
    </div>

    <div
      v-if="articlesError"
      class="border-destructive/30 bg-destructive/10 text-destructive rounded-xl border p-4 text-sm"
    >
      {{ articlesError }}
    </div>

    <div v-else-if="articlesLoading" class="space-y-3">
      <div
        v-for="skeleton in 5"
        :key="skeleton"
        class="bg-surface/40 h-24 animate-pulse rounded-xl border"
      />
    </div>

    <div
      v-else-if="articles.length === 0"
      class="bg-surface/40 text-muted rounded-xl border border-dashed p-8 text-center text-sm"
    >
      暂无文章，尝试刷新订阅或更换搜索条件。
    </div>

    <div v-else>
      <ul class="space-y-3">
        <li
          v-for="article in articles"
          :key="article.id"
          class="bg-card hover:border-accent/30 rounded-xl border p-4 transition-all"
        >
          <div class="flex flex-col gap-3">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <router-link
                :to="`/rss/articles/${article.id}`"
                class="text-ink hover:text-ink text-base font-semibold transition-colors"
              >
                {{ article.title || '无标题' }}
              </router-link>
              <span
                class="rounded-full px-2 py-0.5 text-xs font-medium"
                :class="
                  article.is_read
                    ? 'bg-success/20 text-success'
                    : 'bg-accent/15 text-ink'
                "
              >
                {{ article.is_read ? '已读' : '未读' }}
              </span>
            </div>
            <p v-if="article.summary" class="text-muted line-clamp-2 text-sm">
              {{ article.summary }}
            </p>
            <div class="text-muted flex flex-wrap items-center gap-3 text-xs">
              <span v-if="article.author">作者: {{ article.author }}</span>
              <span>发布时间: {{ formatDate(article.published) }}</span>
              <span class="truncate">来源: {{ article.feed_url }}</span>
              <a
                :href="article.link"
                target="_blank"
                rel="noopener noreferrer"
                class="text-ink hover:text-ink font-medium"
              >
                阅读原文
              </a>
            </div>
          </div>
        </li>
      </ul>

      <nav
        v-if="totalPages > 1"
        class="mt-6 flex items-center justify-center gap-3"
      >
        <button
          type="button"
          :disabled="currentPage <= 1"
          class="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          :class="
            currentPage > 1
              ? 'bg-accent text-ink hover:bg-accent/90'
              : 'bg-surface text-muted cursor-not-allowed'
          "
          @click="$emit('goToPage', currentPage - 1)"
        >
          上一页
        </button>
        <span class="text-ink text-sm font-medium">
          第 {{ currentPage }} 页 / 共 {{ totalPages }} 页
        </span>
        <button
          type="button"
          :disabled="currentPage >= totalPages"
          class="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          :class="
            currentPage < totalPages
              ? 'bg-accent text-ink hover:bg-accent/90'
              : 'bg-surface text-muted cursor-not-allowed'
          "
          @click="$emit('goToPage', currentPage + 1)"
        >
          下一页
        </button>
      </nav>
    </div>
  </section>
</template>

<script setup lang="ts">
import { formatDate } from '@/lib/dayjs';
import type { RssArticle } from '@/features/rss/types';

defineProps<{
  articles: RssArticle[];
  articlesLoading: boolean;
  articlesError: string;
  currentPage: number;
  totalPages: number;
  searchQuery: string;
  selectedFeedUrl: string;
}>();

defineEmits<{
  'update:searchQuery': [value: string];
  search: [];
  clearSearch: [];
  goToPage: [page: number];
  clearFeedFilter: [];
  refresh: [];
}>();
</script>
