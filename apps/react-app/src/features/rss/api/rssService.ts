import type { AxiosResponse } from 'axios';

import { rssGateway } from '@/features/rss/api/rssGateway';
import { extractData } from '@/api/apiClient';
import type { ApiResponse } from '@/api/apiClient';
import type {
  RssArticle,
  RssArticleListResponse,
  RssSubscription,
} from '@/types';

// 解析 RSS 响应（解析后未保存到数据库）
export interface ParsedRssFeed {
  meta: {
    title: string;
    link: string;
    description: string;
    published: string | null;
  };
  entries: RssEntry[];
}

export interface RssEntry {
  title: string;
  link: string;
  published: string | null;
  summary: string;
  content: string;
  id: string;
  author: string | null;
}

// 刷新订阅结果
export interface RefreshResult {
  subscription_id: number;
  rss_url: string;
  saved_count: number;
}

// 订阅列表项（处理后的）
export interface SubscriptionItem {
  id: number;
  rssUrl: string;
  feedTitle: string | null;
  feedLink: string | null;
  feedDescription: string | null;
  feedPublishedAt: string | null;
  entryCount: number;
  lastFetchedAt: string | null;
  createdAt: string | null;
}

export interface RssService {
  parseRss(rssUrl: string, saveToDb: boolean): Promise<ParsedRssFeed>;
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

export const rssService = (): RssService => {
  const gateway = rssGateway();

  return {
    async parseRss(rssUrl: string, saveToDb: boolean): Promise<ParsedRssFeed> {
      const res: AxiosResponse<ParsedRssFeed> = await gateway.parseRss({
        rss_url: rssUrl,
        save_to_db: saveToDb,
      });
      return extractData(
        res as unknown as { data: ApiResponse<unknown> },
      ) as ParsedRssFeed;
    },

    async getArticles(params: {
      page?: number;
      limit?: number;
      feed_url?: string;
      search?: string;
    }): Promise<RssArticleListResponse> {
      const res: AxiosResponse<RssArticleListResponse> =
        await gateway.getArticles(params);
      return extractData(
        res as unknown as { data: ApiResponse<unknown> },
      ) as RssArticleListResponse;
    },

    async getArticle(articleId: string): Promise<RssArticle> {
      const res: AxiosResponse<RssArticle> =
        await gateway.getArticle(articleId);
      return extractData(
        res as unknown as { data: ApiResponse<unknown> },
      ) as RssArticle;
    },

    async getSubscriptions(): Promise<SubscriptionItem[]> {
      const res: AxiosResponse<RssSubscription[]> =
        await gateway.getSubscriptions();
      const subscriptions = extractData(
        res as unknown as { data: ApiResponse<unknown> },
      ) as RssSubscription[];
      return subscriptions.map((sub) => ({
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
      const res: AxiosResponse<RefreshResult> =
        await gateway.refreshSubscription(subscriptionId);
      const payload = extractData(
        res as unknown as { data: ApiResponse<unknown> },
      ) as RefreshResult;
      return {
        subscription_id: payload.subscription_id,
        rss_url: payload.rss_url,
        saved_count: payload.saved_count,
      };
    },

    async deleteSubscription(subscriptionId: number): Promise<void> {
      await gateway.deleteSubscription(subscriptionId);
    },

    async markArticleRead(articleId: string): Promise<void> {
      await gateway.markArticleRead(articleId);
    },

    async markArticleUnread(articleId: string): Promise<void> {
      await gateway.markArticleUnread(articleId);
    },
  };
};
