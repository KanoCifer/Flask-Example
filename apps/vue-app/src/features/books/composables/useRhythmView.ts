import type { ReadDetailSnapshot, ReadStatsMode } from '@/features/books/api';
import { formatDuration } from '@/lib/dayjs';
import dayjs from 'dayjs';
import type { ComputedRef, Ref } from 'vue';
import { computed } from 'vue';
import type { useEChartsTheme } from './useEChartsTheme';

type Snapshot = ReadDetailSnapshot | null;

const TREND_SUBTITLE_BY_MODE: Record<ReadStatsMode, string> = {
  weekly: '每天的阅读时长',
  monthly: '本月每天的阅读时长',
  annually: '本年每月的阅读时长',
  overall: '阅读时长走势',
};

/**
 * 段落三(阅读节奏)——三段式:
 *   1. 趋势(每日/月阅读时长柱图)
 *   2. 时段(24h 阅读频次柱图,带 peak 高亮)
 *   3. 文字 vs 听书 占比条
 *
 * 三个 hasXxxData 哨兵 + 整段 hasData;3 个 ECharts option;3 段文案。
 */
export function useRhythmView(
  snapshot: ComputedRef<Snapshot> | Ref<Snapshot>,
  mode: ComputedRef<ReadStatsMode> | Ref<ReadStatsMode>,
  theme: ReturnType<typeof useEChartsTheme>,
) {
  // ── 哨兵 ─────────────────────────────────────────────────────
  const hasTrendData = computed(() => {
    const t = snapshot.value?.readTimes;
    return !!t && Object.keys(t).length > 0;
  });

  const hasPreferTimeData = computed(() => {
    const t = snapshot.value?.preferTime;
    return !!t && t.some((v) => v > 0);
  });

  const hasReadListenData = computed(() => {
    const s = snapshot.value;
    return !!s && ((s.wrReadTime ?? 0) > 0 || (s.wrListenTime ?? 0) > 0);
  });

  const hasData = computed(
    () =>
      hasTrendData.value || hasPreferTimeData.value || hasReadListenData.value,
  );

  // ── 段落文案 ─────────────────────────────────────────────────
  const trendSubtitle = computed(() => TREND_SUBTITLE_BY_MODE[mode.value]);

  const peakTimeLabel = computed(() => {
    const times = snapshot.value?.preferTime;
    if (!times || !times.length) return null;
    let peak = -1;
    let peakIdx = 0;
    times.forEach((v, i) => {
      if (v > peak) {
        peak = v;
        peakIdx = i;
      }
    });
    if (peak <= 0) return null;
    return `${String(peakIdx).padStart(2, '0')}:00`;
  });

  const preferTimeSubtitle = computed(() => {
    const peak = peakTimeLabel.value;
    return peak ? `一天里最专注的时段是 ${peak}` : '一天中各时段的阅读频率';
  });

  const readPercent = computed(() => {
    const s = snapshot.value;
    if (!s) return 0;
    const r = s.wrReadTime ?? 0;
    const l = s.wrListenTime ?? 0;
    const total = r + l;
    if (total === 0) return 0;
    return Math.round((r / total) * 100);
  });
  const listenPercent = computed(() => 100 - readPercent.value);

  const readListenSubtitle = computed(() => {
    if (readPercent.value >= 80) return '你主要靠看的';
    if (listenPercent.value >= 80) return '你主要靠听的';
    return '文字阅读 与 听书 的占比';
  });

  // ── ECharts options(无渐变填充)──────────────────────────────
  function formatTrendLabel(ts: string): string {
    const d = dayjs.unix(Number(ts));
    if (!d.isValid()) return ts;
    if (mode.value === 'annually') return d.format('M 月');
    return d.format('M/D');
  }

  const trendOption = computed(() => {
    const readTimes = snapshot.value?.readTimes;
    if (!readTimes) return {};
    const entries = Object.entries(readTimes).sort(
      ([a], [b]) => Number(a) - Number(b),
    );
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'none' },
        formatter: (p: { name: string; value: number }[]) =>
          `${p[0].name}<br/>${formatDuration(p[0].value)}`,
      },
      grid: { left: 36, right: 8, top: 8, bottom: 28 },
      xAxis: {
        type: 'category',
        data: entries.map(([k]) => formatTrendLabel(k)),
        axisLine: { lineStyle: { color: theme.axisColor.value } },
        axisTick: { show: false },
        axisLabel: { color: theme.subtextColor.value, fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: theme.subtextColor.value,
          fontSize: 11,
          formatter: (v: number) => `${Math.round(v / 60)}m`,
        },
        splitLine: {
          lineStyle: { color: theme.splitLineColor.value, type: 'dashed' },
        },
      },
      series: [
        {
          type: 'bar',
          data: entries.map(([, v]) => v),
          barCategoryGap: '15%',
          itemStyle: {
            color: theme.primaryColor.value,
            borderRadius: [12, 12, 0, 0],
          },
          emphasis: {
            itemStyle: { color: theme.primaryColor.value },
          },
        },
      ],
    };
  });

  const preferTimeOption = computed(() => {
    const times = snapshot.value?.preferTime;
    if (!times) return {};
    const peak = Math.max(...times);
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'none' },
        formatter: (p: { name: string; value: number }[]) =>
          `${p[0].name}<br/>${p[0].value} 次`,
      },
      grid: { left: 36, right: 8, top: 8, bottom: 28 },
      xAxis: {
        type: 'category',
        data: times.map((_, i) => `${String(i).padStart(2, '0')}:00`),
        axisLine: { lineStyle: { color: theme.axisColor.value } },
        axisTick: { show: false },
        axisLabel: {
          color: theme.subtextColor.value,
          fontSize: 11,
          interval: 3,
        },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: theme.subtextColor.value, fontSize: 11 },
        splitLine: {
          lineStyle: { color: theme.splitLineColor.value, type: 'dashed' },
        },
      },
      series: [
        {
          type: 'bar',
          data: times.map((v) => ({
            value: v,
            itemStyle: {
              color:
                v === peak && peak > 0
                  ? theme.primaryColor.value
                  : theme.mutedFillColor.value,
            },
          })),
          barMaxWidth: 14,
          itemStyle: { borderRadius: [3, 3, 0, 0] },
        },
      ],
    };
  });

  return {
    hasTrendData,
    hasPreferTimeData,
    hasReadListenData,
    hasData,
    trendSubtitle,
    preferTimeSubtitle,
    readListenSubtitle,
    readPercent,
    listenPercent,
    trendOption,
    preferTimeOption,
  };
}
