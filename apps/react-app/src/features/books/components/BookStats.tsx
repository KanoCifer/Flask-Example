import {
  useReadStatsStore,
  selectSnapshotByMode,
  selectSnapshots,
} from '@/features/books/stores/readStatsStore';
import ReactEChartsCore from 'echarts-for-react';
import { HeatmapChart, LineChart, BarChart, PieChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  VisualMapComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { ArrowLeft, ArrowRight, RefreshCw, Star } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

dayjs.extend(isoWeek);

echarts.use([
  TooltipComponent,
  GridComponent,
  LegendComponent,
  VisualMapComponent,
  LineChart,
  BarChart,
  PieChart,
  HeatmapChart,
  CanvasRenderer,
]);

type ModeKey = 'weekly' | 'monthly' | 'annually' | 'overall';

const MODES: { key: ModeKey; label: string }[] = [
  { key: 'weekly', label: '本周' },
  { key: 'monthly', label: '本月' },
  { key: 'annually', label: '本年' },
  { key: 'overall', label: '累计' },
];

const PALETTE = [
  '#3b82f6',
  '#34d399',
  '#f97316',
  '#06b6d4',
  '#ec4899',
  '#22c55e',
  '#eab308',
  '#8b5cf6',
];

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '0';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatCompare(val: number | null): string {
  if (val == null) return '--';
  const pct = (val * 100).toFixed(1);
  return val >= 0 ? `+${pct}%` : `${pct}%`;
}

function formatTimestamp(ts: string): string {
  const d = dayjs.unix(Number(ts));
  if (!d.isValid()) return ts;
  return d.format('MM/DD');
}

function ratingScore(v: number): string {
  if (!v || v <= 0) return '--';
  return ((v / 100) * 10).toFixed(1);
}

function readingCountLabel(n: number): string {
  if (!n || n <= 0) return '';
  if (n >= 10000) return `${(n / 10000).toFixed(1)} 万人在读`;
  return `${n} 人在读`;
}

interface RecommendSectionProps {
  books: import('@/features/books/api/wereadGateway').BookRecommendItem[];
  loading: boolean;
  hasMore: boolean;
  error: string;
  onRefresh: () => void;
  onLoadMore: () => void;
}

function RecommendSection({
  books,
  loading,
  hasMore,
  error,
  onRefresh,
  onLoadMore,
}: RecommendSectionProps) {
  const showSkeleton = loading && books.length === 0;
  return (
    <div className="bg-page mb-6 rounded-xl p-4 sm:p-6">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-muted mb-1 text-xs">读完这些之后</p>
          <h3 className="text-ink font-serif text-lg font-semibold tracking-tight sm:text-xl">
            接下来读什么
          </h3>
        </div>
        <button
          type="button"
          className="text-muted hover:text-ink hover:bg-surface inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          disabled={loading}
          onClick={onRefresh}
          aria-label="换一批"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
          />
          换一批
        </button>
      </div>

      {showSkeleton ? (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex w-40 flex-shrink-0 animate-pulse flex-col gap-2"
            >
              <div className="bg-surface aspect-[2/3] w-full rounded-md" />
              <div className="bg-surface h-3 w-3/4 rounded" />
              <div className="bg-surface h-3 w-1/2 rounded" />
            </div>
          ))}
        </div>
      ) : error && books.length === 0 ? (
        <div className="text-muted flex flex-col items-center justify-center rounded-xl border border-dashed py-8 text-center text-sm">
          <p className="text-destructive mb-2">{error}</p>
          <button
            type="button"
            className="bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-lg px-3 py-1 text-xs font-medium transition-colors"
            onClick={onRefresh}
          >
            重试
          </button>
        </div>
      ) : !loading && books.length === 0 ? (
        <div className="text-muted rounded-xl border border-dashed py-8 text-center text-sm">
          暂时没有推荐
        </div>
      ) : (
        <div
          className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6"
          style={{ scrollPaddingInline: '1rem' }}
        >
          {books.map((book) => (
            <a
              key={book.bookId}
              href={`https://weread.qq.com/web/reader/${book.bookId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-page hover:border-accent/40 flex w-40 flex-shrink-0 snap-start flex-col gap-2 rounded-xl border border-transparent p-2 transition-colors"
            >
              <div className="bg-surface relative aspect-[2/3] w-full overflow-hidden rounded-md shadow-sm">
                {book.cover && (
                  <img
                    src={book.cover}
                    alt={book.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                )}
                {book.newRating > 0 && (
                  <span className="bg-page/80 text-ink absolute top-1.5 right-1.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums backdrop-blur-md">
                    <Star className="text-ink h-2.5 w-2.5 fill-current" />
                    {ratingScore(book.newRating)}
                  </span>
                )}
              </div>
              <p className="text-ink line-clamp-2 font-serif text-sm leading-tight">
                {book.title}
              </p>
              {book.author && (
                <p className="text-muted truncate text-[11px]">{book.author}</p>
              )}
              {book.reason && (
                <p className="text-muted line-clamp-2 text-[11px] leading-relaxed">
                  {book.reason}
                </p>
              )}
              {book.readingCount > 0 && (
                <p className="text-muted/80 mt-auto text-[10px] tabular-nums">
                  {readingCountLabel(book.readingCount)}
                </p>
              )}
            </a>
          ))}

          {hasMore && (
            <button
              type="button"
              className="text-muted hover:text-ink hover:border-accent/40 flex w-28 flex-shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-xs transition-colors disabled:opacity-50"
              disabled={loading}
              onClick={onLoadMore}
            >
              <ArrowRight
                className={`h-4 w-4 ${loading ? 'animate-pulse' : ''}`}
              />
              <span>{loading ? '加载中…' : '更多'}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function BookStats() {
  const navigate = useNavigate();
  const [activeMode, setActiveMode] = useState<ModeKey>('weekly');
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark'),
  );

  const { isLoading, error, fetchStats } = useReadStatsStore();
  const snapshots = useReadStatsStore(selectSnapshots);
  const snapshotByMode = useReadStatsStore(selectSnapshotByMode);
  const activeSnapshot = snapshotByMode[activeMode] ?? null;

  // 推荐
  const recommends = useReadStatsStore((s) => s.recommends);
  const isLoadingRecommends = useReadStatsStore((s) => s.isLoadingRecommends);
  const recommendError = useReadStatsStore((s) => s.recommendError);
  const hasMoreRecommends = useReadStatsStore((s) => s.hasMoreRecommends);
  const fetchRecommends = useReadStatsStore((s) => s.fetchRecommends);

  const activeModeLabel = MODES.find((m) => m.key === activeMode)?.label ?? '';

  // Dark mode detection
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  // Colors
  const textColor = isDark ? '#e5e7eb' : '#1f2937';
  const subtextColor = isDark ? '#9ca3af' : '#6b7280';
  const axisColor = isDark ? '#4b5563' : '#d1d5db';
  const splitLineColor = isDark ? '#374151' : '#f3f4f6';
  const primaryColor = isDark ? '#60a5fa' : '#3b82f6';
  const primaryRgba = isDark ? 'rgba(96,165,250,' : 'rgba(59,130,246,';

  // Read/Listen ratio
  const hasReadListenData = useMemo(() => {
    const s = activeSnapshot;
    return s && ((s.wrReadTime ?? 0) > 0 || (s.wrListenTime ?? 0) > 0);
  }, [activeSnapshot]);

  const readPercent = useMemo(() => {
    const s = activeSnapshot;
    if (!s) return 0;
    const read = s.wrReadTime ?? 0;
    const listen = s.wrListenTime ?? 0;
    const total = read + listen;
    if (total === 0) return 0;
    return Math.round((read / total) * 100);
  }, [activeSnapshot]);

  const listenPercent = 100 - readPercent;

  // Trend chart option
  const trendOption = useMemo(() => {
    const readTimes = activeSnapshot?.readTimes;
    if (!readTimes) return {};
    const entries = Object.entries(readTimes).sort(
      ([a], [b]) => Number(a) - Number(b),
    );
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 50, right: 20, top: 20, bottom: 30 },
      xAxis: {
        type: 'category',
        data: entries.map(([k]) => formatTimestamp(k)),
        axisLine: { lineStyle: { color: axisColor } },
        axisLabel: { color: subtextColor },
      },
      yAxis: {
        type: 'value',
        name: '分钟',
        nameTextStyle: { color: subtextColor },
        axisLabel: {
          color: subtextColor,
          formatter: (v: number) => `${Math.round(v / 60)}`,
        },
        splitLine: { lineStyle: { color: splitLineColor } },
      },
      series: [
        {
          type: 'line',
          data: entries.map(([, v]) => v),
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { color: primaryColor, width: 2 },
          itemStyle: { color: primaryColor },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: primaryRgba + '0.25)' },
                { offset: 1, color: primaryRgba + '0.02)' },
              ],
            },
          },
        },
      ],
    };
  }, [
    activeSnapshot,
    axisColor,
    subtextColor,
    splitLineColor,
    primaryColor,
    primaryRgba,
  ]);

  // Read longest chart option
  const longestOption = useMemo(() => {
    const items = activeSnapshot?.readLongest ?? [];
    if (!items.length) return {};
    const sorted = [...items]
      .sort((a, b) => a.readTime - b.readTime)
      .slice(-10);
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: { name: string; value: number }[]) => {
          const p = params[0];
          return `${p.name}<br/>${formatDuration(p.value)}`;
        },
      },
      grid: { left: 120, right: 40, top: 10, bottom: 20 },
      xAxis: {
        type: 'value',
        name: '分钟',
        nameTextStyle: { color: subtextColor },
        axisLabel: {
          color: subtextColor,
          formatter: (v: number) => `${Math.round(v / 60)}`,
        },
        splitLine: { lineStyle: { color: splitLineColor } },
      },
      yAxis: {
        type: 'category',
        data: sorted.map((i) => i.book?.title ?? ''),
        axisLine: { lineStyle: { color: axisColor } },
        axisLabel: {
          color: textColor,
          width: 100,
          overflow: 'truncate',
        },
      },
      series: [
        {
          type: 'bar',
          data: sorted.map((i) => i.readTime),
          barMaxWidth: 24,
          itemStyle: {
            color: primaryColor,
            borderRadius: [0, 6, 6, 0],
          },
        },
      ],
    };
  }, [
    activeSnapshot,
    axisColor,
    subtextColor,
    splitLineColor,
    textColor,
    primaryColor,
  ]);

  // Category chart option
  const categoryOption = useMemo(() => {
    const cats = activeSnapshot?.preferCategory ?? [];
    if (!cats.length) return {};
    return {
      tooltip: {
        trigger: 'item',
        formatter: (p: { name: string; value: number; percent: number }) =>
          `${p.name}<br/>${formatDuration(p.value)} (${p.percent}%)`,
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['50%', '50%'],
          data: cats.map((c, i) => ({
            name: c.categoryTitle,
            value: c.readingTime,
            itemStyle: { color: PALETTE[i % PALETTE.length] },
          })),
          label: {
            color: textColor,
            fontSize: 12,
            formatter: '{b}\n{d}%',
          },
          emphasis: {
            itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.2)' },
          },
        },
      ],
    };
  }, [activeSnapshot, textColor]);

  // Prefer time chart option
  const preferTimeOption = useMemo(() => {
    const times = activeSnapshot?.preferTime;
    if (!times || !times.length) return {};
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 50, right: 20, top: 10, bottom: 30 },
      xAxis: {
        type: 'category',
        data: times.map((_, i) => `${String(i).padStart(2, '0')}:00`),
        axisLine: { lineStyle: { color: axisColor } },
        axisLabel: {
          color: subtextColor,
          interval: 3,
        },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: subtextColor },
        splitLine: { lineStyle: { color: splitLineColor } },
      },
      series: [
        {
          type: 'bar',
          data: times,
          barMaxWidth: 16,
          itemStyle: {
            color: primaryColor,
            borderRadius: [4, 4, 0, 0],
          },
        },
      ],
    };
  }, [activeSnapshot, axisColor, subtextColor, splitLineColor, primaryColor]);

  const handleBack = useCallback(() => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/bookshelf');
    }
  }, [navigate]);

  const handleRefresh = useCallback(() => {
    fetchStats();
  }, [fetchStats]);

  // Initial fetch
  useEffect(() => {
    if (!snapshots.length) {
      fetchStats();
    }
  }, [snapshots.length, fetchStats]);

  // 推荐独立加载
  useEffect(() => {
    if (recommends.length === 0) {
      fetchRecommends(true);
    }
  }, [recommends.length, fetchRecommends]);

  // Reset tab when data changes
  useEffect(() => {
    if (!snapshotByMode[activeMode] && Object.keys(snapshotByMode).length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveMode(Object.keys(snapshotByMode)[0] as ModeKey);
    }
  }, [snapshotByMode, activeMode]);

  // ── 年视图日历热力图 ───────────────────────────────────────
  const yearlyHeatmap = useReadStatsStore((s) => s.yearlyHeatmap);
  const fetchYearlyHeatmap = useReadStatsStore((s) => s.fetchYearlyHeatmap);
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const currentHeatmap = yearlyHeatmap[currentYear] ?? null;

  useEffect(() => {
    if (activeMode === 'annually') {
      fetchYearlyHeatmap(currentYear);
    }
  }, [activeMode, currentYear, fetchYearlyHeatmap]);

  const yearHeatmapOption = useMemo(() => {
    if (activeMode !== 'annually' || !currentHeatmap) return {};
    const firstDay = dayjs(`${currentYear}-01-01`);
    const lastDay = dayjs(`${currentYear}-12-31`);

    const dayValue: Record<string, number> = {};
    let maxVal = 0;
    for (const [ts, secs] of Object.entries(currentHeatmap)) {
      const d = dayjs.unix(Number(ts));
      if (!d.isValid() || d.year() !== currentYear) continue;
      const dateStr = d.format('YYYY-MM-DD');
      dayValue[dateStr] = secs;
      if (secs > maxVal) maxVal = secs;
    }

    const firstIsoWeek = firstDay.isoWeek();
    const data: [number, number, number][] = [];
    const monthLabels: { weekIdx: number; month: number }[] = [];
    const seenMonths = new Set<number>();
    let cursor = firstDay.clone();
    while (cursor.isBefore(lastDay) || cursor.isSame(lastDay, 'day')) {
      const dateStr = cursor.format('YYYY-MM-DD');
      const val = dayValue[dateStr] ?? 0;
      const dow = cursor.day() === 0 ? 6 : cursor.day() - 1;
      const wDiff = cursor.isoWeek() - firstIsoWeek;
      const weekIdx = wDiff < 0 ? 0 : wDiff;
      data.push([weekIdx, dow, val]);
      const m = cursor.month() + 1;
      if (!seenMonths.has(m) && cursor.date() <= 7) {
        seenMonths.add(m);
        monthLabels.push({ weekIdx, month: m });
      }
      cursor = cursor.add(1, 'day');
    }

    const maxWeekIdx = data.reduce((m, d) => Math.max(m, d[0]), 0);

    return {
      tooltip: {
        formatter: (p: { value: [number, number, number] }) => {
          const [w, d, v] = p.value;
          const weekStart = firstDay.clone().startOf('isoWeek').add(w, 'week');
          const date = weekStart.add(d, 'day');
          return `${date.format('YYYY-MM-DD')}<br/>${formatDuration(v)}`;
        },
      },
      grid: { left: 24, right: 8, top: 18, bottom: 32, containLabel: false },
      xAxis: {
        type: 'category',
        data: Array.from({ length: maxWeekIdx + 1 }, (_, i) => i),
        splitArea: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          show: true,
          color: subtextColor,
          fontSize: 10,
          interval: 0,
          formatter: (val: string) => {
            const found = monthLabels.find((m) => m.weekIdx === Number(val));
            return found ? `${found.month}月` : '';
          },
        },
      },
      yAxis: {
        type: 'category',
        data: ['一', '', '三', '', '五', '', '日'],
        splitArea: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: subtextColor, fontSize: 10 },
        inverse: true,
      },
      visualMap: {
        min: 0,
        max: Math.max(maxVal, 60),
        calculable: false,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        itemWidth: 10,
        itemHeight: 10,
        text: ['多', '少'],
        textStyle: { color: subtextColor, fontSize: 11 },
        inRange: {
          color: [primaryRgba + '0.12)', primaryRgba + '1)'],
        },
      },
      series: [
        {
          type: 'heatmap',
          data,
          itemStyle: { borderRadius: 2, borderColor: 'transparent' },
          emphasis: {
            itemStyle: {
              borderColor: primaryColor,
              borderWidth: 1,
            },
          },
          progressive: 1000,
        },
      ],
    };
  }, [
    activeMode,
    currentHeatmap,
    currentYear,
    subtextColor,
    primaryColor,
    primaryRgba,
  ]);

  const hasYearHeatmap =
    activeMode === 'annually' &&
    !!currentHeatmap &&
    Object.keys(currentHeatmap).length > 0;

  return (
    <div className="bg-page flex min-h-[calc(100dvh-4rem)] flex-col">
      {/* Hero Image Section */}
      <div className="relative h-[30vh] flex-shrink-0 overflow-hidden md:h-[35vh]">
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

        {/* Refresh Button */}
        <div className="absolute top-0 right-0 z-10 flex items-center px-4 py-4 md:px-6">
          <button
            type="button"
            className="bg-page/60 hover:bg-surface flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-md transition-colors"
            onClick={handleRefresh}
            aria-label="刷新统计"
          >
            <RefreshCw
              className={`text-ink h-5 w-5 ${isLoading ? 'animate-spin' : ''}`}
            />
          </button>
        </div>

        {/* Title Overlay */}
        <div className="absolute right-0 bottom-0 left-0 z-10 px-6 pb-6 md:px-10 md:pb-8">
          <h1 className="font-serif text-3xl font-bold text-white drop-shadow-lg md:text-5xl">
            阅读统计
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <span className="text-sm text-white/75 md:text-base">微信读书</span>
            <span className="h-1 w-1 rounded-full bg-white/40" />
            <span className="text-sm text-white/75 md:text-base">
              {activeModeLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Content */}
      <div className="flex-1 pb-8">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:px-10">
          {/* Loading skeleton */}
          {isLoading && !activeSnapshot && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="bg-surface h-24 rounded-xl" />
                  </div>
                ))}
              </div>
              <div className="bg-surface h-80 animate-pulse rounded-xl" />
            </div>
          )}

          {/* Error state */}
          {!isLoading && error && (
            <div className="flex flex-col items-center justify-center py-20">
              <p className="text-destructive mb-4 text-center text-sm">
                {error}
              </p>
              <button
                type="button"
                className="bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-xl px-5 py-2 text-sm font-medium transition-colors"
                onClick={() => fetchStats()}
              >
                重试
              </button>
            </div>
          )}

          {activeSnapshot && (
            <>
              {/* Mode Tabs */}
              <div className="bg-page mb-6 flex gap-1 rounded-xl p-1">
                {MODES.map((mode) => (
                  <button
                    key={mode.key}
                    type="button"
                    className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                      activeMode === mode.key
                        ? 'bg-accent text-ink shadow-sm'
                        : 'text-muted hover:bg-surface hover:text-ink'
                    }`}
                    onClick={() => setActiveMode(mode.key)}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              {/* Summary Cards */}
              <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="bg-page rounded-xl p-4">
                  <p className="text-muted mb-1 text-xs">总阅读时长</p>
                  <p className="text-ink text-2xl font-bold">
                    {formatDuration(activeSnapshot.totalReadTime)}
                  </p>
                </div>
                <div className="bg-page rounded-xl p-4">
                  <p className="text-muted mb-1 text-xs">阅读天数</p>
                  <p className="text-ink text-2xl font-bold">
                    {activeSnapshot.readDays ?? 0}
                    <span className="text-muted text-sm font-normal">天</span>
                  </p>
                </div>
                <div className="bg-page rounded-xl p-4">
                  <p className="text-muted mb-1 text-xs">日均时长</p>
                  <p className="text-ink text-2xl font-bold">
                    {formatDuration(activeSnapshot.dayAverageReadTime)}
                  </p>
                </div>
                <div className="bg-page rounded-xl p-4">
                  <p className="text-muted mb-1 text-xs">环比变化</p>
                  <p
                    className={`text-2xl font-bold ${
                      (activeSnapshot.compare ?? 0) >= 0
                        ? 'text-success'
                        : 'text-destructive'
                    }`}
                  >
                    {formatCompare(activeSnapshot.compare)}
                  </p>
                </div>
              </div>

              {/* Trend Chart */}
              {activeSnapshot.readTimes && (
                <div className="bg-page mb-6 rounded-xl p-4 sm:p-6">
                  <h3 className="text-ink mb-4 text-sm font-medium">
                    阅读趋势
                  </h3>
                  <div className="h-64 sm:h-80">
                    <ReactEChartsCore
                      echarts={echarts}
                      option={trendOption}
                      style={{ height: '100%', width: '100%' }}
                      opts={{ renderer: 'svg' }}
                    />
                  </div>
                </div>
              )}

              {/* Year Heatmap (annually only) */}
              {hasYearHeatmap && (
                <div className="bg-page mb-6 rounded-xl p-4 sm:p-6">
                  <h3 className="text-ink mb-1 text-sm font-medium">
                    本年的阅读足迹
                  </h3>
                  <p className="text-muted mb-4 text-xs">本年每日的阅读时长</p>
                  <div className="h-44 sm:h-48">
                    <ReactEChartsCore
                      echarts={echarts}
                      option={yearHeatmapOption}
                      style={{ height: '100%', width: '100%' }}
                      opts={{ renderer: 'svg' }}
                    />
                  </div>
                </div>
              )}

              {/* Read Longest Chart */}
              {activeSnapshot.readLongest &&
                activeSnapshot.readLongest.length > 0 && (
                  <div className="bg-page mb-6 rounded-xl p-4 sm:p-6">
                    <h3 className="text-ink mb-4 text-sm font-medium">
                      阅读排行
                    </h3>
                    <div className="h-64 sm:h-80">
                      <ReactEChartsCore
                        echarts={echarts}
                        option={longestOption}
                        style={{ height: '100%', width: '100%' }}
                        opts={{ renderer: 'svg' }}
                      />
                    </div>
                  </div>
                )}

              {/* Two-column: Category + Time Distribution */}
              <div className="mb-6 grid gap-6 lg:grid-cols-2">
                {/* Prefer Category */}
                {activeSnapshot.preferCategory &&
                  activeSnapshot.preferCategory.length > 0 && (
                    <div className="bg-page rounded-xl p-4 sm:p-6">
                      <h3 className="text-ink mb-4 text-sm font-medium">
                        分类偏好
                      </h3>
                      <div className="h-64 sm:h-72">
                        <ReactEChartsCore
                          echarts={echarts}
                          option={categoryOption}
                          style={{ height: '100%', width: '100%' }}
                          opts={{ renderer: 'svg' }}
                        />
                      </div>
                    </div>
                  )}

                {/* Prefer Time */}
                {activeSnapshot.preferTime && (
                  <div className="bg-page rounded-xl p-4 sm:p-6">
                    <h3 className="text-ink mb-4 text-sm font-medium">
                      时段分布
                    </h3>
                    <div className="h-64 sm:h-72">
                      <ReactEChartsCore
                        echarts={echarts}
                        option={preferTimeOption}
                        style={{ height: '100%', width: '100%' }}
                        opts={{ renderer: 'svg' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Read/Listen Ratio */}
              {hasReadListenData && (
                <div className="bg-page mb-6 rounded-xl p-4 sm:p-6">
                  <h3 className="text-ink mb-4 text-sm font-medium">
                    阅读方式
                  </h3>
                  <div className="flex items-center gap-6">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-muted text-xs">文字阅读</span>
                        <span className="text-ink text-sm font-medium">
                          {formatDuration(activeSnapshot!.wrReadTime)}
                        </span>
                      </div>
                      <div className="bg-surface h-2 overflow-hidden rounded-full">
                        <div
                          className="bg-accent h-full rounded-full transition-all"
                          style={{ width: `${readPercent}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-muted text-xs">听书</span>
                        <span className="text-ink text-sm font-medium">
                          {formatDuration(activeSnapshot!.wrListenTime)}
                        </span>
                      </div>
                      <div className="bg-surface h-2 overflow-hidden rounded-full">
                        <div
                          className="bg-success h-full rounded-full transition-all"
                          style={{ width: `${listenPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Read Stat Summary */}
              {activeSnapshot.readStat &&
                activeSnapshot.readStat.length > 0 && (
                  <div className="bg-page mb-6 rounded-xl p-4 sm:p-6">
                    <h3 className="text-ink mb-4 text-sm font-medium">
                      阅读概览
                    </h3>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      {activeSnapshot.readStat.map((stat) => (
                        <div key={stat.stat} className="text-center">
                          <p className="text-ink text-2xl font-bold">
                            {stat.counts}
                          </p>
                          <p className="text-muted text-xs">{stat.stat}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Prefer Authors */}
              {activeSnapshot.preferAuthor &&
                activeSnapshot.preferAuthor.length > 0 && (
                  <div className="bg-page mb-6 rounded-xl p-4 sm:p-6">
                    <h3 className="text-ink mb-4 text-sm font-medium">
                      偏好作者
                    </h3>
                    <div className="space-y-3">
                      {activeSnapshot.preferAuthor
                        .slice(0, 5)
                        .map((author, index) => (
                          <div
                            key={author.name ?? index}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <span className="bg-surface text-muted flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium">
                                {index + 1}
                              </span>
                              <span className="text-ink text-sm font-medium">
                                {author.name ?? '未知作者'}
                              </span>
                            </div>
                            <span className="text-muted text-sm">
                              {author.readTime ?? '--'}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

              {/* Prefer Publishers */}
              {activeSnapshot.preferPublisher &&
                activeSnapshot.preferPublisher.length > 0 && (
                  <div className="bg-page mb-6 rounded-xl p-4 sm:p-6">
                    <h3 className="text-ink mb-4 text-sm font-medium">
                      偏好出版社
                    </h3>
                    <div className="space-y-3">
                      {activeSnapshot.preferPublisher
                        .slice(0, 5)
                        .map((pub, index) => (
                          <div
                            key={pub.name ?? index}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <span className="bg-surface text-muted flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium">
                                {index + 1}
                              </span>
                              <span className="text-ink text-sm font-medium">
                                {pub.name ?? '未知出版社'}
                              </span>
                            </div>
                            <span className="text-muted text-sm">
                              {pub.count} 本
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

              {/* 接下来读什么 · 推荐 */}
              <RecommendSection
                books={recommends}
                loading={isLoadingRecommends}
                hasMore={hasMoreRecommends}
                error={recommendError}
                onRefresh={() => fetchRecommends(true)}
                onLoadMore={() => fetchRecommends(false)}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
