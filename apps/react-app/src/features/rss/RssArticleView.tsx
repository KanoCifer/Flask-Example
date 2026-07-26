import { AiThread } from '@/components';
import { rssService } from '@/features/rss/api/rssService';
import { useNotificationStore } from '@/stores/notificationState';
import type { RssArticle } from '@/types';
import { formatDate } from '@/lib/formatdate';
import DOMPurify from 'dompurify';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

function rewriteImageUrls(doc: Document, base: string): void {
  doc.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src');
    if (!src) return;
    let resolved = src;
    try {
      resolved = new URL(src, base).toString();
    } catch {
      resolved = src;
    }
    img.setAttribute(
      'src',
      `/v1/rss/image-proxy?url=${encodeURIComponent(resolved)}`,
    );
  });
}

export default function RssArticleView() {
  const { articleId } = useParams<{ articleId: string }>();
  const notifier = useNotificationStore();
  const service = useMemo(() => rssService(), []);

  const [article, setArticle] = useState<RssArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchArticle = useCallback(async () => {
    if (!articleId) return;
    setLoading(true);
    setError(null);
    try {
      setArticle(await service.getArticle(articleId));
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载文章失败';
      setError(message);
      notifier.error(message);
    } finally {
      setLoading(false);
    }
  }, [articleId, notifier, service]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchArticle();
  }, [fetchArticle]);

  const html = useMemo(() => {
    const raw = article?.content || article?.summary || '';
    if (!raw) return '';
    const base = article?.link || article?.feed_url || window.location.origin;
    const doc = new DOMParser().parseFromString(raw, 'text/html');
    rewriteImageUrls(doc, base);
    return DOMPurify.sanitize(doc.body.innerHTML);
  }, [article]);

  const pureContent = useMemo(() => {
    const raw = article?.content || article?.summary || '';
    if (!raw) return '';
    const doc = new DOMParser().parseFromString(raw, 'text/html');
    return doc.body.textContent || '';
  }, [article]);

  return (
    <div className="bg-page min-h-dvh pb-28">
      <header className="bg-page/85 sticky top-0 z-10 h-15 px-4 py-3 backdrop-blur-md"></header>
      <main className="mx-auto w-full max-w-dvw px-4 py-4">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.p
              key="l"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              加载中...
            </motion.p>
          ) : error ? (
            <motion.p
              key="e"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-destructive"
            >
              {error}
            </motion.p>
          ) : article ? (
            <motion.article
              key="c"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <h1 className="text-ink text-2xl font-bold">{article.title}</h1>
              <p className="text-muted mt-1 mb-4 text-xs">
                {article.author ? `作者：${article.author} · ` : ''}
                {formatDate(article.published)}
              </p>

              {/* AI总结卡片 */}
              <AiThread title={article.title} content={pureContent} />

              <div
                className="prose prose-sm bg-page ring-border mt-4 max-w-none rounded-2xl p-4 ring-1"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </motion.article>
          ) : null}
        </AnimatePresence>
      </main>
    </div>
  );
}
