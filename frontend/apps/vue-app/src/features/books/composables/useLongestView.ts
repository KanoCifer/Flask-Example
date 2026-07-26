import type {
  ReadDetailRawLongestItem,
  ReadDetailSnapshot,
} from '@/features/books/api';
import type { ComputedRef, Ref } from 'vue';
import { computed } from 'vue';

type Snapshot = ReadDetailSnapshot | null;

/** 展平后的最长阅读项（与旧组件模板契约一致） */
export interface FlatLongestItem {
  bookId: string | null;
  title: string | null;
  author: string | null;
  cover: string | null;
  readTime: number;
  tags: string[];
}

function flattenItem(item: ReadDetailRawLongestItem): FlatLongestItem {
  const info: Record<string, unknown> =
    (item.book as unknown as Record<string, unknown>) ?? item.albumInfo ?? {};
  return {
    bookId: (info.bookId as string) ?? null,
    title: (info.title as string) ?? null,
    author: (info.author as string) ?? null,
    cover: (info.cover as string) ?? null,
    readTime: item.readTime,
    tags: item.tags,
  };
}

/**
 * 段落二(让你停不下来的是)——最长阅读 top 5 排序与条形占比。
 */
export function useLongestView(
  snapshot: ComputedRef<Snapshot> | Ref<Snapshot>,
) {
  const topBooks = computed(() => {
    const items = snapshot.value?.readLongest ?? [];
    return [...items]
      .sort((a, b) => b.readTime - a.readTime)
      .slice(0, 5)
      .map(flattenItem);
  });

  const maxTime = computed(() => topBooks.value[0]?.readTime ?? 1);

  /**
   * 把 readTime 映射到 0–100 占比,最小 4%,避免最末位细到看不见。
   */
  function barPercent(t: number): number {
    if (maxTime.value <= 0) return 0;
    return Math.max(4, Math.round((t / maxTime.value) * 100));
  }

  const hasData = computed(() => topBooks.value.length > 0);

  return { topBooks, barPercent, hasData };
}
