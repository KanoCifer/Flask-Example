import type { ReadDetailSnapshot } from '@/features/books/api';
import type { ComputedRef, Ref } from 'vue';
import { computed } from 'vue';

type Snapshot = ReadDetailSnapshot | null;

/**
 * 段落四(你偏好的)——品类/作者/出版社 三个 top 列表。
 *
 * 品类附 share(0..1),用于 UI 显示占比百分比。
 */
export function usePreferenceView(
  snapshot: ComputedRef<Snapshot> | Ref<Snapshot>,
) {
  const topCategories = computed(() => {
    const cats = snapshot.value?.preferCategory ?? [];
    if (!cats.length) return [];
    const total = cats.reduce((sum, c) => sum + (c.readingTime ?? 0), 0) || 1;
    return cats
      .map((c) => ({ ...c, share: (c.readingTime ?? 0) / total }))
      .sort((a, b) => b.share - a.share)
      .slice(0, 4);
  });

  const topAuthors = computed(() =>
    (snapshot.value?.preferAuthor ?? []).slice(0, 5),
  );

  const topPublishers = computed(() =>
    (snapshot.value?.preferPublisher ?? []).slice(0, 5),
  );

  const hasData = computed(
    () =>
      topCategories.value.length > 0 ||
      topAuthors.value.length > 0 ||
      topPublishers.value.length > 0,
  );

  return { topCategories, topAuthors, topPublishers, hasData };
}
