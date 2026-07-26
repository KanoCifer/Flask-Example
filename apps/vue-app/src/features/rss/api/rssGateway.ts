import { apiClient } from '@/api/request';
import type {
  ParseRssPayload,
  ParseRssResponse,
  RefreshResult,
  RssArticle,
  RssArticleListResponse,
  RssSubscription,
  SubscriptionItem,
} from '@/features/rss/types';

export interface RssGateway {
  parseRss(payload: ParseRssPayload): Promise<ParseRssResponse>;
  getArticles(params: {
    page?: number;
    limit?: number;
    feed_url?: string;
    search?: string;
  }): Promise<RssArticleListResponse>;
  getArticle(articleId: string): Promise<RssArticle>;
  getSubscriptions(): Promise<SubscriptionItem[]>;
  refreshSubscription(subscriptionId: number): Promise<RefreshResult>;
  deleteSubscription(subscriptionId: number): Promise<void>;
  markArticleRead(articleId: string): Promise<void>;
  markArticleUnread(articleId: string): Promise<void>;
}

export const rssGateway: RssGateway = {
  async parseRss(payload: ParseRssPayload): Promise<ParseRssResponse> {
    const res = await apiClient.post<{ data: ParseRssResponse }>(
      'v1/rss/parse-rss',
      payload,
    );
    return res.data.data;
  },

  async getArticles(params: {
    page?: number;
    limit?: number;
    feed_url?: string;
    search?: string;
  }): Promise<RssArticleListResponse> {
    const res = await apiClient.get<{ data: RssArticleListResponse }>(
      'v1/rss/articles',
      { params },
    );
    return res.data.data;
  },

  async getArticle(articleId: string): Promise<RssArticle> {
    const res = await apiClient.get<{ data: RssArticle }>(
      `v1/rss/articles/${articleId}`,
    );
    return res.data.data;
  },

  async getSubscriptions(): Promise<SubscriptionItem[]> {
    const res = await apiClient.get<{ data: RssSubscription[] }>(
      'v1/rss/subscriptions',
    );
    return res.data.data.map((sub) => ({
      id: sub.id,
      rssUrl: sub.rss_url,
      feedTitle: sub.feed_title ?? null,
      feedLink: sub.feed_link ?? null,
      feedDescription: sub.feed_description ?? null,
      feedPublishedAt: sub.feed_published_at ?? null,
      entryCount: sub.entry_count ?? 0,
      lastFetchedAt: sub.last_fetched_at ?? null,
      createdAt: sub.created_at ?? null,
    }));
  },

  async refreshSubscription(subscriptionId: number): Promise<RefreshResult> {
    const res = await apiClient.post<{ data: RefreshResult }>(
      `v1/rss/subscriptions/${subscriptionId}/refresh`,
    );
    return res.data.data;
  },

  async deleteSubscription(subscriptionId: number): Promise<void> {
    await apiClient.delete(`v1/rss/subscriptions/${subscriptionId}`);
  },

  async markArticleRead(articleId: string): Promise<void> {
    await apiClient.post(`v1/rss/articles/${articleId}/read`);
  },

  async markArticleUnread(articleId: string): Promise<void> {
    await apiClient.delete(`v1/rss/articles/${articleId}/read`);
  },
};
