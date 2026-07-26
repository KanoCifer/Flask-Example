import {
  rssService,
  type SubscriptionItem,
} from '@/features/rss/api/rssService';
import { useNotificationStore } from '@/stores/notificationState';
import type { RssArticle } from '@/types';
import { formatDate } from '@/lib/formatdate';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Rss } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

const ARTICLE_LIMIT = 20;

export default function RssWorkspaceView() {
  const push = useNotificationStore((s) => s.push);
  const service = useMemo(() => rssService(), []);

  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [articles, setArticles] = useState<RssArticle[]>([]);
  const [selectedFeedUrl, setSelectedFeedUrl] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [loadingArticles, setLoadingArticles] = useState(true);
  const [subsError, setSubsError] = useState<string | null>(null);
  const [articlesError, setArticlesError] = useState<string | null>(null);
  const [showFeedPicker, setShowFeedPicker] = useState(false);

  // 用 ref 让 fetch 闭包读到最新值，同时保持 useCallback 引用稳定，打破 useEffect 依赖循环
  const selectedFeedUrlRef = useRef(selectedFeedUrl);
  selectedFeedUrlRef.current = selectedFeedUrl;

  const currentPageRef = useRef(currentPage);
  currentPageRef.current = currentPage;

  const totalPages = useMemo(
    () => Math.ceil(totalItems / ARTICLE_LIMIT),
    [totalItems],
  );

  const selectedFeed = subscriptions.find(
    (sub) => sub.rssUrl === selectedFeedUrl,
  );

  const fetchSubscriptions = useCallback(async () => {
    setLoadingSubs(true);
    setSubsError(null);
    try {
      const subs = await service.getSubscriptions();
      setSubscriptions(subs);
      // 通过 ref 读取，不在 useCallback 依赖列表
      if (subs.length > 0 && !selectedFeedUrlRef.current) {
        const url = subs[0].rssUrl;
        selectedFeedUrlRef.current = url;
        setSelectedFeedUrl(url);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载订阅失败';
      setSubsError(msg);
      void push(msg, 'error');
    } finally {
      setLoadingSubs(false);
    }
  }, [push, service]);

  const fetchArticles = useCallback(async () => {
    const feedUrl = selectedFeedUrlRef.current;
    const page = currentPageRef.current;
    setLoadingArticles(true);
    setArticlesError(null);
    try {
      const response = await service.getArticles({
        page,
        limit: ARTICLE_LIMIT,
        feed_url: feedUrl || undefined,
      });
      setArticles(response.items);
      setTotalItems(response.total);
      setCurrentPage(response.page);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载文章失败';
      setArticlesError(msg);
      void push(msg, 'error');
    } finally {
      setLoadingArticles(false);
    }
  }, [push, service]);

  useEffect(() => {
    void fetchSubscriptions();
  }, [fetchSubscriptions]);

  useEffect(() => {
    void fetchArticles();
  }, [fetchArticles]);

  const handleSelectFeed = (feedUrl: string) => {
    setSelectedFeedUrl(feedUrl);
    setCurrentPage(1);
    setShowFeedPicker(false);
  };

  return (
    <div className="bg-page min-h-dvh pb-28">
      {/* Header */}
      <header className="bg-page/85 sticky top-0 z-10 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-md items-center gap-3 px-4 py-3">
          <Rss className="text-ink h-5 w-5" />
          <h1 className="text-ink text-lg font-bold">RSS 阅读</h1>

          {/* Feed selector */}
          {subscriptions.length > 1 && (
            <button
              type="button"
              onClick={() => setShowFeedPicker((v) => !v)}
              className="bg-page hover:bg-surface ml-auto flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
            >
              <span className="max-w-32 truncate">
                {selectedFeed?.feedTitle || '全部'}
              </span>
              <ChevronDown className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Feed picker dropdown */}
        <AnimatePresence>
          {showFeedPicker && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="/60 overflow-hidden border-t"
            >
              <div className="bg-page/95 mx-auto w-full max-w-md px-4 py-2">
                <button
                  type="button"
                  onClick={() => handleSelectFeed('')}
                  className={`flex w-full items-center rounded-lg px-3 py-2 text-sm transition-colors ${
                    !selectedFeedUrl
                      ? 'bg-accent/10 text-ink'
                      : 'text-muted hover:bg-surface hover:text-ink'
                  }`}
                >
                  全部订阅
                </button>
                {subscriptions.map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => handleSelectFeed(sub.rssUrl)}
                    className={`flex w-full items-center rounded-lg px-3 py-2 text-sm transition-colors ${
                      selectedFeedUrl === sub.rssUrl
                        ? 'bg-accent/10 text-ink'
                        : 'text-muted hover:bg-surface hover:text-ink'
                    }`}
                  >
                    {sub.feedTitle || new URL(sub.rssUrl).hostname}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Article list */}
      <main className="mx-auto w-full max-w-md px-4 pt-3">
        {loadingSubs ? (
          <div className="space-y-3 pt-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-surface h-14 rounded-xl" />
              </div>
            ))}
          </div>
        ) : subsError ? (
          <div className="flex flex-col items-center justify-center pt-16 text-center">
            <p className="text-muted text-sm">{subsError}</p>
            <button
              type="button"
              onClick={() => void fetchSubscriptions()}
              className="text-ink mt-3 cursor-pointer text-sm font-medium underline underline-offset-4"
            >
              重试
            </button>
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-24 text-center">
            <Rss className="text-muted/40 mb-4 h-12 w-12" />
            <p className="text-muted text-sm">暂无订阅源</p>
            <p className="text-muted/60 mt-1 text-xs">
              在管理后台添加 RSS 订阅后即可阅读
            </p>
          </div>
        ) : loadingArticles ? (
          <div className="space-y-3 pt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-surface h-20 rounded-xl" />
              </div>
            ))}
          </div>
        ) : articlesError ? (
          <div className="flex flex-col items-center justify-center pt-16 text-center">
            <p className="text-muted text-sm">{articlesError}</p>
            <button
              type="button"
              onClick={() => void fetchArticles()}
              className="text-ink mt-3 cursor-pointer text-sm font-medium underline underline-offset-4"
            >
              重试
            </button>
          </div>
        ) : articles.length === 0 ? (
          <p className="text-muted pt-16 text-center text-sm">暂无文章</p>
        ) : (
          <div className="space-y-3">
            {articles.map((article, index) => (
              <motion.div
                key={article.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.03 }}
              >
                <Link
                  to={`/rss/articles/${article.id}`}
                  className="bg-page /60 hover:bg-surface/50 block rounded-2xl border p-4 transition-colors active:scale-[0.99]"
                >
                  <h2 className="text-ink text-[15px] leading-snug font-semibold">
                    {article.title || '无标题'}
                  </h2>
                  {article.summary && (
                    <p className="text-muted mt-1.5 line-clamp-2 text-sm leading-relaxed">
                      {article.summary}
                    </p>
                  )}
                  <div className="text-muted/70 mt-2.5 flex items-center gap-2 text-xs">
                    {article.author && <span>{article.author}</span>}
                    {article.author && article.published && (
                      <span className="bg-surface/40 h-1 w-1 rounded-full" />
                    )}
                    {article.published && (
                      <span>{formatDate(article.published)}</span>
                    )}
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 py-6 text-sm">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="text-ink disabled:text-muted flex items-center gap-1 rounded-full border px-4 py-2 font-medium transition-colors disabled:opacity-40"
            >
              上一页
            </button>
            <span className="text-muted text-xs">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="text-ink disabled:text-muted flex items-center gap-1 rounded-full border px-4 py-2 font-medium transition-colors disabled:opacity-40"
            >
              下一页
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
