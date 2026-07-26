export interface ExampleFeed {
  name: string;
  url: string;
}

export const exampleFeeds: ExampleFeed[] = [
  { name: '少数派', url: 'https://sspai.com/feed' },
  { name: 'GitHub', url: 'https://github.com/blog.atom' },
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
];

export const truncateSummary = (summary: string, maxLength = 160): string => {
  if (!summary) {
    return '';
  }

  const plainText = summary.replace(/<[^>]*>/g, '').trim();
  if (plainText.length <= maxLength) {
    return plainText;
  }

  return `${plainText.slice(0, maxLength)}...`;
};

export const getFeedHost = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

export const getFeedProtocol = (url: string): string => {
  try {
    return new URL(url).protocol.replace(':', '').toUpperCase();
  } catch {
    return 'URL';
  }
};

interface HasTitle {
  feedTitle?: string | null;
  feed_title?: string | null;
  rssUrl: string;
  rss_url?: string;
}

export const getSubscriptionTitle = (subscription: HasTitle): string => {
  const title = subscription.feedTitle ?? subscription.feed_title ?? null;
  if (title && title.trim()) {
    return title;
  }

  return getFeedHost(subscription.rssUrl ?? subscription.rss_url);
};
