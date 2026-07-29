import {
  rssGateway,
  type RssGateway,
} from '@readinglist/api';
import type {
  RssArticle,
  RssArticleListResponse,
  RefreshResult,
  SubscriptionItem,
} from '@readinglist/types';

export type { SubscriptionItem };

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

/**
 * RSS 服务 —— 委托给共享 @readinglist/api rssGateway，
 * 保留工厂形态以兼容旧消费方。
 */
export const rssService = (): RssService => {
  const gateway: RssGateway = rssGateway;

  return {
    async parseRss(rssUrl: string, saveToDb: boolean): Promise<ParsedRssFeed> {
      return gateway.parseRss({
        rss_url: rssUrl,
        save_to_db: saveToDb,
      });
    },

    async getArticles(params: {
      page?: number;
      limit?: number;
      feed_url?: string;
      search?: string;
    }): Promise<RssArticleListResponse> {
      return gateway.getArticles(params);
    },

    async getArticle(articleId: string): Promise<RssArticle> {
      return gateway.getArticle(articleId);
    },

    async getSubscriptions(): Promise<SubscriptionItem[]> {
      return gateway.getSubscriptions();
    },

    async refreshSubscription(subscriptionId: number): Promise<RefreshResult> {
      return gateway.refreshSubscription(subscriptionId);
    },

    async deleteSubscription(subscriptionId: number): Promise<void> {
      return gateway.deleteSubscription(subscriptionId);
    },

    async markArticleRead(articleId: string): Promise<void> {
      return gateway.markArticleRead(articleId);
    },

    async markArticleUnread(articleId: string): Promise<void> {
      return gateway.markArticleUnread(articleId);
    },
  };
};
