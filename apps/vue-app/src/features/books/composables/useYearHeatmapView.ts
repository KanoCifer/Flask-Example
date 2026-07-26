import type { ReadStatsMode } from '@/features/books/api';
import { formatDuration } from '@/lib/dayjs';
import dayjs from 'dayjs';
import type { ComputedRef, Ref } from 'vue';
import { computed } from 'vue';

/**
 * key = dayUnixSec(字符串) -> 当日阅读秒数。
 * 数据来自 /read-progress?perDay=true,key 形如 "1704067200"。
 */
export type YearlyHeatmapData = Record<string, number> | null;

/** 单个单元格;level 0..4 对应 5 级色阶。 */
export type HeatmapCell = {
  /** YYYY-MM-DD */
  date: string;
  level: 0 | 1 | 2 | 3 | 4;
  /** 当日阅读秒数 */
  secs: number;
};

/**
 * 段落三·年视图日历热力图——GitHub 风格 53 周 × 7 天 grid。
 *
 * 数据源:YearlyHeatmapData,key 是当天 0:00 的 unix 秒字符串(WeRead 原生
 * monthly readTimes 形状),value 是当天的阅读秒数。无读的日子不出现在
 * 数据里,grid 渲染时 `?? 0` 兜底。改用日级真实数据,不再做"月总量/天数
 * 均匀分摊"的估算。
 *
 * 不用 ECharts——visualMap+heatmap 在多主题下的颜色梯度、月份/图例定位
 * 都不稳定,改用纯 CSS grid 渲染,让 design-system 的语义 token 直接
 * 驱动 cell 颜色。
 *
 * 5 级色阶用 4 分位数划分(只统计非零日),贴合用户实际阅读分布;
 * 若全年只有 1 天阅读,4 个分位都退化到该值,所有活跃日均 L4。
 *
 * 网格列 = 周(周一起),网格行 = 周一..周日;一年固定 53 列。第一列顶部
 * 会有 (Jan 1 dayOfWeek - 1) 个空槽,保证列与周对齐;末列同理。
 *
 * 返回 view:{ weeks, monthLabels, totalActiveDays, maxSeconds }。
 * 渲染端用 CSS grid + 显式 gridColumn/gridRow 定位,完全控制布局。
 */
export function useYearHeatmapView(
  heatmap: ComputedRef<YearlyHeatmapData> | Ref<YearlyHeatmapData>,
  year: ComputedRef<number> | Ref<number>,
  mode: ComputedRef<ReadStatsMode> | Ref<ReadStatsMode>,
) {
  // ── 哨兵 ────────────────────────────────────────────────────
  const hasData = computed(() => {
    if (mode.value !== 'annually') return false;
    const t = heatmap.value;
    return !!t && Object.keys(t).length > 0;
  });

  // ── 段落文案 ─────────────────────────────────────────────────
  const subtitle = computed(() => '本年每日的阅读时长');

  // ── 主体数据 ─────────────────────────────────────────────────
  const view = computed(() => {
    const data_ = heatmap.value;
    if (!data_) {
      return {
        weeks: [] as (HeatmapCell | null)[][],
        monthLabels: [] as { weekIdx: number; month: number }[],
        totalActiveDays: 0,
        maxSeconds: 0,
      };
    }

    const yr = year.value;
    const firstDay = dayjs(`${yr}-01-01`);
    const lastDay = dayjs(`${yr}-12-31`);

    // dayTs(unix秒) -> dateStr -> secs,跳过无效/越界日
    const dayValue: Record<string, number> = {};
    let maxVal = 0;
    for (const [ts, secs] of Object.entries(data_)) {
      const d = dayjs.unix(Number(ts));
      if (!d.isValid() || d.year() !== yr) continue;
      dayValue[d.format('YYYY-MM-DD')] = secs;
      if (secs > maxVal) maxVal = secs;
    }

    // 4 分位:仅在非零日内做分布统计
    const nonZero = Object.values(dayValue)
      .filter((s) => s > 0)
      .sort((a, b) => a - b);
    const q = (p: number) => {
      if (nonZero.length === 0) return 0;
      const idx = Math.min(nonZero.length - 1, Math.floor(p * nonZero.length));
      return nonZero[idx];
    };
    const q1 = q(0.25);
    const q2 = q(0.5);
    const q3 = q(0.75);

    // 计算网格列数:首日周首偏移 + 全年天数,向上取整到 7
    const offset = (firstDay.day() + 6) % 7; // Mon=0 ... Sun=6
    const totalDays = lastDay.diff(firstDay, 'day') + 1;
    const totalCells = offset + totalDays;
    const weekCount = Math.ceil(totalCells / 7);

    const weeks: (HeatmapCell | null)[][] = Array.from(
      { length: weekCount },
      () => Array.from({ length: 7 }, () => null),
    );
    const monthLabels: { weekIdx: number; month: number }[] = [];
    const seenMonths = new Set<number>();

    let cursor = firstDay.clone();
    let dayIdx = 0;
    let totalActiveDays = 0;
    while (cursor.isSame(lastDay) || cursor.isBefore(lastDay, 'day')) {
      const pos = offset + dayIdx;
      const wIdx = Math.floor(pos / 7);
      const dOfW = pos % 7; // 0=Mon..6=Sun
      const dateStr = cursor.format('YYYY-MM-DD');
      const secs = dayValue[dateStr] ?? 0;
      const level: 0 | 1 | 2 | 3 | 4 =
        secs <= 0 ? 0 : secs <= q1 ? 1 : secs <= q2 ? 2 : secs <= q3 ? 3 : 4;
      weeks[wIdx][dOfW] = { date: dateStr, level, secs };
      if (secs > 0) totalActiveDays++;
      const m = cursor.month() + 1;
      if (!seenMonths.has(m) && cursor.date() === 1) {
        seenMonths.add(m);
        monthLabels.push({ weekIdx: wIdx, month: m });
      }
      cursor = cursor.add(1, 'day');
      dayIdx++;
    }

    return {
      weeks,
      monthLabels,
      totalActiveDays,
      maxSeconds: maxVal,
    };
  });

  const totalActiveDays = computed(() => view.value.totalActiveDays);
  const maxSeconds = computed(() => view.value.maxSeconds);

  return {
    hasData,
    subtitle,
    view,
    totalActiveDays,
    maxSeconds,
    formatDuration,
  };
}
