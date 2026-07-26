// 阅读统计 · 推荐书籍游标分页。
//
// module 单例形态(与 useTaskDrawer 同)—— 整个应用共享同一份 recommend 列表 + 游标。
// 之所以从原 useReadStatsStore 拆出: 推荐 fetch 不应阻塞 snapshot fetch 的 isLoading;
// cursor + dedup 逻辑在 view 之外可单测;新增 admin export 等第二消费者无需引 store。
import { wereadGateway, type BookRecommendItem } from '@/features/books/api';
import { ref } from 'vue';

const recommends = ref<BookRecommendItem[]>([]);
const isLoadingRecommends = ref(false);
const recommendError = ref('');

/** 续取游标:下次 fetch 的 searchIdx 起值 */
const recommendMaxIdx = ref(0);

/** 远端是否还有下一页(由上次响应长度反推) */
const hasMoreRecommends = ref(true);

/**
 * 拉取推荐书籍。
 * - reset=true(默认) → 从头拉,覆盖现有列表
 * - reset=false → 从 recommendMaxIdx 续取,追加到列表末尾 + 去重 by bookId
 *
 * 失败回 error 但保留旧数据。
 */
export function useRecommends() {
  async function fetchRecommends(reset = true, count = 12): Promise<void> {
    if (isLoadingRecommends.value) return;
    if (!reset && !hasMoreRecommends.value) return;
    isLoadingRecommends.value = true;
    recommendError.value = '';
    try {
      const maxIdx = reset ? 0 : recommendMaxIdx.value;
      const res = await wereadGateway.getBooksRecommend(count, maxIdx);
      if (!res.data) {
        throw new Error(res.message || '获取推荐失败');
      }
      const list = res.data;
      if (reset) {
        recommends.value = list;
      } else {
        // 去重 by bookId,避免远端分页重叠
        const seen = new Set(recommends.value.map((b) => b.bookId));
        recommends.value = [
          ...recommends.value,
          ...list.filter((b) => !seen.has(b.bookId)),
        ];
      }
      if (list.length === 0) {
        hasMoreRecommends.value = false;
      } else {
        const lastIdx = list[list.length - 1].searchIdx;
        recommendMaxIdx.value = lastIdx > 0 ? lastIdx : maxIdx + list.length;
        hasMoreRecommends.value = list.length >= count;
      }
    } catch (err: unknown) {
      const e = err as {
        message?: string;
        response?: { data?: { message?: string } };
      };
      recommendError.value =
        e?.response?.data?.message || e?.message || '获取推荐失败';
    } finally {
      isLoadingRecommends.value = false;
    }
  }

  return {
    recommends,
    isLoadingRecommends,
    recommendError,
    recommendMaxIdx,
    hasMoreRecommends,
    fetchRecommends,
  };
}
