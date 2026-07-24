import type { BlogDetail } from '@/features/blog/api/blogService';
import { blogService } from '@/features/blog/api/blogService';
import { TwikooComments, AiThread } from '@/components';
import { useAuthStore } from '@/features/auth';
import { useNotificationStore } from '@/stores/notificationState';
import { formatDate } from '@/lib/formatdate';
import { useOrigin } from '@/hooks/useOrigin';
import hljs from 'highlight.js/lib/common';
import 'highlight.js/styles/github.css';
import { marked } from 'marked';
import { Eye, Heart } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

function LoadingSkeleton() {
  return (
    <div className="mx-auto max-w-[42rem] px-6 py-16">
      <div className="bg-surface/70 skeleton-pulse mb-8 h-5 w-20 rounded" />
      <div className="bg-surface/70 skeleton-pulse mb-4 h-9 w-4/5 rounded" />
      <div className="bg-surface/70 skeleton-pulse mb-12 h-4 w-2/5 rounded" />
      <div className="bg-surface/70 skeleton-pulse aspect-[16/9] w-full rounded-xl" />
      <div className="mt-10 space-y-4">
        <div className="bg-surface/70 skeleton-pulse h-4 w-full rounded" />
        <div className="bg-surface/70 skeleton-pulse h-4 w-full rounded" />
        <div className="bg-surface/70 skeleton-pulse h-4 w-5/6 rounded" />
        <div className="bg-surface/70 skeleton-pulse h-4 w-full rounded" />
      </div>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="border-destructive/30 bg-destructive/5 flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="text-destructive mb-4 h-12 w-12"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
        />
      </svg>
      <p className="text-destructive text-lg font-medium">加载失败</p>
      <p className="text-muted mt-1 text-sm">{message}</p>
      <button
        onClick={onRetry}
        className="bg-destructive/90 hover:bg-destructive mt-4 cursor-pointer rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-all duration-150 active:scale-[0.96]"
      >
        重试
      </button>
    </div>
  );
}

