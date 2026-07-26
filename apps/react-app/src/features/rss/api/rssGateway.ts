import type { AxiosResponse } from 'axios';

import apiClient from '@/api/apiClient';
import type {
  RssArticle,
  RssArticleListResponse,
  RssSubscription,
} from '@/types';

interface ParseRssPayload {
  rss_url: string;
  save_to_db: boolean;
}

interface ParseRssResponse {
  meta: {
    title: string;
    link: string;
    description: string;
    published: string | null;
  };
  entries: Array<{
    title: string;
    link: string;
    published: string | null;
    summary: string;
    content: string;
    id: string;
    author: string | null;
  }>;
}

interface RefreshResult {
  subscription_id: number;
  rss_url: string;
  saved_count: number;
}

export interface rssGateway {
  parseRss(payload: ParseRssPayload): Promise<AxiosResponse<ParseRssResponse>>;
  getArticles(params: {
    page?: number;
    limit?: number;
    feed_url?: string;
    search?: string;
  }): Promise<AxiosResponse<RssArticleListResponse>>;
  getArticle(articleId: string): Promise<AxiosResponse<RssArticle>>;
  getSubscriptions(): Promise<AxiosResponse<RssSubscription[]>>;
  refreshSubscription(
    subscriptionId: number,
  ): Promise<AxiosResponse<RefreshResult>>;
  deleteSubscription(
    subscriptionId: number,
  ): Promise<AxiosResponse<{ message: string }>>;
  markArticleRead(
    articleId: string,
  ): Promise<AxiosResponse<{ message: string }>>;
  markArticleUnread(
    articleId: string,
  ): Promise<AxiosResponse<{ message: string }>>;
  proxyImage(url: string): Promise<AxiosResponse<unknown>>;
}

export const rssGateway = (): rssGateway => {
  return {
    async parseRss(payload: ParseRssPayload) {
      return apiClient.post('v1/rss/parse-rss', payload) as Promise<
        AxiosResponse<ParseRssResponse>
      >;
    },

    async getArticles(params: {
      page?: number;
      limit?: number;
      feed_url?: string;
      search?: string;
    }) {
      return apiClient.get('v1/rss/articles', { params }) as Promise<
        AxiosResponse<RssArticleListResponse>
      >;
    },

    async getArticle(articleId: string) {
      return apiClient.get(`v1/rss/articles/${articleId}`) as Promise<
        AxiosResponse<RssArticle>
      >;
    },

    async getSubscriptions() {
      return apiClient.get('v1/rss/subscriptions') as Promise<
        AxiosResponse<RssSubscription[]>
      >;
    },

    async refreshSubscription(subscriptionId: number) {
      return apiClient.post(
        `v1/rss/subscriptions/${subscriptionId}/refresh`,
      ) as Promise<AxiosResponse<RefreshResult>>;
    },

    async deleteSubscription(subscriptionId: number) {
      return apiClient.delete(
        `v1/rss/subscriptions/${subscriptionId}`,
      ) as Promise<AxiosResponse<{ message: string }>>;
    },

    async markArticleRead(articleId: string) {
      return apiClient.post(`v1/rss/articles/${articleId}/read`) as Promise<
        AxiosResponse<{ message: string }>
      >;
    },

    async markArticleUnread(articleId: string) {
      return apiClient.delete(`v1/rss/articles/${articleId}/read`) as Promise<
        AxiosResponse<{ message: string }>
      >;
    },

    async proxyImage(url: string) {
      return apiClient.get('v1/rss/image-proxy', {
        params: { url },
      }) as Promise<AxiosResponse<unknown>>;
    },
  };
};
