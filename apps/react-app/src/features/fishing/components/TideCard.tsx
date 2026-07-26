import { useEffect, useMemo } from 'react';

import dayjs from 'dayjs';

import {
  HARBOR_OPTIONS,
  useFishingMapStore,
} from '@/features/fishing/stores/fishingMapStore';
import { useChartTheme, withAlpha } from '../hooks/useChartTheme';
import type { TideTableItem } from '../types';
import { SkeletonCard } from './SkeletonCard';
import { TideChart } from './TideChart';

/**
 * TideCard — Apple HIG 信息架构:
 *   港口 SegmentedControl (5 项, 一行内可选)
 *   日期 scroll chips (8 日, 横向滚动)
 *   潮汐曲线 (ECharts, theme-aware)
 *   高潮 / 低潮 inset-grouped 双列
 */
export function TideCard() {
  const {
    panelTideData: tideData,
    tideLoading: loading,
    selectedHarbor,
    selectedDate,
    setSelectedHarbor,
    setSelectedDate,
    fetchPanelTide,
  } = useFishingMapStore();

  const theme = useChartTheme();

  useEffect(() => {
    fetchPanelTide();
  }, [selectedHarbor, selectedDate, fetchPanelTide]);

  // 今日 ~ +7天
  const dateOptions = Array(8)
    .fill(null)
    .map((_, i) => {
      const d = dayjs().add(i, 'day');
      return {
        value: d.format('YYYYMMDD'),
        label: d.format('MM-DD'),
        weekday: d.format('dd'),
      };
    });

  const highTide = useMemo<TideTableItem | null>(() => {
    if (!tideData?.tideTable?.length) return null;
    const highs = tideData.tideTable.filter((item) => item.type === 'H');
    if (!highs.length) return null;
    return highs.reduce((prev, curr) =>
      Number(curr.height) > Number(prev.height) ? curr : prev,
    );
  }, [tideData]);

  const lowTide = useMemo<TideTableItem | null>(() => {
    if (!tideData?.tideTable?.length) return null;
    const lows = tideData.tideTable.filter((item) => item.type === 'L');
    if (!lows.length) return null;
    return lows.reduce((prev, curr) =>
      Number(curr.height) < Number(prev.height) ? curr : prev,
    );
  }, [tideData]);

  const tideChartOption = useMemo(() => {
    // 始终返回 well-formed option (即便没有数据),
    // 避免 zrender 在动画插值时撞到 undefined 数组 (graphic.js:4601 interpolate1DArray)
    if (!tideData) {
      return {
        animation: false,
        series: [],
      };
    }

    const now = dayjs();
    let currentTimeIndex = -1;
    tideData.tideHourly.forEach((point, index) => {
      const pointTime = dayjs(point.fxTime);
      if (pointTime.isBefore(now) || pointTime.isSame(now)) {
        currentTimeIndex = index;
      }
    });

    return {
      animation: false,
      tooltip: {
        trigger: 'axis',
        backgroundColor: theme.paper,
        borderColor: theme.border,
        borderWidth: 1,
        borderRadius: 12,
        padding: [10, 14],
        textStyle: { color: theme.ink, fontSize: 13 },
        formatter: (params: unknown[]) => {
          const param = params[0] as { axisValue: string; data: number };
          return `<div style="padding:2px 0;">
          <div style="font-weight:600;margin-bottom:4px;">${param.axisValue}</div>
          <div>潮高: <span style="color:${theme.tide};font-weight:bold;">${param.data.toFixed(2)} m</span></div>
        </div>`;
        },
      },
      grid: { left: '4%', right: '4%', bottom: '12%', top: '10%' },
      xAxis: {
        type: 'category',
        data: tideData.tideHourly.map((point) =>
          dayjs(point.fxTime).format('HH:mm'),
        ),
        axisLabel: {
          color: theme.muted,
          fontSize: 11,
          formatter: (value: string) => value.slice(11, 16),
          interval: Math.max(1, Math.floor(tideData.tideHourly.length / 5)),
        },
        axisLine: { lineStyle: { color: theme.border } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: theme.muted,
          fontSize: 11,
          formatter: (value: number) => `${value}m`,
        },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: {
          lineStyle: { color: withAlpha(theme.border, 0.6), type: 'dashed' },
        },
      },
      series: [
        {
          data: tideData.tideHourly.map((point) => Number(point.height)),
          type: 'line',
          smooth: 0.4,
          symbol: 'none',
          lineStyle: { color: theme.tide, width: 2.5 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: withAlpha(theme.tide, 0.24) },
                { offset: 0.7, color: withAlpha(theme.tide, 0.05) },
                { offset: 1, color: withAlpha(theme.tide, 0) },
              ],
            },
          },
          markLine:
            currentTimeIndex >= 0
              ? {
                  symbol: ['none', 'none'],
                  lineStyle: {
                    color: theme.warning,
                    type: 'dashed',
                    width: 1.5,
                  },
                  label: {
                    show: true,
                    formatter: '现在',
                    color: theme.warning,
                    fontWeight: '600',
                    fontSize: 12,
                  },
                  data: [{ xAxis: currentTimeIndex }],
                }
              : undefined,
        },
      ],
      textStyle: { color: theme.ink },
    };
  }, [theme, tideData]);

  return (
    <article className="px-1 pt-2 pb-6" aria-label="潮汐预报">
      <div className="mb-3">
        <h3 className="text-ink text-sm font-semibold">潮汐预报</h3>
      </div>

      {/* Harbor — Apple HIG Segmented Control (5 项, 一行) */}
      <div className="fm-segmented mb-2 w-full overflow-x-auto" role="tablist">
        {HARBOR_OPTIONS.map((opt) => {
          const isActive = selectedHarbor === opt.code;
          return (
            <button
              key={opt.code}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setSelectedHarbor(opt.code)}
              className={`min-h-8 flex-1 shrink-0 rounded-md px-3 text-xs font-medium transition-all duration-200 ease-out ${
                isActive
                  ? 'bg-page text-ink shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
            >
              {opt.name}
            </button>
          );
        })}
      </div>

      {/* Date — Apple HIG scroll chips (8 日, 横向滚动) */}
      <div className="fm-hscroll -mx-1 mb-4 flex gap-1.5 px-1">
        {dateOptions.map((opt) => {
          const isActive = selectedDate === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSelectedDate(opt.value)}
              className={`min-h-9 shrink-0 rounded-full px-3 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-accent text-ink'
                  : 'bg-surface text-ink hover:bg-surface/70'
              }`}
            >
              {opt.label} {opt.weekday}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="min-h-[260px]">
          <SkeletonCard hasChart hasBottomRow />
        </div>
      ) : tideData ? (
        <div className="min-h-[260px] space-y-4">
          <div className="h-[200px]">
            <TideChart option={tideChartOption} />
          </div>
          {/* High / low tide — Apple HIG inset-grouped 双列 */}
          <div className="fm-grouped bg-border/40 grid grid-cols-2 gap-px">
            <div className="bg-page flex flex-col gap-1 px-4 py-3">
              <span className="text-muted text-xs font-medium">
                最高潮
                <span className="text-ink ml-1.5 tabular-nums">
                  {highTide ? dayjs(highTide.fxTime).format('HH:mm') : '--'}
                </span>
              </span>
              <span className="text-ink text-sm font-semibold tabular-nums">
                {highTide ? Number(highTide.height).toFixed(2) : '--'} m
              </span>
            </div>
            <div className="bg-page flex flex-col gap-1 px-4 py-3">
              <span className="text-muted text-xs font-medium">
                最低潮
                <span className="text-ink ml-1.5 tabular-nums">
                  {lowTide ? dayjs(lowTide.fxTime).format('HH:mm') : '--'}
                </span>
              </span>
              <span className="text-ink text-sm font-semibold tabular-nums">
                {lowTide ? Number(lowTide.height).toFixed(2) : '--'} m
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="min-h-[260px]">
          <p className="text-muted text-sm">暂无潮汐数据</p>
        </div>
      )}
    </article>
  );
}