const COPY_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`;

function setupCodeCopy(
  container: HTMLElement,
  onCopy: (msg: string) => void,
): () => void {
  const preElements = container.querySelectorAll('pre');
  const cleanups: (() => void)[] = [];

  preElements.forEach((pre) => {
    pre.style.position = 'relative';
    pre.classList.add('group');

    const btn = document.createElement('button');
    btn.innerHTML = COPY_ICON_SVG;
    btn.title = '复制';
    btn.className =
      'absolute top-2 right-2 p-1.5 rounded-md bg-surface/80 text-muted opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-surface cursor-pointer';
    btn.setAttribute('aria-label', '复制代码');

    const handleClick = () => {
      const code = pre.querySelector('code');
      if (code) {
        navigator.clipboard
          .writeText(code.textContent || '')
          .then(() => onCopy('代码已复制'))
          .catch(() => onCopy('复制失败'));
      }
    };

    btn.addEventListener('click', handleClick);
    pre.appendChild(btn);
    cleanups.push(() => {
      btn.removeEventListener('click', handleClick);
      btn.remove();
    });
  });

  return () => cleanups.forEach((fn) => fn());
}

/**
 * 阅读统计：剥离 markdown 标记后，分别计中文字符与西文词数，
 * 按 400 字/分钟（中文）+ 200 词/分钟（西文）估算阅读时长。
 * 不编造指标——无正文时返回 1 分钟 / 0 字。
 */
function readingStats(body: string): { minutes: number; count: number } {
  if (!body) return { minutes: 1, count: 0 };
  const plain = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/[#>*_~]/g, ' ')
    .replace(/\s+/g, ' ');
  const cjk = (plain.match(/[一-鿿]/g) || []).length;
  const words = (plain.replace(/[一-鿿]/g, ' ').match(/[A-Za-z0-9]+/g) || [])
    .length;
  const count = cjk + words;
  const minutes = Math.max(1, Math.round(cjk / 400 + words / 200));
  return { minutes, count };
}

/** 顶部阅读进度条：跟随窗口滚动，scaleX 0→1。 */
function ReadingProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      setProgress(max > 0 ? Math.min(1, el.scrollTop / max) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);
  return (
    <div className="bg-border/50 fixed inset-x-0 top-0 z-30 h-[2px] overflow-hidden">
      <div
        className="bg-accent h-full origin-left transition-[width] duration-150 ease-out will-change-[width]"
        style={{ width: `${progress * 100}%` }}
      />
    </div>
  );
}

export default function BlogPostView() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const notification = useNotificationStore();
  const { user, isAuthenticated } = useAuthStore();

  const [post, setPost] = useState<BlogDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // 点赞：一次性表态。服务端不做重复判定（匿名），
  // 故「是否已赞」由 localStorage 在客户端持久化，避免重复提交。
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [isLiking, setIsLiking] = useState(false);
  const likedKey = (id: string) => `readinglist:liked:${id}`;

  const showEditButton = isAuthenticated && user?.is_admin;

  // SEO: set document title
  useEffect(() => {
    if (post?.title) {
      document.title = `${post.title} - ReadingList`;
    }
    return () => {
      document.title = 'ReadingList';
    };
  }, [post?.title]);

  // Render markdown to HTML
  const renderedBody = post?.body
    ? (marked.parse(post.body, { async: false, breaks: false }) as string)
    : '';

  // 非 http(s) 开头的 src 用 https://api.kanocifer.chat 作为前缀（仅在 https 环境下生效）
  const coverSrc = post?.cover ? useOrigin(post.cover) : '';

  // 渲染正文中所有 <img src="...">，非 http(s) 开头的补上前缀
  const renderedBodyWithOrigin = renderedBody
    ? renderedBody.replace(
        /<img\s+([^>]*?)src=["']([^"']+)["']([^>]*)>/gi,
        (_match, pre: string, src: string, postAttr: string) =>
          `<img ${pre}src="${useOrigin(src)}"${postAttr}>`,
      )
    : '';

  const stats = post?.body ? readingStats(post.body) : { minutes: 1, count: 0 };
  const hasUpdate =
    !!post?.updated_at &&
    !!post?.created_at &&
    post.updated_at !== post.created_at;

  // Highlight code blocks + setup copy buttons after content renders
  useEffect(() => {
    if (contentRef.current && renderedBody) {
      hljs.highlightAll();
      const cleanup = setupCodeCopy(contentRef.current, (msg) =>
        notification.success(msg),
      );
      return cleanup;
    }
  }, [renderedBody, notification]);

  const fetchPost = useCallback(async () => {
    if (!postId) return;

    setIsLoading(true);
    setError(null);

    try {
      const service = blogService();
      const result = await service.getBlogPost(postId);
      setPost(result);
      setLikesCount(result.likes ?? 0);
      setIsLiked(localStorage.getItem(likedKey(postId)) === '1');
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载文章失败');
    } finally {
      setIsLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPost();
  }, [fetchPost]);

  const handleDelete = async () => {
    if (!postId) return;
    setShowDeleteDialog(false);
    try {
      const service = blogService();
      await service.deleteLegacyPost(postId);
      notification.success('文章删除成功');
      navigate('/blog');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '删除文章失败';
      notification.error(msg);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => notification.success('链接已复制'))
      .catch(() => notification.error('复制失败'));
  };

  // 点赞：乐观反馈 + 服务端确认。先禁、再请求，成功后以返回的最新数为准。
  const handleLike = async () => {
    if (!postId || isLiked || isLiking) return;

    setIsLiking(true);
    try {
      const service = blogService();
      const likes = await service.likePost(postId);
      setLikesCount(likes);
      setIsLiked(true);
      localStorage.setItem(likedKey(postId), '1');
      notification.success('已标记为喜欢');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '操作失败，请稍后重试';
      notification.error(msg);
    } finally {
      setIsLiking(false);
    }
  };

  return (
    <div className="bg-page min-h-dvh">
      <ReadingProgress />

      {/* 极简返回条：替代旧 Scroll 指示器，回随笔录 */}
      <div className="mx-auto max-w-[42rem] px-6 pt-10 sm:pt-14">
        <a
          onClick={() => navigate('/blog')}
          className="text-muted hover:text-ink group inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-medium tracking-wide transition-colors"
        >
          <span className="transition-transform duration-200 group-hover:-translate-x-0.5">
            ←
          </span>
          随笔录
        </a>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : error ? (
        <div className="mx-auto max-w-[42rem] px-6 py-24">
          <ErrorState message={error} onRetry={fetchPost} />
        </div>
      ) : post ? (
        <article className="mx-auto max-w-[42rem] px-6 pt-8 pb-20 sm:pt-10">
          {/* Admin actions — delete only; editor has been removed */}
          {showEditButton && (
            <div className="mb-8 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowDeleteDialog(true)}
                className="bg-destructive/10 text-destructive hover:bg-destructive/15 inline-flex cursor-pointer items-center gap-2 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-all duration-150 active:scale-[0.96]"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                  />
                </svg>
                删除
              </button>
            </div>
          )}

          {/* 刊号式元信息带：出版物气质，mono 大字距 */}
          <div className="text-muted mb-6 flex items-center justify-between border-b pb-3 font-mono text-[10px] tracking-[0.18em] uppercase">
            <span>Vol · 随笔录</span>
            <span className="text-muted/70">
              No · {post._id?.slice(-6) || '——'}
            </span>
          </div>

          {/* Eyebrow / kicker — first tag (or fallback) */}
          <div className="text-ink mb-5 flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] uppercase">
            <span className="bg-accent h-px w-5" />
            {post.tags?.[0] || '随笔'}
          </div>

          {/* Headline */}
          <h1 className="text-ink font-serif text-[clamp(1.875rem,5vw,2.5rem)] leading-[1.18] font-medium tracking-[-0.02em] text-balance">
            {post.title}
          </h1>

          {/* Deck — 阅读时长 + 字数 + 阅读量 + 可点击喜欢 */}
          <p className="text-muted mt-5 inline-flex flex-wrap items-center gap-x-1 text-[15px] leading-relaxed tracking-[0.01em] tabular-nums">
            约 {stats.minutes} 分钟阅读 · {stats.count.toLocaleString()} 字
            {post.views != null && (
              <>
                <span className="text-muted/50">·</span>
                <Eye className="h-3.5 w-3.5" />
                <span>{post.views}</span>
              </>
            )}
            {post.likes != null && (
              <>
                <span className="text-muted/50">·</span>
                <button
                  type="button"
                  aria-label={
                    isLiked
                      ? `已喜欢 · 当前 ${likesCount}`
                      : `喜欢 · 当前 ${likesCount}`
                  }
                  disabled={isLiked || isLiking}
                  onClick={handleLike}
                  className={`inline-flex cursor-pointer items-center gap-1 rounded transition-colors duration-150 active:scale-[0.96] disabled:cursor-default ${
                    isLiked ? 'text-ink' : 'text-muted hover:text-ink'
                  }`}
                >
                  <Heart
                    className={`h-3.5 w-3.5 transition-all duration-150 ${
                      isLiked ? 'fill-accent' : ''
                    }`}
                  />
                  <span>{likesCount}</span>
                </button>
              </>
            )}
          </p>

          {/* Byline / dateline */}
          <div className="text-muted mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] tracking-[0.02em]">
            {post.author && (
              <span className="text-ink/80 font-medium">{post.author}</span>
            )}
            {post.author && post.created_at && (
              <span className="bg-border h-3 w-px" />
            )}
            {post.created_at && (
              <time dateTime={post.created_at}>
                {formatDate(post.created_at, 'YYYY-MM-DD')}
              </time>
            )}
            {hasUpdate && (
              <>
                <span className="bg-border h-3 w-px" />
                <span>更新于 {formatDate(post.updated_at!, 'YYYY-MM-DD')}</span>
              </>
            )}
          </div>

          {/* 封面置顶：主视觉先行 */}
          {post.cover && (
            <figure className="mt-10 mb-10 overflow-hidden rounded-xl">
              <div className="bg-surface aspect-[16/9] w-full overflow-hidden">
                <img
                  src={coverSrc}
                  alt={`${post.title} 封面`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  style={{ boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)' }}
                />
              </div>
              <figcaption className="text-muted mt-2.5 text-[11px] tracking-[0.04em]">
                封面 · {post.tags?.[0] || 'ReadingList'}
              </figcaption>
            </figure>
          )}

          {/* 正文 */}
          <div className="prose prose-lg max-w-none">
            <AiThread title={post?.title} content={post?.body || ''} />
            <div ref={contentRef} className="prose-body whitespace-pre-wrap">
              {renderedBodyWithOrigin ? (
                <div
                  dangerouslySetInnerHTML={{
                    __html: renderedBodyWithOrigin,
                  }}
                />
              ) : (
                <p className="text-muted italic">暂无内容</p>
              )}
            </div>
          </div>

          {/* 文章脚：作者署名块 + 复制链接 */}
          <footer className="mt-14 border-t pt-8">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="flex items-center gap-3.5">
                <span className="text-ink ring-border bg-surface flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-serif text-sm font-semibold ring-1">
                  {(post.author || 'K').slice(0, 1)}
                </span>
                <div className="min-w-0">
                  <div className="text-ink text-[14px] font-medium tracking-wide">
                    {post.author || 'Kurroome'}
                  </div>
                  <div className="text-muted mt-0.5 text-[12px] tracking-[0.02em]">
                    {hasUpdate
                      ? `最后更新于 ${formatDate(post.updated_at!, 'YYYY-MM-DD')}`
                      : post.created_at
                        ? `发布于 ${formatDate(post.created_at, 'YYYY-MM-DD')}`
                        : ''}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyLink}
                className="text-muted hover:text-ink inline-flex cursor-pointer items-center gap-1.5 text-[12px] font-medium tracking-[0.02em] transition-all duration-150 active:scale-[0.96]"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.8"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
                  />
                </svg>
                复制链接
              </button>
            </div>
          </footer>

          {/* Comments */}
          <div className="mt-10">
            <TwikooComments path={`/blog/${postId}`} />
          </div>
        </article>
      ) : null}

      {/* Delete confirmation dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="bg-ink/80 fixed inset-0 backdrop-blur-sm"
            onClick={() => setShowDeleteDialog(false)}
          />
          <div className="bg-page relative w-full max-w-sm rounded-2xl border p-6 shadow-lg">
            <h3 className="text-ink text-lg font-semibold">确认删除</h3>
            <p className="text-muted mt-2 text-sm">
              确定要删除这篇文章吗？此操作无法撤销。
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteDialog(false)}
                className="bg-surface text-ink hover:bg-surface/80 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-150 active:scale-[0.96]"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                className="bg-destructive hover:bg-destructive/90 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-all duration-150 active:scale-[0.96]"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
