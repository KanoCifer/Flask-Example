// 阅读统计 · 年视图日历热力图（按日 readTimes）。
//
// module 单例形态(与 useTaskDrawer 同)—— 整个应用视图共享同一份缓存。
// 之所以从原 useReadStatsStore 拆出: store 不该替 3 个无关 fetch 共用 1 个 isLoading;
// heatmap 只需 1 套状态(按 year 缓存),不应再与 snapshot 域耦合。
import { wereadGateway } from '@/features/books/api';
import { ref } from 'vue';

/** key = 年份,value = 该年 dayUnixSec(字符串) -> 当日阅读秒数 */
const yearlyHeatmap = ref<Record<number, Record<string, number>>>({});

/** 最近一次 fetch 的年份(供 UI 直接拿 currentYear) */
const yearlyHeatmapYear = ref<number | null>(null);

const isLoadingYearlyHeatmap = ref(false);
const yearlyHeatmapError = ref('');

/**
 * 拉取指定年份的日级阅读时长。
 * - 已缓存的 year 跳过网络层(module 维度)
 * - isLoading 期间对同 year 重复调用直接 no-op
 * - 失败回 error 但保留旧数据
 */
export function useHeatmap() {
  async function fetchYearlyHeatmap(year?: number): Promise<void> {
    const targetYear = year ?? new Date().getFullYear();
    if (isLoadingYearlyHeatmap.value) return;
    if (yearlyHeatmap.value[targetYear]) return; // 命中缓存
    isLoadingYearlyHeatmap.value = true;
    yearlyHeatmapError.value = '';
    try {
      const res = await wereadGateway.getYearlyHeatmap(targetYear);
      const data = res.data?.readTimes ?? {};
      yearlyHeatmap.value = { ...yearlyHeatmap.value, [targetYear]: data };
      yearlyHeatmapYear.value = targetYear;
    } catch (err: unknown) {
      const e = err as {
        message?: string;
        response?: { data?: { message?: string } };
      };
      yearlyHeatmapError.value =
        e?.response?.data?.message || e?.message || '获取年热力图失败';
    } finally {
      isLoadingYearlyHeatmap.value = false;
    }
  }

  return {
    yearlyHeatmap,
    yearlyHeatmapYear,
    isLoadingYearlyHeatmap,
    yearlyHeatmapError,
    fetchYearlyHeatmap,
  };
}
