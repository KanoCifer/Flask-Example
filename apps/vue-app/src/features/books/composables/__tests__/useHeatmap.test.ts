import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WereadYearlyHeatmap } from '@/features/books/api';

// ── gateway mock ─────────────────────────────────────────────────
const getYearlyHeatmap = vi.fn();
vi.mock('@/features/books/api', () => ({
  wereadGateway: {
    getYearlyHeatmap: (...args: unknown[]) => getYearlyHeatmap(...args),
  },
}));

// reset module-singleton state between tests
async function resetModule() {
  vi.resetModules();
}

function makeHeatmap(
  seconds: Record<string, number> = {},
): WereadYearlyHeatmap {
  return { readTimes: seconds };
}

describe('useHeatmap', () => {
  beforeEach(async () => {
    await resetModule();
    getYearlyHeatmap.mockReset();
  });

  it('初始全部为空', async () => {
    const { useHeatmap: hook } = await import('../useHeatmap');
    const h = hook();
    expect(h.yearlyHeatmap.value).toEqual({});
    expect(h.yearlyHeatmapYear.value).toBeNull();
    expect(h.isLoadingYearlyHeatmap.value).toBe(false);
    expect(h.yearlyHeatmapError.value).toBe('');
  });

  it('fetch 成功:写入 yearlyHeatmap + 更新 yearlyHeatmapYear', async () => {
    getYearlyHeatmap.mockResolvedValueOnce({
      data: makeHeatmap({ '1704067200': 600 }),
    });
    const { useHeatmap: hook } = await import('../useHeatmap');
    const h = hook();
    await h.fetchYearlyHeatmap(2024);
    expect(getYearlyHeatmap).toHaveBeenCalledWith(2024);
    expect(h.yearlyHeatmap.value[2024]).toEqual({ '1704067200': 600 });
    expect(h.yearlyHeatmapYear.value).toBe(2024);
    expect(h.isLoadingYearlyHeatmap.value).toBe(false);
    expect(h.yearlyHeatmapError.value).toBe('');
  });

  it('默认年份为当前年', async () => {
    getYearlyHeatmap.mockResolvedValueOnce({ data: makeHeatmap() });
    const { useHeatmap: hook } = await import('../useHeatmap');
    const h = hook();
    await h.fetchYearlyHeatmap();
    expect(getYearlyHeatmap).toHaveBeenCalledWith(new Date().getFullYear());
  });

  it('已缓存的 year 跳过网络层', async () => {
    getYearlyHeatmap.mockResolvedValueOnce({
      data: makeHeatmap({ '1704067200': 100 }),
    });
    const { useHeatmap: hook } = await import('../useHeatmap');
    const h = hook();
    await h.fetchYearlyHeatmap(2024);
    expect(getYearlyHeatmap).toHaveBeenCalledTimes(1);
    await h.fetchYearlyHeatmap(2024);
    expect(getYearlyHeatmap).toHaveBeenCalledTimes(1); // 缓存命中,不重发
  });

  it('isLoading 期间重复调用直接 no-op', async () => {
    let resolveFetch: (v: unknown) => void = () => {};
    getYearlyHeatmap.mockReturnValueOnce(
      new Promise((r) => {
        resolveFetch = r;
      }),
    );
    const { useHeatmap: hook } = await import('../useHeatmap');
    const h = hook();
    const p1 = h.fetchYearlyHeatmap(2025);
    // 此时第一次调用正在进行
    const p2 = h.fetchYearlyHeatmap(2025);
    resolveFetch({ data: makeHeatmap() });
    await Promise.all([p1, p2]);
    expect(getYearlyHeatmap).toHaveBeenCalledTimes(1);
  });

  it('失败:写 error,但保留旧数据', async () => {
    getYearlyHeatmap.mockRejectedValueOnce(new Error('网络炸了'));
    const { useHeatmap: hook } = await import('../useHeatmap');
    const h = hook();
    await h.fetchYearlyHeatmap(2024);
    expect(h.yearlyHeatmapError.value).toBe('网络炸了');
    expect(h.yearlyHeatmap.value[2024]).toBeUndefined(); // 没写入
    expect(h.isLoadingYearlyHeatmap.value).toBe(false);
  });

  it('失败有后端 message 时优先取 response.data.message', async () => {
    getYearlyHeatmap.mockRejectedValueOnce({
      response: { data: { message: '后端说错' } },
    });
    const { useHeatmap: hook } = await import('../useHeatmap');
    const h = hook();
    await h.fetchYearlyHeatmap(2024);
    expect(h.yearlyHeatmapError.value).toBe('后端说错');
  });

  it('多份年份并存', async () => {
    getYearlyHeatmap
      .mockResolvedValueOnce({ data: makeHeatmap({ a: 1 }) })
      .mockResolvedValueOnce({ data: makeHeatmap({ b: 2 }) });
    const { useHeatmap: hook } = await import('../useHeatmap');
    const h = hook();
    await h.fetchYearlyHeatmap(2024);
    await h.fetchYearlyHeatmap(2025);
    expect(Object.keys(h.yearlyHeatmap.value).sort()).toEqual(['2024', '2025']);
    expect(h.yearlyHeatmapYear.value).toBe(2025);
  });
});
