<template>
  <BasicDetail
    title="RSS 工作台"
    subtitle="在一个页面里完成解析、订阅管理与文章阅读"
  >
    <div class="col-span-full mx-auto w-full max-w-6xl space-y-8">
      <div class="flex flex-wrap items-center gap-3">
        <a
          href="#rss-parse"
          class="bg-accent/15 text-ink hover:bg-surface rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
        >
          解析订阅
        </a>
        <a
          href="#rss-subscriptions"
          class="bg-accent/15 text-ink hover:bg-surface rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
        >
          我的订阅
        </a>
        <a
          href="#rss-articles"
          class="bg-accent/15 text-ink hover:bg-surface rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
        >
          文章列表
        </a>
      </div>

      <RssParseSection
        :rss-url="rssForm.rssUrl"
        :save-to-db="rssForm.saveToDb"
        :parse-loading="parseLoading"
        :parse-metadata="parseMetadata"
        :parse-entries="parseEntries"
        :example-feeds="exampleFeeds"
        :rss-history="rssHistory"
        @update:rss-url="rssForm.rssUrl = $event"
        @update:save-to-db="rssForm.saveToDb = $event"
        @parse="handleParse"
      />

      <RssSubscriptionsSection
        :subscriptions="subscriptions"
        :subscriptions-loading="subscriptionsLoading"
        :subscriptions-error="subscriptionsError"
        :active-subscription-id="activeSubscriptionId"
        @refresh="handleRefreshFeed"
        @delete="handleDeleteFeed"
        @filter-by-feed="handleFilterByFeed"
        @refresh-list="fetchSubscriptions"
      />

      <RssArticlesSection
        :articles="articles"
        :articles-loading="articlesLoading"
        :articles-error="articlesError"
        :current-page="currentPage"
        :total-pages="totalPages"
        :search-query="searchQuery"
        :selected-feed-url="selectedFeedUrl"
        @update:search-query="searchQuery = $event"
        @search="handleSearch"
        @clear-search="handleClearSearch"
        @go-to-page="goToPage"
        @clear-feed-filter="handleClearFeedFilter"
        @refresh="fetchArticles(currentPage)"
      />
    </div>
  </BasicDetail>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useRssParse } from '@/features/rss/composables';
import { useRssSubscriptions } from '@/features/rss/composables';
import { useRssArticles } from '@/features/rss/composables';
import { BasicDetail } from '@/components';
import RssParseSection from './components/RssParseSection.vue';
import RssSubscriptionsSection from './components/RssSubscriptionsSection.vue';
import RssArticlesSection from './components/RssArticlesSection.vue';
import type { SubscriptionItem } from '@/features/rss/api';

const route = useRoute();

const {
  rssForm,
  parseMetadata,
  parseEntries,
  parseLoading,
  rssHistory,
  exampleFeeds,
  parseRss,
} = useRssParse();

const {
  subscriptions,
  subscriptionsLoading,
  subscriptionsError,
  activeSubscriptionId,
  fetchSubscriptions,
  handleRefresh,
  handleDelete,
} = useRssSubscriptions();

const {
  articles,
  articlesLoading,
  articlesError,
  currentPage,
  totalPages,
  searchQuery,
  selectedFeedUrl,
  fetchArticles,
  handleSearch,
  goToPage,
  syncRouteQuery,
  setSelectedFeed,
  initFromRoute,
} = useRssArticles();

// --- 跨 composable 协调函数 ---

const handleParse = async () => {
  const savedToDb = await parseRss();
  if (savedToDb) {
    await fetchSubscriptions();
    await fetchArticles(1);
  }
};

const handleFilterByFeed = async (subscription: SubscriptionItem) => {
  setSelectedFeed(subscription.rssUrl);
  activeSubscriptionId.value = subscription.id;
  await syncRouteQuery(1);
  await fetchArticles(1);
};

const handleRefreshFeed = async (subscription: SubscriptionItem) => {
  await handleRefresh(subscription);
  if (selectedFeedUrl.value === subscription.rssUrl) {
    await fetchArticles(1);
  }
};

const handleDeleteFeed = async (subscription: SubscriptionItem) => {
  const wasSelected = selectedFeedUrl.value === subscription.rssUrl;
  const deleted = await handleDelete(subscription);
  if (deleted && wasSelected) {
    setSelectedFeed('');
    activeSubscriptionId.value = null;
    await syncRouteQuery(1);
    await fetchArticles(1);
  }
};

const handleClearSearch = async () => {
  searchQuery.value = '';
  await syncRouteQuery(1);
  await fetchArticles(1);
};

const handleClearFeedFilter = async () => {
  setSelectedFeed('');
  activeSubscriptionId.value = null;
  await syncRouteQuery(1);
  await fetchArticles(1);
};

// --- 初始化 ---

onMounted(async () => {
  initFromRoute(route.query as Record<string, string | undefined>);

  const pageFromQuery =
    typeof route.query.page === 'string'
      ? Number.parseInt(route.query.page, 10)
      : 1;
  const initialPage =
    Number.isNaN(pageFromQuery) || pageFromQuery < 1 ? 1 : pageFromQuery;

  await Promise.all([fetchSubscriptions(), fetchArticles(initialPage)]);
});
</script>
