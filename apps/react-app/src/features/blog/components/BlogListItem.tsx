import type { BlogListItem } from '@/features/blog/api/blogService';
import { formatDate } from '@/lib/formatdate';
import { motion } from 'framer-motion';
import { Clock, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BlogCover } from './BlogCover';

interface BlogListItemProps {
  post: BlogListItem;
  index: number;
}

/** 中文按字符算阅读时间，约 300 字/分钟；纯 markdown 内容先剥标签 */
function plainText(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, '')
    .replace(/[#*_`>\-![\]()~]/g, '')
    .trim();
}

function useReadingInfo(post: BlogListItem) {
  const text = plainText(post.body || '');
  const charCount = [...text].length;
  const wordCountText =
    charCount >= 1000
      ? `${(charCount / 1000).toFixed(1)}k 字`
      : `${charCount} 字`;
  const readingTimeMinutes = Math.max(1, Math.round(charCount / 300));
  return { charCount, wordCountText, readingTimeMinutes };
}

export function BlogListItem({ post, index }: BlogListItemProps) {
  const isFeatured = index === 0;
  const { wordCountText, readingTimeMinutes } = useReadingInfo(post);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', duration: 0.5 }}
      viewport={{ once: true }}
    >
      <Link
        to={`/blog/${post._id}`}
        className="group block focus-visible:outline-none"
      >
        <article
          className={[
            '/40 bg-page group-hover:border-accent/30 relative overflow-hidden rounded-2xl border p-5 shadow-sm transition-all duration-500 ease-out',
            'group-hover:-translate-y-0.5',
            isFeatured ? 'sm:p-7' : '',
          ].join(' ')}
        >
          {/* Left book-spine accent — scales up on hover */}
          <div
            className="bg-accent absolute top-0 left-0 h-full w-[3px] origin-top scale-y-0 transition-transform duration-500 ease-out group-hover:scale-y-100"
            aria-hidden="true"
          />

          <div
            className={[
              'flex gap-5 sm:gap-7',
              isFeatured ? 'sm:gap-9' : '',
            ].join(' ')}
          >
            {/* 封面：杂志感 3:4；featured 用 lg，其余 md */}
            <div
              className={[
                'shrink-0',
                isFeatured ? 'sm:w-56 lg:w-64' : 'w-32 sm:w-44',
              ].join(' ')}
            >
              <BlogCover
                cover={post.cover ?? null}
                title={post.title}
                seed={post._id}
                categoryName={post.tags?.[0]}
                size={isFeatured ? 'lg' : 'md'}
              />
            </div>

            {/* 文字区 */}
            <div className="flex min-w-0 flex-1 flex-col">
              {/* 顶部元数据：置顶 / 分类 / 日期 */}
              <div className="text-muted mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px]">
                {post.is_pinned && (
                  <span className="bg-accent/15 text-ink inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-3 w-3"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                    </svg>
                    置顶
                  </span>
                )}
                {post.tags?.length && (
                  <span className="text-ink/70 inline-flex items-center gap-1 font-medium">
                    <span className="text-ink/70 font-serif">#</span>
                    {post.tags[0]}
                  </span>
                )}
                <span className="text-border" aria-hidden="true">
                  ·
                </span>
                <time className="tabular-nums" dateTime={post.created_at}>
                  {formatDate(post.created_at)}
                </time>
              </div>

              {/* 标题：衬线大字 */}
              <h2
                className={[
                  'text-ink group-hover:text-ink font-serif leading-snug font-semibold transition-colors duration-300 ease-out',
                  isFeatured ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl',
                ].join(' ')}
                style={{ textWrap: 'balance' }}
              >
                {post.title}
              </h2>

              {/* 装饰小线：featured 走「— 篇 —」章回标，普通细线 */}
              {isFeatured ? (
                <div className="mt-3 flex items-center gap-2">
                  <div className="bg-accent/40 h-px w-8" />
                  <span className="text-muted font-serif text-[11px] tracking-[0.2em] italic">
                    篇
                  </span>
                  <div className="bg-accent/40 h-px w-8" />
                </div>
              ) : (
                <div
                  className="bg-border group-hover:bg-accent/30 my-2.5 h-px w-10 transition-all duration-500 ease-out group-hover:w-16"
                  aria-hidden="true"
                />
              )}

              {/* 摘要 */}
              {post.summary ? (
                <p
                  className={[
                    'text-ink/75 leading-relaxed',
                    isFeatured
                      ? 'mt-1 line-clamp-3 text-sm sm:line-clamp-4 sm:text-[15px]'
                      : 'line-clamp-2 text-sm',
                  ].join(' ')}
                >
                  {post.summary}
                </p>
              ) : (
                <p
                  className={[
                    'text-ink/35 italic',
                    isFeatured ? 'mt-1 text-sm' : 'text-xs',
                  ].join(' ')}
                >
                  （暂无摘要）
                </p>
              )}

              {/* Footer meta: 阅读时长 / 字数 / 浏览量 */}
              <footer className="text-ink/55 mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-4 text-xs">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{readingTimeMinutes} 分钟</span>
                </span>
                {post.views != null && (
                  <>
                    <span className="text-border" aria-hidden="true">
                      ·
                    </span>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Eye className="h-3.5 w-3.5" />
                      {post.views}
                    </span>
                  </>
                )}
                <>
                  <span className="text-border" aria-hidden="true">
                    ·
                  </span>
                  <span className="tabular-nums">{wordCountText}</span>
                </>
              </footer>
            </div>
          </div>
        </article>
      </Link>
    </motion.div>
  );
}
