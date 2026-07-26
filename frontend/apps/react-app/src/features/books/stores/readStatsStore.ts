import {
  wereadService,
  type BookRecommendItem,
  type ReadDetailSnapshot,
  type ReadStatsMode,
} from '@/features/books';
import { create } from 'zustand';

const ALL_MODES: ReadStatsMode[] = ['weekly', 'monthly', 'annually', 'overall'];

function snapshotKey(mode: ReadStatsMode, baseTime?: number | null): string {
  return `${mode}:${baseTime ?? 'current'}`;
}

interface ReadStatsState {
  /** key = `${mode}:${baseTime ?? 'current'}` */
  snapshotMap: Record<string, ReadDetailSnapshot>;
  isLoading: boolean;
  error: string;
  /** 不传 mode → 当前周期 4 个 mode 并发拉取 */
  fetchStats: (mode?: ReadStatsMode, baseTime?: number | null) => Promise<void>;

  // ── 年视图热力图（按日 readTimes） ───────────────────
  /** key = year -> { dayUnixSec: secs }，按 year 缓存避免串台 */
  yearlyHeatmap: Record<number, Record<string, number>>;
  yearlyHeatmapYear: number | null;
  isLoadingYearlyHeatmap: boolean;
  yearlyHeatmapError: string;
  fetchYearlyHeatmap: (year?: number) => Promise<void>;

  // ── 推荐 ────────────────────────────────────────────────
  recommends: BookRecommendItem[];
  isLoadingRecommends: boolean;
  recommendError: string;
  recommendMaxIdx: number;
  hasMoreRecommends: boolean;
  /** reset=true 重新拉；false 续取追加 */
  fetchRecommends: (reset?: boolean, count?: number) => Promise<void>;
}

export const useReadStatsStore = create<ReadStatsState>((set, get) => ({
  snapshotMap: {},
  isLoading: false,
  error: '',

  recommends: [],
  isLoadingRecommends: false,
  recommendError: '',
  recommendMaxIdx: 0,
  hasMoreRecommends: true,

  yearlyHeatmap: {},
  yearlyHeatmapYear: null,
  isLoadingYearlyHeatmap: false,
  yearlyHeatmapError: '',

  fetchStats: async (mode, baseTime = null) => {
    set({ isLoading: true, error: '' });
    try {
      if (!mode) {
        const results = await Promise.all(
          ALL_MODES.map((m) => wereadService.getReadProgress(m, null)),
        );
        const next = { ...get().snapshotMap };
        ALL_MODES.forEach((m, i) => {
          const r = results[i];
          if (r.data) {
            next[snapshotKey(m, null)] = r.data as ReadDetailSnapshot;
          }
        });
        set({ snapshotMap: next });
        return;
      }

      const res = await wereadService.getReadProgress(mode, baseTime);
      if (res.data) {
        set({
          snapshotMap: {
            ...get().snapshotMap,
            [snapshotKey(mode, baseTime)]: res.data as ReadDetailSnapshot,
          },
        });
      } else {
        throw new Error(res.message || '获取阅读统计失败');
      }
    } catch (err: unknown) {
      const e = err as {
        message?: string;
        response?: { data?: { message?: string } };
      };
      set({
        error: e?.response?.data?.message || e?.message || '获取阅读统计失败',
      });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchYearlyHeatmap: async (year) => {
    const targetYear = year ?? new Date().getFullYear();
    if (get().isLoadingYearlyHeatmap) return;
    if (get().yearlyHeatmap[targetYear]) return; // 命中缓存
    set({ isLoadingYearlyHeatmap: true, yearlyHeatmapError: '' });
    try {
      const res = await wereadService.getYearlyHeatmap(targetYear);
      const data = res.data?.readTimes ?? {};
      set((s) => ({
        yearlyHeatmap: { ...s.yearlyHeatmap, [targetYear]: data },
        yearlyHeatmapYear: targetYear,
      }));
    } catch (err: unknown) {
      const e = err as {
        message?: string;
        response?: { data?: { message?: string } };
      };
      set({
        yearlyHeatmapError:
          e?.response?.data?.message || e?.message || '获取年热力图失败',
      });
    } finally {
      set({ isLoadingYearlyHeatmap: false });
    }
  },

  fetchRecommends: async (reset = true, count = 12) => {
    if (get().isLoadingRecommends) return;
    if (!reset && !get().hasMoreRecommends) return;
    set({ isLoadingRecommends: true, recommendError: '' });
    try {
      const maxIdx = reset ? 0 : get().recommendMaxIdx;
      const res = await wereadService.getBooksRecommend(count, maxIdx);
      if (!res.data) {
        throw new Error(res.message || '获取推荐失败');
      }
      const list = res.data;
      const merged = reset
        ? list
        : (() => {
            const seen = new Set(get().recommends.map((b) => b.bookId));
            return [
              ...get().recommends,
              ...list.filter((b) => !seen.has(b.bookId)),
            ];
          })();
      const lastIdx = list.length ? list[list.length - 1].searchIdx : 0;
      set({
        recommends: merged,
        recommendMaxIdx:
          list.length === 0
            ? get().recommendMaxIdx
            : lastIdx > 0
              ? lastIdx
              : maxIdx + list.length,
        hasMoreRecommends: list.length >= count,
      });
    } catch (err: unknown) {
      const e = err as {
        message?: string;
        response?: { data?: { message?: string } };
      };
      set({
        recommendError:
          e?.response?.data?.message || e?.message || '获取推荐失败',
      });
    } finally {
      set({ isLoadingRecommends: false });
    }
  },
}));

// ── Selectors ──────────────────────────────────────────────

/** 当前周期 4 mode 快照按 mode 索引 */
export const selectSnapshotByMode = (
  state: ReadStatsState,
): Record<string, ReadDetailSnapshot> => {
  const map: Record<string, ReadDetailSnapshot> = {};
  for (const mode of ALL_MODES) {
    const s = state.snapshotMap[snapshotKey(mode, null)];
    if (s) map[mode] = s;
  }
  return map;
};

/** 兼容旧调用：当前周期快照 array */
export const selectSnapshots = (state: ReadStatsState): ReadDetailSnapshot[] =>
  Object.values(selectSnapshotByMode(state));

export const selectGetSnapshot =
  (mode: ReadStatsMode, baseTime: number | null = null) =>
  (state: ReadStatsState): ReadDetailSnapshot | null =>
    state.snapshotMap[snapshotKey(mode, baseTime)] ?? null;

export const selectWeeklySnapshot = (state: ReadStatsState) =>
  selectSnapshotByMode(state)['weekly'] ?? null;

export const selectReadStatItems = (state: ReadStatsState) =>
  selectWeeklySnapshot(state)?.readStat ?? [];

export const selectPreferAuthors = (state: ReadStatsState) =>
  selectWeeklySnapshot(state)?.preferAuthor ?? [];

export const selectPreferPublishers = (state: ReadStatsState) =>
  selectWeeklySnapshot(state)?.preferPublisher ?? [];

export const selectReadListenRatio = (state: ReadStatsState) => {
  const weekly = selectWeeklySnapshot(state);
  if (!weekly) return { read: 0, listen: 0 };
  return {
    read: weekly.wrReadTime ?? 0,
    listen: weekly.wrListenTime ?? 0,
  };
};
