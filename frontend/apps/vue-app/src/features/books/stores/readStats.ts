// 💀 This store is now thin — 仅保留 snapshot(I/O),其他领域已迁出:
//   - yearlyHeatmap + fetchYearlyHeatmap → @/composables/weread/useHeatmap
//   - recommends + fetchRecommends       → @/composables/weread/useRecommends
// 新增 weread feature 时请进 composables/weread/,不要回到这个 store。
// (详见 docs/adr/0006-readstats-by-concern.md)

import {
  wereadGateway,
  READ_STATS_MODES,
  type ReadDetailSnapshot,
  type ReadStatsMode,
} from '@/features/books/api';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

/** snapshots key = `${mode}:${baseTime ?? 'current'}` */
function snapshotKey(mode: ReadStatsMode, baseTime?: number | null): string {
  return `${mode}:${baseTime ?? 'current'}`;
}

export const useReadStatsStore = defineStore('readStats', () => {
  const snapshots = ref<Record<string, ReadDetailSnapshot>>({});
  const isLoading = ref(false);
  const error = ref('');

  // ── 当前周期的 4 个快照（用于 BookStats 顶层 tabs） ──
  const currentByMode = computed(() => {
    const map: Record<string, ReadDetailSnapshot> = {};
    for (const mode of READ_STATS_MODES) {
      const s = snapshots.value[snapshotKey(mode, null)];
      if (s) map[mode] = s;
    }
    return map;
  });

  const weeklySnapshot = computed(() => currentByMode.value['weekly'] ?? null);
  const monthlySnapshot = computed(
    () => currentByMode.value['monthly'] ?? null,
  );

  /**
   * 首屏 4 mode 并发拉取。每个 mode 走独立请求,失败不影响其他 mode。
   * 部分失败时已成功的 mode 会写入 snapshots,失败的 mode 静默跳过(下次重试覆盖)。
   */
  async function fetchCurrentAll(): Promise<void> {
    isLoading.value = true;
    error.value = '';
    try {
      // Promise.allSettled 任一失败不阻断其他 mode 写入(部分失败语义)
      const results = await Promise.allSettled(
        READ_STATS_MODES.map((m) => wereadGateway.getReadProgress(m, null)),
      );
      const next: Record<string, ReadDetailSnapshot> = { ...snapshots.value };
      let anyError: string | null = null;
      READ_STATS_MODES.forEach((m, i) => {
        const r = results[i];
        if (r.status === 'fulfilled') {
          if (r.value.data) {
            next[snapshotKey(m, null)] = r.value.data as ReadDetailSnapshot;
          }
        } else {
          anyError =
            (r.reason as { response?: { data?: { message?: string } } })
              ?.response?.data?.message ||
            (r.reason as { message?: string })?.message ||
            '获取阅读统计失败';
        }
      });
      snapshots.value = next;
      if (anyError) error.value = anyError;
    } catch (err: unknown) {
      // 防御兜底:循环外的极端错误(目前不会触发)
      const e = err as {
        message?: string;
        response?: { data?: { message?: string } };
      };
      error.value =
        e?.response?.data?.message || e?.message || '获取阅读统计失败';
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 拉取指定 mode + 周期的单条快照。baseTime=null 代表当前周期。
   * 切换 tab / 翻页 / 重试 走这条。
   */
  async function fetchPeriod(
    mode: ReadStatsMode,
    baseTime: number | null = null,
  ): Promise<void> {
    isLoading.value = true;
    error.value = '';
    try {
      const res = await wereadGateway.getReadProgress(mode, baseTime);
      if (res.data) {
        snapshots.value = {
          ...snapshots.value,
          [snapshotKey(mode, baseTime)]: res.data as ReadDetailSnapshot,
        };
      } else {
        throw new Error(res.message || '获取阅读统计失败');
      }
    } catch (err: unknown) {
      const e = err as {
        message?: string;
        response?: { data?: { message?: string } };
      };
      error.value =
        e?.response?.data?.message || e?.message || '获取阅读统计失败';
    } finally {
      isLoading.value = false;
    }
  }

  function getSnapshot(
    mode: ReadStatsMode,
    baseTime: number | null = null,
  ): ReadDetailSnapshot | null {
    return snapshots.value[snapshotKey(mode, baseTime)] ?? null;
  }

  return {
    // state
    snapshots,
    isLoading,
    error,
    // I/O
    fetchCurrentAll,
    fetchPeriod,
    getSnapshot,
    // 派生(供 8 个 sibling composables + BookStats 直接取)
    currentByMode,
    weeklySnapshot,
    monthlySnapshot,
  };
});
