import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useReadStatsStore } from '../readStats';
import type { ReadDetailSnapshot } from '@/features/books/api';

// ── gateway mock ─────────────────────────────────────────────────
const getReadProgress = vi.fn();
vi.mock('@/features/books/api', () => ({
  wereadGateway: {
    getReadProgress: (...args: unknown[]) => getReadProgress(...args),
  },
  READ_STATS_MODES: ['weekly', 'monthly', 'annually', 'overall'] as const,
}));

function makeSnapshot(
  mode: string,
  baseTime: number | null = 100,
): ReadDetailSnapshot {
  return {
    mode,
    baseTime,
    totalReadTime: 100,
    dayAverageReadTime: 10,
    readDays: 3,
    compare: null,
    readTimes: {},
    preferTime: [0, 1, 2],
    preferTimeWord: null,
    readStat: [],
    readListenRatio: { read: 50, listen: 50 },
    preferAuthor: [],
    preferPublisher: [],
    preferCategory: [],
    readLongest: [],
    notesCount: 0,
    bookmarksCount: 0,
    reflowInfo: null,
    fetched_at: '2024-01-01T00:00:00Z',
  } as unknown as ReadDetailSnapshot;
}

describe('useReadStatsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    getReadProgress.mockReset();
  });

  // ── snapshotKey 间接覆盖 ────────────────────────────────────
  describe('currentByMode / 派生', () => {
    it('初始为空', () => {
      const s = useReadStatsStore();
      expect(s.currentByMode).toEqual({});
      expect(s.weeklySnapshot).toBeNull();
      expect(s.monthlySnapshot).toBeNull();
      expect(s.isLoading).toBe(false);
      expect(s.error).toBe('');
    });

    it('fetchCurrentAll 后 currentByMode 按 mode 索引', async () => {
      getReadProgress.mockImplementation(async (mode: string) => ({
        data: makeSnapshot(mode),
      }));
      const s = useReadStatsStore();
      await s.fetchCurrentAll();
      expect(Object.keys(s.currentByMode).sort()).toEqual([
        'annually',
        'monthly',
        'overall',
        'weekly',
      ]);
      expect(s.weeklySnapshot?.mode).toBe('weekly');
      expect(s.monthlySnapshot?.mode).toBe('monthly');
    });

    it('getSnapshot 缓存命中', async () => {
      getReadProgress.mockResolvedValueOnce({ data: makeSnapshot('weekly') });
      const s = useReadStatsStore();
      await s.fetchPeriod('weekly', null);
      const hit = s.getSnapshot('weekly', null);
      expect(hit?.mode).toBe('weekly');
      const miss = s.getSnapshot('weekly', 999); // 另一个 baseTime
      expect(miss).toBeNull();
    });
  });

  // ── fetchCurrentAll 行为不变 ──────────────────────────────────
  describe('fetchCurrentAll', () => {
    it('4 mode 并发', async () => {
      const calls: string[] = [];
      getReadProgress.mockImplementation(async (m: string) => {
        calls.push(m);
        return { data: makeSnapshot(m) };
      });
      const s = useReadStatsStore();
      await s.fetchCurrentAll();
      expect(calls.sort()).toEqual([
        'annually',
        'monthly',
        'overall',
        'weekly',
      ]);
      expect(getReadProgress).toHaveBeenCalledTimes(4);
    });

    it('部分失败:成功的 mode 写入,失败 mode 标进 error 但不阻断其他 mode', async () => {
      getReadProgress.mockImplementation(async (mode: string) => {
        if (mode === 'monthly') {
          throw new Error('爆炸');
        }
        return { data: makeSnapshot(mode) };
      });
      const s = useReadStatsStore();
      await s.fetchCurrentAll();
      // 3 个成功的 mode 写入;1 个失败被识别
      expect(Object.keys(s.currentByMode).sort()).toEqual([
        'annually',
        'overall',
        'weekly',
      ]);
      expect(s.isLoading).toBe(false);
      // 失败 mode 的 message 进入 error(供 UI 可见)
      expect(s.error).toBe('爆炸');
    });

    it('isLoading 流程:开始 true → 结束 false', async () => {
      let resolveFetch: (v: unknown) => void = () => {};
      getReadProgress.mockReturnValue(
        new Promise((r) => {
          resolveFetch = r;
        }),
      );
      const s = useReadStatsStore();
      const p = s.fetchCurrentAll();
      expect(s.isLoading).toBe(true);
      resolveFetch({ data: makeSnapshot('weekly') });
      await p;
      expect(s.isLoading).toBe(false);
    });
  });

  // ── fetchPeriod 行为 ────────────────────────────────────────
  describe('fetchPeriod', () => {
    it('指定 baseTime 的快照按 key 写入', async () => {
      getReadProgress.mockResolvedValueOnce({
        data: makeSnapshot('weekly', 200),
      });
      const s = useReadStatsStore();
      await s.fetchPeriod('weekly', 200);
      expect(s.getSnapshot('weekly', 200)?.baseTime).toBe(200);
      // 不污染 null 槽
      expect(s.getSnapshot('weekly', null)).toBeNull();
    });

    it('gateway 返回 data=null → 抛错 → 写 error', async () => {
      getReadProgress.mockResolvedValueOnce({ data: null, message: '远端空' });
      const s = useReadStatsStore();
      await s.fetchPeriod('weekly', null);
      expect(s.error).toBe('远端空');
      expect(s.isLoading).toBe(false);
    });

    it('fetch 异常 → error 但保留旧数据', async () => {
      getReadProgress
        .mockResolvedValueOnce({ data: makeSnapshot('weekly') })
        .mockRejectedValueOnce(new Error('第二次炸了'));
      const s = useReadStatsStore();
      await s.fetchPeriod('weekly', null);
      await s.fetchPeriod('weekly', 1); // 第二次
      expect(s.error).toBe('第二次炸了');
      expect(s.getSnapshot('weekly', null)?.mode).toBe('weekly'); // 旧数据仍在
    });
  });
});
