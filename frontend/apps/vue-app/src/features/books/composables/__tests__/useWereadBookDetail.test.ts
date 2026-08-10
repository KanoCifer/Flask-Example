import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextTick, ref, type Ref } from 'vue';

// ── gateway mock ─────────────────────────────────────────────────
const getBookInfo = vi.fn();
vi.mock('@/features/books/api', () => ({
  wereadGateway: {
    getBookInfo: (...args: unknown[]) => getBookInfo(...args),
  },
}));

async function resetModule() {
  vi.resetModules();
}

function makeDetail(bookId: string) {
  return {
    id: bookId,
    bookId,
    title: `书 ${bookId}`,
    author: '作者',
    translator: '译者',
    cover: 'https://x.com/c.jpg',
    introduction: '这是一本好书。',
    category: '科幻',
    publisher: '出版社',
    publishTime: '2008-01',
    isbn: '9787536692930',
    wordCount: 200000,
    newRating: 92.5,
    newRatingCount: 1000,
    newRatingDetails: { '5': 800 },
    fetched_at: '2026-01-01T00:00:00Z',
  };
}

describe('useWereadBookDetail', () => {
  beforeEach(async () => {
    await resetModule();
    getBookInfo.mockReset();
  });

  it('bookId 为 null 时不请求', async () => {
    const { useWereadBookDetail: hook } =
      await import('../useWereadBookDetail');
    const bookId: Ref<string | null> = ref(null);
    const { detail } = hook(bookId);
    await nextTick();
    expect(getBookInfo).not.toHaveBeenCalled();
    expect(detail.value).toBeNull();
  });

  it('bookId 变化时发起请求并回填 detail', async () => {
    getBookInfo.mockResolvedValue({ data: makeDetail('b1') });
    const { useWereadBookDetail: hook } =
      await import('../useWereadBookDetail');
    const bookId: Ref<string | null> = ref(null);
    const { detail } = hook(bookId);

    bookId.value = 'b1';
    await nextTick();
    // watch 是 async fetch,等一个微任务让 promise 解析
    await new Promise((r) => setTimeout(r, 0));

    expect(getBookInfo).toHaveBeenCalledWith('b1');
    expect(detail.value?.id).toBe('b1');
    expect(detail.value?.title).toBe('书 b1');
  });

  it('第二次打开同一本书命中缓存，不再请求', async () => {
    getBookInfo.mockResolvedValue({ data: makeDetail('b1') });
    const { useWereadBookDetail: hook } =
      await import('../useWereadBookDetail');
    const bookId: Ref<string | null> = ref('b1');

    // 首次：写缓存
    hook(bookId);
    await new Promise((r) => setTimeout(r, 0));
    expect(getBookInfo).toHaveBeenCalledTimes(1);

    // 切走再切回：命中缓存，不重复请求
    bookId.value = null;
    await nextTick();
    bookId.value = 'b1';
    await nextTick();
    await new Promise((r) => setTimeout(r, 0));

    expect(getBookInfo).toHaveBeenCalledTimes(1);
  });

  it('refresh(true) 强制绕过缓存重新请求', async () => {
    getBookInfo.mockResolvedValue({ data: makeDetail('b1') });
    const { useWereadBookDetail: hook } =
      await import('../useWereadBookDetail');
    const bookId = ref<string | null>('b1');
    const { fetchDetail } = hook(bookId);
    await new Promise((r) => setTimeout(r, 0));
    expect(getBookInfo).toHaveBeenCalledTimes(1);

    await fetchDetail(true);
    expect(getBookInfo).toHaveBeenCalledTimes(2);
  });

  it('请求期间 bookId 变化，丢弃旧响应', async () => {
    // 第一个请求延迟解析，第二个立即解析
    let resolveFirst: (v: unknown) => void = () => {};
    getBookInfo
      .mockImplementationOnce(
        () =>
          new Promise((res) => {
            resolveFirst = res;
          }),
      )
      .mockResolvedValueOnce({ data: makeDetail('b2') });

    const { useWereadBookDetail: hook } =
      await import('../useWereadBookDetail');
    const bookId = ref<string | null>('b1');
    const { detail } = hook(bookId);
    await nextTick();

    // 请求发出后立刻切到 b2 —— activeFetchId 变为 b2
    bookId.value = 'b2';
    await nextTick();

    // 旧请求 (b1) 此时才返回 —— 应被丢弃，detail 仍是 b2
    resolveFirst({ data: makeDetail('b1') });
    await new Promise((r) => setTimeout(r, 0));

    expect(detail.value?.id).toBe('b2');
  });

  it('接口返回 message 无 data 时写入 error', async () => {
    getBookInfo.mockResolvedValue({ message: '加载详情失败' });
    const { useWereadBookDetail: hook } =
      await import('../useWereadBookDetail');
    const bookId = ref<string | null>('b1');
    const { detail, error } = hook(bookId);
    await new Promise((r) => setTimeout(r, 0));

    expect(detail.value).toBeNull();
    expect(error.value).toBe('加载详情失败');
  });
});
