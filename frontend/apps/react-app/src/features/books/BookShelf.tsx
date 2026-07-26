import type { WereadUserBook } from '@/features/books/api/wereadGateway';
import {
  useReadStatsStore,
  selectWeeklySnapshot,
} from '@/features/books/stores/readStatsStore';
import { wereadService } from '@/features/books/api/wereadService';
import { ArrowLeft, ExternalLink, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '0';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function BookShelf() {
  const navigate = useNavigate();
  const [books, setBooks] = useState<WereadUserBook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const statsStore = useReadStatsStore();
  const weeklySnapshot = useReadStatsStore(selectWeeklySnapshot);

  const latestBook = weeklySnapshot?.readLongest?.[0] ?? null;

  const visibleBooks = books.filter((b) => !b.secret);

  const fetchBooks = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await wereadService.getUserShelf();
      if (res.data) {
        setBooks(res.data.user_books);
      } else {
        throw new Error(res.message || '获取书架失败');
      }
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      setErrorMessage(
        error?.response?.data?.message || error?.message || '获取书架失败',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      await wereadService.syncMyBooks();
      await fetchBooks();
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      setErrorMessage(
        error?.response?.data?.message || error?.message || '同步失败',
      );
    } finally {
      setIsSyncing(false);
    }
  }, [fetchBooks]);

  const handleBack = useCallback(() => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  }, [navigate]);

  const handleBookClick = useCallback((bookId: string) => {
    const link = document.createElement('a');
    link.href = `weread://reading?bId=${bookId}`;
    link.click();
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    Promise.all([fetchBooks(), statsStore.fetchStats()]);
  }, [fetchBooks, statsStore]);

  return (
    <div className="bg-page flex min-h-[calc(100dvh-4rem)] flex-col">
      {/* Hero Image Section */}
      <div className="relative h-[40vh] flex-shrink-0 overflow-hidden md:h-[45vh]">
        <img
          src="/card/card-1.jpeg"
          alt=""
          className="h-full w-full object-cover"
        />
        <div className="from-page/40 via-page/5 to-page pointer-events-none absolute inset-0 bg-gradient-to-b" />

        {/* Back Button */}
        <div className="absolute top-0 right-0 left-0 z-10 flex items-center px-4 py-4 md:px-6">
          <button
            type="button"
            className="bg-page/60 hover:bg-surface flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-md transition-colors"
            onClick={handleBack}
            aria-label="返回"
          >
            <ArrowLeft className="text-ink h-5 w-5" />
          </button>
        </div>

        {/* Sync Button */}
        <div className="absolute top-0 right-0 z-10 flex items-center px-4 py-4 md:px-6">
          <button
            type="button"
            className="bg-page/60 hover:bg-surface flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-md transition-colors disabled:opacity-50"
            disabled={isSyncing}
            onClick={handleSync}
            aria-label="同步书架"
          >
            <RefreshCw
              className={`text-ink h-5 w-5 ${isSyncing ? 'animate-spin' : ''}`}
            />
          </button>
        </div>

        {/* Title Overlay */}
        <div className="absolute right-0 bottom-0 left-0 z-10 px-6 pb-6 md:px-10 md:pb-8">
          <h1 className="font-serif text-3xl font-bold text-white drop-shadow-lg md:text-5xl">
            我的书架
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <span className="text-sm text-white/75 md:text-base">微信读书</span>
            <span className="h-1 w-1 rounded-full bg-white/40" />
            {!isLoading && (
              <span className="text-sm text-white/75 md:text-base">
                {visibleBooks.length} 本书
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats Summary Bar */}
      {weeklySnapshot && (
        <div
          className="bg-page mx-auto mt-6 mb-4 w-[calc(100%-2rem)] max-w-6xl cursor-pointer rounded-2xl border p-4 shadow-sm transition-shadow hover:shadow-md sm:px-6 md:mt-8 md:mb-6 md:px-10"
          onClick={() => navigate('/bookshelf/stats')}
        >
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex-1">
              <p className="text-muted mb-1 text-xs">本周阅读</p>
              <p className="text-ink text-xl font-bold">
                {formatDuration(weeklySnapshot.totalReadTime)}
              </p>
            </div>
            <div className="bg-border h-10 w-px" />
            <div className="flex-1">
              <p className="text-muted mb-1 text-xs">阅读天数</p>
              <p className="text-ink text-xl font-bold">
                {weeklySnapshot.readDays ?? 0}
                <span className="text-muted text-xs font-normal">天</span>
              </p>
            </div>
            <div className="bg-border hidden h-10 w-px sm:block" />
            {latestBook && (
              <div className="hidden min-w-0 flex-1 items-center gap-3 sm:flex">
                {latestBook.book?.cover && (
                  <img
                    src={latestBook.book?.cover}
                    alt={latestBook.book?.title ?? ''}
                    className="h-12 w-9 flex-shrink-0 rounded object-cover shadow-sm"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-muted mb-0.5 text-xs">最近在读</p>
                  <p className="text-ink truncate text-sm font-medium">
                    {latestBook.book?.title}
                  </p>
                </div>
              </div>
            )}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
              className="text-muted h-5 w-5 flex-shrink-0"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.25 4.5l7.5 7.5-7.5 7.5"
              />
            </svg>
          </div>
        </div>
      )}

      {/* Books Section */}
      <div className="flex-1 pb-8">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:px-10">
          {/* Loading skeleton */}
          {isLoading && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="bg-surface aspect-3/4 rounded-xl" />
                  <div className="mt-2 space-y-1.5 px-1.5">
                    <div className="bg-surface h-3 w-5/6 rounded" />
                    <div className="bg-surface h-3 w-3/4 rounded" />
                    <div className="bg-surface h-2.5 w-1/2 rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error state */}
          {!isLoading && errorMessage && (
            <div className="flex flex-col items-center justify-center py-20">
              <p className="text-destructive mb-4 text-center text-sm">
                {errorMessage}
              </p>
              <button
                type="button"
                className="bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-xl px-5 py-2 text-sm font-medium transition-colors"
                onClick={fetchBooks}
              >
                重试
              </button>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !errorMessage && visibleBooks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20">
              <p className="text-muted font-medium">暂无书籍</p>
              <p className="text-muted/60 mt-1 text-sm">
                你的微信读书书架还是空的
              </p>
            </div>
          )}

          {/* Books grid */}
          {!isLoading && !errorMessage && visibleBooks.length > 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {visibleBooks.map((book, index) => (
                <a
                  key={book.bookId}
                  href={`weread://reading?bId=${book.bookId}`}
                  className="group block"
                  onClick={(e) => {
                    e.preventDefault();
                    handleBookClick(book.bookId);
                  }}
                >
                  <div
                    className="bg-page hover:shadow-accent/5 relative overflow-hidden rounded-xl shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <div className="relative aspect-3/4 overflow-hidden">
                      {book.cover ? (
                        <img
                          src={book.cover}
                          alt={book.title}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              'none';
                          }}
                        />
                      ) : (
                        <div className="bg-surface flex h-full w-full items-center justify-center">
                          <span className="text-muted/40 font-serif text-2xl">
                            {book.title.slice(0, 1)}
                          </span>
                        </div>
                      )}

                      {/* Hover overlay with open icon */}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-300 group-hover:bg-black/30">
                        <div className="bg-page/90 text-ink flex h-10 w-10 items-center justify-center rounded-full opacity-0 shadow-lg backdrop-blur-sm transition-all duration-300 group-hover:opacity-100">
                          <ExternalLink className="h-5 w-5" />
                        </div>
                      </div>

                      {book.finishReading && (
                        <div className="bg-success/90 absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-medium text-white">
                          已读
                        </div>
                      )}
                    </div>
                    <div className="px-1.5 py-2">
                      <p
                        className="text-ink line-clamp-2 text-xs leading-snug font-medium"
                        title={book.title}
                      >
                        {book.title}
                      </p>
                      <p
                        className="text-muted mt-1 truncate text-[11px] leading-snug"
                        title={book.author}
                      >
                        {book.author}
                      </p>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
