import { BlogListItem } from './components/BlogListItem';
import type { BlogListItem as BlogListItemType } from '@/features/blog/api/blogService';
import { blogService } from '@/features/blog/api/blogService';
import { BentoCalendar, BentoProfile } from '@/features/home';
import type { BlogPagination as BlogPaginationType, TagItem } from '@/types';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BlogEmptyState } from './components/BlogEmptyState';
import { BlogErrorState } from './components/BlogErrorState';
import { BlogLoadingSkeleton } from './components/BlogLoadingSkeleton';
import { CategorySidebar } from './components/CategorySidebar';

export default function BlogListView() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [posts, setPosts] = useState<BlogListItemType[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [pagination, setPagination] = useState<BlogPaginationType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState(
    searchParams.get('search') || '',
  );
  const [activeTag, setActiveTag] = useState<string | null>(
    searchParams.get('tag'),
  );
  const [currentPage, setCurrentPage] = useState(
    parseInt(searchParams.get('page') || '1', 10) || 1,
  );

  const listRef = useRef<HTMLDivElement>(null);

  // 分页段：数字 / 省略号 混合序列
  // 1 与最末页始终显示；当前页 ±1 范围显示；其余位置用省略号补齐
  const pageSegments = useMemo<(number | 'ellipsis')[]>(() => {
    if (!pagination) return [];
    const total = pagination.pages;
    const current = pagination.page;
    if (total <= 1) return [1];

    const set = new Set<number>([1, total]);
    for (let i = current - 1; i <= current + 1; i++) {
      if (i >= 1 && i <= total) set.add(i);
    }
    const sorted = [...set].sort((a, b) => a - b);

    const out: (number | 'ellipsis')[] = [];
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push('ellipsis');
      out.push(sorted[i]);
    }
    return out;
  }, [pagination]);

  const fetchPosts = useCallback(
    async (page: number = 1, tag?: string | null) => {
      setIsLoading(true);
      setError(null);

      try {
        const service = blogService();
        const search = searchParams.get('search') || undefined;

        if (tag) {
          const result = await service.getPostsByTag(tag);
          setPosts(
            result.posts.map((post) => ({
              _id: post._id,
              title: post.title,
              body: post.body,
              summary: post.summary || '',
              cover: post.cover,
              tags: post.tags || [],
              is_pinned: false,
              views: post.views,
              created_at: post.created_at,
              updated_at: post.updated_at,
            })),
          );
          setPagination(null);
        } else {
          const result = await service.getBlogs({ page, search });
          setPosts(result.posts);
          setTags(result.tags);
          setPagination(result.pagination);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载文章列表失败');
      } finally {
        setIsLoading(false);
      }
    },
    [searchParams],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPosts(currentPage, activeTag);
  }, [fetchPosts, currentPage, activeTag]);

  // SEO: 文学手账头部文案
  const heroTitle = activeTag ? `卷·${activeTag}` : '随笔录';
  const heroSubtitle = activeTag
    ? `Selected essays tagged "${activeTag}"`
    : 'Essays on reading, thinking & quiet days';

  useEffect(() => {
    document.title = activeTag
      ? `${activeTag} - ReadingList 随笔录`
      : 'ReadingList 随笔录 - 阅读 · 思考 · 慢时光';
    const metaDesc =
      activeTag && document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute(
        'content',
        activeTag
          ? `阅读 ${activeTag} 标签下的所有文章 - 个人阅读心得、技术分享、读书笔记`
          : 'ReadingList 随笔录 - 分享个人阅读心得、技术文章、读书笔记，记录阅读的美好时光',
      );
    }
    return () => {
      document.title = 'ReadingList';
    };
  }, [activeTag]);

  // 标题 parallax 效果 — 与 Vue BasicDetail 同源
  const [scrollY, setScrollY] = useState(() => window.scrollY);
  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleSearch = () => {
    const newParams = new URLSearchParams(searchParams);
    if (searchQuery) {
      newParams.set('search', searchQuery);
    } else {
      newParams.delete('search');
    }
    newParams.set('page', '1');
    newParams.delete('tag');
    setSearchParams(newParams);
    setCurrentPage(1);
    setActiveTag(null);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('search');
    newParams.set('page', '1');
    setSearchParams(newParams);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', page.toString());
    newParams.set('search', searchQuery);
    if (!searchQuery) newParams.delete('search');
    setSearchParams(newParams);
    setCurrentPage(page);
    // 滚到列表顶部锚点
    const anchor = document.getElementById('blog-list-top');
    if (anchor) {
      const top = anchor.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  const handleTagSelect = (tag: string | null) => {
    setActiveTag(tag);
    setCurrentPage(1);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('search');
    newParams.set('page', '1');
    if (tag !== null) {
      newParams.set('tag', tag);
    } else {
      newParams.delete('tag');
    }
    setSearchParams(newParams);
  };

  const handleResetFilter = () => {
    handleTagSelect(null);
    setSearchQuery('');
  };

  const handleRetry = () => {
    fetchPosts(currentPage, activeTag);
  };

  return (
    <div className="bg-page min-h-dvh">
      {/* ──────────────────────────────────────────────────────────── */}
      {/*  BasicDetail 风格 hero：parallax 标题 + subtitle           */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="relative mx-0 mt-60 flex flex-col items-center justify-center max-sm:mt-30">
        <div
          style={{ transform: `translateY(${scrollY * 0.3}px)` }}
          className="will-change-transform"
        >
          <h1 className="text-ink max-w-6xl text-center font-serif text-7xl max-sm:text-3xl">
            {heroTitle}
          </h1>
          <div className="text-muted mt-4 flex flex-wrap items-center justify-center gap-4 text-sm">
            <span className="bg-secondary text-muted inline-block rounded-full px-2 py-0.5 text-xs font-medium">
              {heroSubtitle}
            </span>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 工具栏：搜索 + 分类 chip */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-6xl px-4 pt-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-md sm:flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                className="text-muted h-4 w-4"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
            </div>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="在字里行间，寻一句心动…"
              aria-label="搜索文章"
              className="text-ink placeholder:text-muted/70 focus:border-accent focus:ring-accent/20 bg-page w-full rounded-xl border py-3 pr-10 pl-10 font-serif text-sm placeholder:font-serif placeholder:italic focus:ring-2 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="清空搜索"
                className="text-muted hover:text-ink absolute inset-y-0 right-0 flex items-center pr-3"
                onClick={handleClearSearch}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 sm:ml-auto">
            {/* 当前分类 chip：章节章 */}
            {activeTag && (
              <button
                type="button"
                className="bg-page text-muted hover:bg-surface hover:text-ink inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
                onClick={handleResetFilter}
              >
                <span className="text-ink/70 font-serif italic">#</span>
                <span className="font-serif">{activeTag}</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                <span className="sr-only">清除分类筛选</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Main Content */}
          <div className="min-w-0 flex-1">
            {/* 列表顶部锚点：翻页时滚到这里 */}
            <div id="blog-list-top" aria-hidden="true" />

            {/* ────────────────────────────────────────────────── */}
            {/* 卷一 · 章节目录头 */}
            {/* ────────────────────────────────────────────────── */}
            <div className="mb-6 flex items-end justify-between gap-4 pb-3">
              <div className="flex items-baseline gap-3">
                <span className="text-muted font-mono text-[10px] tracking-[0.4em] uppercase">
                  Volume · 壹
                </span>
                <h2 className="text-ink font-serif text-base font-semibold sm:text-lg">
                  {activeTag ? (
                    <>
                      <span className="text-ink/70 mr-1">#</span>
                      {activeTag}
                    </>
                  ) : (
                    '近期文章'
                  )}
                </h2>
              </div>
              <div className="text-muted/70 flex items-center gap-1.5">
                <div className="bg-accent/40 h-px w-6" />
                <span className="font-mono text-[10px] tracking-[0.2em] uppercase">
                  {activeTag ? 'Category' : 'Recent'}
                </span>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <BlogLoadingSkeleton />
                </motion.div>
              ) : error ? (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <BlogErrorState message={error} onRetry={handleRetry} />
                </motion.div>
              ) : posts.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <BlogEmptyState
                    hasTag={activeTag !== null}
                    onReset={activeTag ? handleResetFilter : undefined}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key={currentPage}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="space-y-5"
                  ref={listRef}
                >
                  {posts.map((post, index) => (
                    <BlogListItem key={post._id} post={post} index={index} />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Pagination: 统一算法，gap ≥ 2 时自动插入省略号 */}
            {!isLoading && !error && pagination && pagination.pages > 1 && (
              <nav className="mt-10" aria-label="博客分页">
                <ul className="/80 bg-page/90 mx-auto inline-flex w-full max-w-full items-center justify-center gap-1 rounded-2xl border p-1.5 shadow-sm backdrop-blur-sm sm:w-fit sm:gap-2">
                  <li>
                    <button
                      type="button"
                      disabled={!pagination?.has_prev}
                      aria-disabled={!pagination?.has_prev}
                      className={`focus-visible:ring-ring inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${
                        pagination?.has_prev
                          ? 'text-muted hover:bg-surface hover:text-ink'
                          : 'text-muted/50 cursor-not-allowed'
                      }`}
                      onClick={() => handlePageChange(pagination!.prev_num!)}
                    >
                      <span aria-hidden="true" className="text-base">
                        ‹
                      </span>
                      <span className="hidden sm:inline">上一页</span>
                    </button>
                  </li>

                  {pageSegments.map((item, i) =>
                    item === 'ellipsis' ? (
                      <li key={`ell-${i}`}>
                        <span
                          className="text-muted/60 px-1 text-sm select-none"
                          aria-hidden="true"
                        >
                          …
                        </span>
                      </li>
                    ) : (
                      <li key={item}>
                        <button
                          type="button"
                          aria-current={
                            item === pagination?.page ? 'page' : undefined
                          }
                          className={`focus-visible:ring-ring inline-flex h-9 min-w-9 items-center justify-center rounded-xl px-3 text-sm font-semibold transition-all duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${
                            item === pagination?.page
                              ? 'bg-accent text-ink'
                              : 'text-muted hover:bg-surface hover:text-ink'
                          }`}
                          onClick={() => handlePageChange(item)}
                        >
                          {item}
                        </button>
                      </li>
                    ),
                  )}

                  <li>
                    <button
                      type="button"
                      disabled={!pagination?.has_next}
                      aria-disabled={!pagination?.has_next}
                      className={`focus-visible:ring-ring inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${
                        pagination?.has_next
                          ? 'text-muted hover:bg-surface hover:text-ink'
                          : 'text-muted/50 cursor-not-allowed'
                      }`}
                      onClick={() => handlePageChange(pagination!.next_num!)}
                    >
                      <span className="hidden sm:inline">下一页</span>
                      <span aria-hidden="true" className="text-base">
                        ›
                      </span>
                    </button>
                  </li>
                </ul>
              </nav>
            )}
          </div>

          {/* Sidebar — HomeSideBar Style */}
          <div className="w-full shrink-0 lg:hidden">
            <div className="sticky top-24 h-fit space-y-6">
              <BentoProfile />
              <BentoCalendar />
              <div className="hidden lg:block">
                <CategorySidebar
                  tags={tags}
                  activeTag={activeTag}
                  onSelectTag={handleTagSelect}
                  isLoading={isLoading && tags.length === 0}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ──────────────────────────────────────────────────────────── -->
        {/* 底部装饰：ka·no·ci·fer */}
        {/* ──────────────────────────────────────────────────────────── */}
        <div className="text-muted /50 mt-12 flex items-center justify-between border-t pt-4 font-mono text-[10px] tracking-[0.2em] uppercase">
          <span>Essays · 卷一</span>
          <span className="font-serif tracking-normal normal-case italic">
            ka·no·ci·fer
          </span>
        </div>
      </div>
    </div>
  );
}
