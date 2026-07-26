import { rssGateway } from '@/features/rss/api';
import type { RssArticle } from '@/features/rss/types';
import { useNotificationStore } from '@/stores';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

export const useRssArticles = () => {
  const router = useRouter();
  const notifier = useNotificationStore();

  const articles = ref<RssArticle[]>([]);
  const articlesLoading = ref(false);
  const articlesError = ref('');
  const currentPage = ref(1);
  const totalItems = ref(0);
  const limit = 20;
  const searchQuery = ref('');
  const selectedFeedUrl = ref('');

  const totalPages = computed(() => Math.ceil(totalItems.value / limit));

  const syncRouteQuery = async (page: number): Promise<void> => {
    const query: Record<string, string> = {};
    if (page > 1) {
      query.page = String(page);
    }
    if (selectedFeedUrl.value.trim()) {
      query.feed_url = selectedFeedUrl.value.trim();
    }
    if (searchQuery.value.trim()) {
      query.search = searchQuery.value.trim();
    }

    try {
      await router.replace({
        path: '/rss',
        query,
      });
    } catch {
      // 同一路由重复更新 query 时可忽略
    }
  };

  const fetchArticles = async (page = 1): Promise<void> => {
    articlesLoading.value = true;
    articlesError.value = '';

    try {
      const params: Record<string, number | string> = {
        page,
        limit,
      };

      const feedUrl = selectedFeedUrl.value.trim();
      if (feedUrl) {
        params.feed_url = feedUrl;
      }

      const search = searchQuery.value.trim();
      if (search) {
        params.search = search;
      }

      const response = await rssGateway.getArticles(params);
      articles.value = response.items;
      totalItems.value = response.total;
      currentPage.value = response.page;
    } catch (error: unknown) {
      console.error('fetch articles error:', error);
      articlesError.value =
        error instanceof Error ? error.message : '加载文章失败';
      notifier.error(articlesError.value);
    } finally {
      articlesLoading.value = false;
    }
  };

  const handleSearch = async (): Promise<void> => {
    await syncRouteQuery(1);
    await fetchArticles(1);
  };

  const clearSearch = async (): Promise<void> => {
    searchQuery.value = '';
    await handleSearch();
  };

  const goToPage = async (page: number): Promise<void> => {
    if (page < 1 || page > totalPages.value) {
      return;
    }

    await syncRouteQuery(page);
    await fetchArticles(page);
  };

  const setSelectedFeed = (url: string): void => {
    selectedFeedUrl.value = url;
  };

  const clearFeedFilter = async (): Promise<void> => {
    selectedFeedUrl.value = '';
    await syncRouteQuery(1);
    await fetchArticles(1);
  };

  const initFromRoute = (
    routeQuery: Record<string, string | undefined>,
  ): void => {
    if (typeof routeQuery.feed_url === 'string') {
      selectedFeedUrl.value = routeQuery.feed_url;
    }
    if (typeof routeQuery.search === 'string') {
      searchQuery.value = routeQuery.search;
    }
  };

  return {
    articles,
    articlesLoading,
    articlesError,
    currentPage,
    totalItems,
    totalPages,
    searchQuery,
    selectedFeedUrl,
    limit,
    fetchArticles,
    handleSearch,
    clearSearch,
    goToPage,
    syncRouteQuery,
    setSelectedFeed,
    clearFeedFilter,
    initFromRoute,
  };
};
