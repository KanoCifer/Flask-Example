// RSS 文章与订阅类型

export interface RssArticle {
  id: string;
  guid: string;
  feed_url: string;
  title: string;
  link: string;
  summary: string;
  content: string;
  author: string | null;
  published: string | null;
  fetched_at: string;
  is_read: boolean;
}

export interface RssSubscription {
  id: number;
  rss_url: string;
  feed_title?: string | null;
  feed_link?: string | null;
  feed_description?: string | null;
  feed_published_at?: string | null;
  entry_count?: number;
  last_fetched_at?: string | null;
  created_at: string | null;
}

export interface RssArticleListResponse {
  items: RssArticle[];
  total: number;
  page: number;
  limit: number;
}

// ---------------------------------------------------------------------------
// RSS 解析 / 订阅条目 DTO
// ---------------------------------------------------------------------------

export interface ParseRssPayload {
  rss_url: string;
  save_to_db: boolean;
}

export interface ParseRssResponse {
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

export interface RefreshResult {
  subscription_id: number;
  rss_url: string;
  saved_count: number;
}

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
