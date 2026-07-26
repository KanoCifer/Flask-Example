import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BookRecommendItem } from '@/features/books/api';

// ── gateway mock ─────────────────────────────────────────────────
const getBooksRecommend = vi.fn();
vi.mock('@/features/books/api', () => ({
  wereadGateway: {
    getBooksRecommend: (...args: unknown[]) => getBooksRecommend(...args),
  },
}));

async function resetModule() {
  vi.resetModules();
}

function makeItem(bookId: string, searchIdx = 0): BookRecommendItem {
  return {
    bookId,
    title: `书 ${bookId}`,
    author: '作者',
    cover: null,
    reason: '',
    readingCount: 0,
    searchIdx,
    newRating: 50,
    intro: null,
    category: null,
  };
}

describe('useRecommends', () => {
  beforeEach(async () => {
    await resetModule();
    getBooksRecommend.mockReset();
  });

  it('初始为空,hasMore=true', async () => {
    const { useRecommends: hook } = await import('../useRecommends');
    const r = hook();
    expect(r.recommends.value).toEqual([]);
    expect(r.hasMoreRecommends.value).toBe(true);
    expect(r.recommendMaxIdx.value).toBe(0);
    expect(r.recommendError.value).toBe('');
  });

  it('reset=true 覆盖式拉取', async () => {
    const list1 = [makeItem('a', 5), makeItem('b', 6)];
    const list2 = [makeItem('c', 100)];
    getBooksRecommend
      .mockResolvedValueOnce({ data: list1 })
      .mockResolvedValueOnce({ data: list2 });
    const { useRecommends: hook } = await import('../useRecommends');
    const r = hook();
    await r.fetchRecommends(true, 2);
    expect(r.recommends.value.map((b) => b.bookId)).toEqual(['a', 'b']);
    await r.fetchRecommends(true, 1);
    expect(r.recommends.value.map((b) => b.bookId)).toEqual(['c']);
  });

  it('reset=false 续取追加 + dedup by bookId', async () => {
    getBooksRecommend
      .mockResolvedValueOnce({ data: [makeItem('a'), makeItem('b')] })
      .mockResolvedValueOnce({ data: [makeItem('b'), makeItem('c')] });
    const { useRecommends: hook } = await import('../useRecommends');
    const r = hook();
    await r.fetchRecommends(true, 2);
    await r.fetchRecommends(false, 2);
    const ids = r.recommends.value.map((b) => b.bookId);
    expect(ids).toEqual(['a', 'b', 'c']); // b 去重
  });

  it('游标推进:searchIdx > 0 用 lastIdx,否则 maxIdx + length', async () => {
    getBooksRecommend.mockResolvedValueOnce({
      data: [makeItem('a', 10), makeItem('b', 20)],
    });
    const { useRecommends: hook } = await import('../useRecommends');
    const r = hook();
    await r.fetchRecommends(true, 2);
    expect(r.recommendMaxIdx.value).toBe(20); // 用 lastIdx

    getBooksRecommend.mockResolvedValueOnce({
      data: [makeItem('c', 0)], // searchIdx=0 退化
    });
    await r.fetchRecommends(false, 1);
    expect(r.recommendMaxIdx.value).toBe(20 + 1); // maxIdx + length=1
  });

  it('空响应关闭 hasMore', async () => {
    getBooksRecommend.mockResolvedValueOnce({ data: [] });
    const { useRecommends: hook } = await import('../useRecommends');
    const r = hook();
    await r.fetchRecommends(true, 5);
    expect(r.hasMoreRecommends.value).toBe(false);
  });

  it('响应长度 < count 时 hasMore=false', async () => {
    getBooksRecommend.mockResolvedValueOnce({
      data: [makeItem('a'), makeItem('b')],
    });
    const { useRecommends: hook } = await import('../useRecommends');
    const r = hook();
    await r.fetchRecommends(true, 10); // 请求 10,返回 2
    expect(r.hasMoreRecommends.value).toBe(false);
  });

  it('hasMore=false 后 reset=false 直接 no-op', async () => {
    getBooksRecommend
      .mockResolvedValueOnce({ data: [] }) // 首屏空 → hasMore=false
      .mockResolvedValueOnce({ data: [makeItem('a')] });
    const { useRecommends: hook } = await import('../useRecommends');
    const r = hook();
    await r.fetchRecommends(true, 5);
    expect(r.hasMoreRecommends.value).toBe(false);
    await r.fetchRecommends(false, 5); // 应 no-op
    expect(getBooksRecommend).toHaveBeenCalledTimes(1);
  });

  it('isLoading 期间重复调用直接 no-op', async () => {
    let resolveFetch: (v: unknown) => void = () => {};
    getBooksRecommend.mockReturnValueOnce(
      new Promise((r) => {
        resolveFetch = r;
      }),
    );
    const { useRecommends: hook } = await import('../useRecommends');
    const r = hook();
    const p1 = r.fetchRecommends(true, 5);
    const p2 = r.fetchRecommends(true, 5);
    expect(r.isLoadingRecommends.value).toBe(true);
    resolveFetch({ data: [makeItem('a')] });
    await Promise.all([p1, p2]);
    expect(getBooksRecommend).toHaveBeenCalledTimes(1);
  });

  it('gateway 返回 data=null 抛错', async () => {
    getBooksRecommend.mockResolvedValueOnce({ data: null, message: '空响应' });
    const { useRecommends: hook } = await import('../useRecommends');
    const r = hook();
    await r.fetchRecommends(true, 5);
    expect(r.recommendError.value).toBe('空响应');
    expect(r.recommends.value).toEqual([]);
  });

  it('失败回 error 但保留旧数据', async () => {
    getBooksRecommend
      .mockResolvedValueOnce({ data: [makeItem('a')] })
      .mockRejectedValueOnce(new Error('断网'));
    const { useRecommends: hook } = await import('../useRecommends');
    const r = hook();
    await r.fetchRecommends(true, 1);
    await r.fetchRecommends(false, 1);
    expect(r.recommends.value.map((b) => b.bookId)).toEqual(['a']); // 旧数据仍在
    expect(r.recommendError.value).toBe('断网');
  });
});
