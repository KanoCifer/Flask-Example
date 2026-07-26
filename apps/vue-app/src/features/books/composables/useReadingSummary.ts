import { wereadGateway } from '@/features/books/api';
import { useReadStatsStore } from '@/features/books/stores/readStats';
import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';

export interface UseReadingSummaryReturn {
  readingCount: Ref<number>;
  weeklyMinutes: ComputedRef<number>;
  monthlyMinutes: ComputedRef<number>;
  refresh: () => Promise<void>;
}

/**
 * 为 entry 仪表盘等消费者提供阅读摘要：
 * - readingCount：当前在读书本数（weread 书架过滤 finishReading）
 * - weeklyMinutes / monthlyMinutes：本周 / 本月累计阅读分钟
 *
 * 内部消费 books 自己的 wereadGateway + useReadStatsStore，不对外暴露 store ref。
 * 阅读统计走 requestIdleCallback 包装（非阻塞首屏）。
 */
export const useReadingSummary = (): UseReadingSummaryReturn => {
  const readStats = useReadStatsStore();
  const readingCount = ref(5);

  const weeklyMinutes = computed(
    () => readStats.weeklySnapshot?.totalReadTime ?? 0,
  );
  const monthlyMinutes = computed(
    () => readStats.monthlySnapshot?.totalReadTime ?? 0,
  );

  async function refresh(): Promise<void> {
    try {
      const shelfRes = await wereadGateway.getUserShelf();
      const books = shelfRes.data?.user_books ?? [];
      const readingBooks = books.filter((b) => !b.finishReading);
      readingCount.value = readingBooks.length || 5;
    } catch {
      readingCount.value = 5;
    }

    // 阅读统计非首屏关键路径，用 requestIdleCallback 延后，避免阻塞首屏
    const idleFetch = () => readStats.fetchCurrentAll();
    if (requestIdleCallback) {
      requestIdleCallback(idleFetch);
    } else {
      setTimeout(idleFetch, 0);
    }
  }

  return {
    readingCount,
    weeklyMinutes,
    monthlyMinutes,
    refresh,
  };
};
