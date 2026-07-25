<script setup lang="ts">
/**
 * HourlyChartCard —— 24h 天气时序:降水柱 + 温度线
 *
 * 设计语言:深蓝夜航 (data-dense, monospace-aware, single accent)
 * - 头部 4 列度量 (Time window / Peak rain / Δ Temp / Best window)
 *   数字用 tabular-nums 衬出"测量仪表"感,标签全大写小字 + 0.08em tracking
 * - 图表区:1px 虚线水平网格 + 0px 垂直网格;温度线 2px solid,锚点空心圆 hover 显
 * - 单焦点:温度暖橙,降水冷蓝;Hover 时主线 + 锚点突出 (echarts 6 默认会把
 *   其他 series 推到 blur 态,这里 focus: 'none' 保持副线全可见,避免 tooltip 期间
 *   图形"消失")
 * - 无圆角重影 / 无渐变 / 无图标:让数据自己说话
 *
 * 契约(不可改):无 props / 无 emit;数据从 useFishingMapStore().weatherHourly
 * 注入,调色板从 useChartColors().palette 注入。父级调用 <HourlyChartCard /> 不动。
 */
import { useChartColors, withAlpha } from '@/composables';
import { useFishingMapStore } from '@/features/fishing/stores/fishingMap';
import DashboardCard from '@/features/fishing/components/DashboardCard.vue';
import dayjs from 'dayjs';
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import VChart from 'vue-echarts';

const fishingMapStore = useFishingMapStore();
const { weatherHourly } = storeToRefs(fishingMapStore);
const { palette } = useChartColors();

/* ------------------------------------------------------------------ *
 * Derived metrics —— 头部 4 列度量的真实数据
 * ------------------------------------------------------------------ */
const metrics = computed(() => {
  const list = weatherHourly.value ?? [];
  if (list.length === 0) {
    return {
      window: '—',
      peakRain: { value: '0.0', unit: 'mm', at: '—' },
      tempRange: { lo: '—', hi: '—', spread: '—' },
      bestWindow: { value: '—', note: '等待数据' },
    };
  }

  const start = dayjs(list[0]!.fxTime).format('HH:mm');
  const end = dayjs(list[list.length - 1]!.fxTime).format('HH:mm');
  const window = `${start} → ${end}`;

  /* QWeather 返回的 precip/temp 是字符串 ("0.5"/"29"),统一转 Number,
   * 否则 Math.max(...rains) 返回 number 而 rains 是 string[] → indexOf 严格相等
   * 永远 -1 → list[-1] 抛错,整个 metrics computed 崩溃,卡片停在加载态。 */
  const rains = list.map((it) => Number(it.precip) || 0);
  const temps = list.map((it) => Number(it.temp) || 0);
  const peakIdx = rains.indexOf(Math.max(...rains));
  const peakRain = {
    value: (rains[peakIdx] ?? 0).toFixed(1),
    unit: 'mm',
    at: dayjs(list[peakIdx]!.fxTime).format('HH:mm'),
  };

  const tMin = Math.min(...temps);
  const tMax = Math.max(...temps);
  const tempRange = {
    lo: `${Math.round(tMin)}°`,
    hi: `${Math.round(tMax)}°`,
    spread: `${Math.abs(Math.round(tMax - tMin))}°`,
  };

  /* 最佳窗口:在有数据的范围内,挑温度最接近中位数 + 降水最低的连续 3h */
  const medianTemp =
    [...temps].sort((a, b) => a - b)[Math.floor(temps.length / 2)] ?? 0;
  let bestStart = 0;
  let bestScore = -Infinity;
  for (let i = 0; i + 2 < list.length; i++) {
    const avgTemp =
      ((temps[i] ?? 0) + (temps[i + 1] ?? 0) + (temps[i + 2] ?? 0)) / 3;
    const avgRain =
      ((rains[i] ?? 0) + (rains[i + 1] ?? 0) + (rains[i + 2] ?? 0)) / 3;
    const tempPenalty = Math.abs(avgTemp - medianTemp);
    /* 温度越接近中位越好 (+), 降水越低越好 (+) */
    const score = -tempPenalty * 1.2 - avgRain * 4;
    if (score > bestScore) {
      bestScore = score;
      bestStart = i;
    }
  }
  const bestEnd = Math.min(bestStart + 2, list.length - 1);
  const bestWindow = {
    value: `${dayjs(list[bestStart]!.fxTime).format('HH:mm')}–${dayjs(
      list[bestEnd]!.fxTime,
    ).format('HH:mm')}`,
    note: `降水 ${(rains.slice(bestStart, bestEnd + 1).reduce((a, b) => a + b, 0) / 3).toFixed(1)}mm/h`,
  };

  return { window, peakRain, tempRange, bestWindow };
});

/* ------------------------------------------------------------------ *
 * ECharts option —— 主体图表
 * ------------------------------------------------------------------ */
const chartOption = computed(() => {
  try {
    if (!weatherHourly.value || weatherHourly.value.length === 0) return {};

    const p = palette.value;
    const xData = weatherHourly.value.map((item) =>
      dayjs(item.fxTime).format('HH:mm'),
    );
    const rainData = weatherHourly.value.map(
      (item) => Number(item.precip) || 0,
    );
    const tempData = weatherHourly.value.map((item) => Number(item.temp) || 0);

    const tempMax = Math.max(...tempData);
    const tempMin = Math.min(...tempData);
    const tempAxisMin = Math.floor(tempMin - 4);
    const tempAxisMax = Math.ceil(tempMax + 4);
    const rainPeak = Math.max(...rainData);
    const rainAxisMax = Math.max(8, Math.ceil(rainPeak * 1.6));

    /* label interval: 24h 数据,每 4h 一个 (共 ~6) */
    const xInterval = Math.max(0, Math.floor(xData.length / 6) - 1);

    /* 暖橙温度焦点色:从 --warning 派生的更亮的 accent,1px solid 线 + hover 锚点 */
    const tempColor = p.warning;
    const rainColor = p.primary;

    return {
      backgroundColor: 'transparent',
      animation: false,
      textStyle: { color: p.foreground, fontFamily: 'inherit' },

      tooltip: {
        trigger: 'axis',
        backgroundColor: p.card,
        borderColor: p.foreground,
        borderWidth: 1,
        borderRadius: 8,
        padding: [10, 12],
        extraCssText: `box-shadow: 0 8px 24px -8px ${withAlpha(p.foreground, 0.18)};`,
        textStyle: { color: p.foreground, fontSize: 12, fontFamily: 'inherit' },
        axisPointer: {
          type: 'line',
          lineStyle: {
            color: withAlpha(tempColor, 0.55),
            type: 'solid',
            width: 1,
          },
          snap: true,
        },
        formatter: (params: unknown) => {
          const arr = params as Array<{
            axisValue: string;
            seriesName: string;
            data: number;
            marker: string;
          }>;
          const time = arr[0]?.axisValue ?? '';
          const lines = arr
            .map((it) => {
              const isTemp = it.seriesName.includes('温度');
              const unit = isTemp ? '°C' : 'mm';
              return `<div style="display:flex;align-items:center;gap:8px;margin-top:3px;">
              <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${
                isTemp ? tempColor : rainColor
              };"></span>
              <span style="color:${p.mutedForeground};font-size:11px;letter-spacing:0.02em;">${it.seriesName}</span>
              <span style="font-weight:600;margin-left:auto;font-variant-numeric:tabular-nums;color:${
                isTemp ? tempColor : p.foreground
              };">${it.data}${unit}</span>
            </div>`;
            })
            .join('');
          return `<div style="font-weight:600;font-size:11px;color:${p.mutedForeground};margin-bottom:4px;letter-spacing:0.04em;">${time}</div>${lines}`;
        },
      },

      legend: { show: false },

      /* 紧凑 grid:让图表区尽量留给数据本身,顶部只留 12px 给 tooltip 不被裁 */
      grid: { left: 4, right: 4, top: 12, bottom: 4, containLabel: true },

      xAxis: {
        type: 'category',
        boundaryGap: true,
        data: xData,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: {
          color: p.mutedForeground,
          fontSize: 10,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          interval: xInterval,
          margin: 8,
        },
      },

      yAxis: [
        /* 左轴 —— 降水 (mm) */
        {
          type: 'value',
          position: 'left',
          min: 0,
          max: rainAxisMax,
          axisLine: { show: false },
          axisTick: { show: false },
          splitNumber: 3,
          splitLine: {
            show: true,
            lineStyle: {
              color: withAlpha(p.border, 0.55),
              type: 'dashed',
              width: 1,
            },
          },
          axisLabel: {
            color: p.mutedForeground,
            fontSize: 9,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            formatter: (v: number) =>
              v === Math.floor(v) ? `${v}` : v.toFixed(1),
            margin: 6,
          },
        },
        /* 右轴 —— 温度 (°C) */
        {
          type: 'value',
          position: 'right',
          min: tempAxisMin,
          max: tempAxisMax,
          axisLine: { show: false },
          axisTick: { show: false },
          splitNumber: 3,
          splitLine: { show: false },
          axisLabel: {
            color: withAlpha(tempColor, 0.85),
            fontSize: 9,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            formatter: (v: number) => `${Math.round(v)}°`,
            margin: 6,
          },
        },
      ],

      series: [
        /* 降水柱 —— 实心 + 顶部 1px 边,只在 hover 邻接时提亮 */
        {
          name: '降水 (mm)',
          type: 'bar',
          data: rainData,
          yAxisIndex: 0,
          barMaxWidth: 10,
          barMinHeight: 1,
          itemStyle: {
            color: withAlpha(rainColor, 0.78),
            borderColor: rainColor,
            borderWidth: 0,
            borderRadius: [2, 2, 0, 0],
          },
          // echarts 6 默认 emphasis.focus: 'self' 会把其他 series 推到 blur 态
          // (opacity 拉到 0.25),tooltip 一出整图看似变白消失。改 'none' 让
          // 其他 series 保持原样,blur 锁 opacity: 1 兜底。— 与 TideCard 同源
          emphasis: {
            focus: 'none',
            itemStyle: {
              color: rainColor,
              borderColor: rainColor,
              borderWidth: 0,
            },
          },
          blur: { itemStyle: { opacity: 1 } },
          z: 2,
        },
        /* 温度线 —— 单一焦点;hover 显空心锚点 */
        {
          name: '温度 (°C)',
          type: 'line',
          data: tempData,
          yAxisIndex: 1,
          smooth: 0.25,
          symbol: 'circle',
          symbolSize: 5,
          showSymbol: false,
          lineStyle: {
            width: 2,
            color: tempColor,
            cap: 'round',
            join: 'round',
          },
          itemStyle: {
            color: p.card,
            borderColor: tempColor,
            borderWidth: 1.6,
          },
          emphasis: {
            focus: 'none',
            scale: 1.4,
            itemStyle: {
              color: tempColor,
              borderColor: p.card,
              borderWidth: 1.6,
            },
            lineStyle: { width: 2.5 },
          },
          blur: {
            lineStyle: { opacity: 1 },
            itemStyle: { opacity: 1 },
          },
          z: 3,
        },
      ],
    };
  } catch (e) {
    console.error(
      '[HourlyChartCard] chartOption 构建失败:',
      e instanceof Error ? e.message : String(e),
    );
    return {};
  }
});
</script>

<template>
  <DashboardCard>
    <!-- ============================================================== -->
    <!-- Header: title row + 4-column metrics strip                     -->
    <!-- ============================================================== -->
    <header class="hourly-header">
      <div class="hourly-title">
        <h3 class="hourly-h3">
          <span class="font-serif">小时天气</span>
          <span class="hourly-h3__sub">HOURLY · NEXT 24H</span>
        </h3>
        <p class="hourly-sub">降水柱 · 温度线</p>
      </div>

      <div class="hourly-legend" aria-hidden="true">
        <span class="legend-pill">
          <span class="legend-dot legend-dot--rain" />
          <span class="legend-label">降水</span>
        </span>
        <span class="legend-pill">
          <span class="legend-dot legend-dot--temp" />
          <span class="legend-label">温度</span>
        </span>
      </div>
    </header>

    <!-- Metrics strip —— 单行 4 列,数字大、字母小 -->
    <dl class="hourly-metrics" data-od-id="hourly-metrics">
      <div class="metric">
        <dt class="metric-label">窗口</dt>
        <dd class="metric-value metric-value--text">{{ metrics.window }}</dd>
      </div>
      <div class="metric">
        <dt class="metric-label">峰值降水</dt>
        <dd class="metric-value">
          <span class="metric-num">{{ metrics.peakRain.value }}</span>
          <span class="metric-unit">{{ metrics.peakRain.unit }}</span>
          <span class="metric-foot">@{{ metrics.peakRain.at }}</span>
        </dd>
      </div>
      <div class="metric">
        <dt class="metric-label">温度区间</dt>
        <dd class="metric-value">
          <span class="metric-num metric-num--temp">{{
            metrics.tempRange.lo
          }}</span>
          <span class="metric-dash">→</span>
          <span class="metric-num metric-num--temp">{{
            metrics.tempRange.hi
          }}</span>
          <span class="metric-foot">Δ {{ metrics.tempRange.spread }}</span>
        </dd>
      </div>
      <div class="metric metric--accent">
        <dt class="metric-label">推荐窗口</dt>
        <dd class="metric-value">
          <span class="metric-num metric-num--accent">{{
            metrics.bestWindow.value
          }}</span>
          <span class="metric-foot">{{ metrics.bestWindow.note }}</span>
        </dd>
      </div>
    </dl>

    <!-- ============================================================== -->
    <!-- Chart body                                                     -->
    <!-- ============================================================== -->
    <div
      v-if="weatherHourly && weatherHourly.length > 0"
      class="hourly-chart"
      data-od-id="hourly-chart"
    >
      <v-chart
        :option="chartOption"
        style="width: 100%; height: 100%"
        autoresize
      />
    </div>
    <div v-else class="hourly-empty" data-od-id="hourly-empty">
      <div class="hourly-empty__spinner" aria-hidden="true" />
      <p class="hourly-empty__text">正在加载天气数据…</p>
    </div>
  </DashboardCard>
</template>

<style scoped>
/* ==================================================================
 * HourlyChartCard —— 深蓝夜航 (data-dense)
 *   - 4 列度量条:用 tabular-nums 把数字当仪表读
 *   - 头部到图表:1px 顶边压节奏
 *   - 图表:1px 虚线水平网格 + 暖橙温度线 + 冷蓝降水柱
 *   - 无圆角重影,无渐变,无图标,无 emoji
 * ================================================================== */

.hourly-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.hourly-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.hourly-h3 {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.2;
  color: var(--color-ink);
}
.hourly-h3__sub {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.16em;
  color: var(--color-muted);
  text-transform: uppercase;
}
.hourly-sub {
  margin: 0;
  font-size: 12px;
  color: var(--color-muted);
  letter-spacing: 0.01em;
}

/* Legend —— 无圆角胶囊,纯左色点 + 小字 */
.hourly-legend {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  padding-top: 2px;
  flex-shrink: 0;
}
.legend-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--color-ink);
  letter-spacing: 0.04em;
}
.legend-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 1px;
}
.legend-dot--rain {
  background: var(--color-accent);
}
.legend-dot--temp {
  background: var(--color-warning);
  border-radius: 50%;
}
.legend-label {
  font-weight: 500;
}

/* ------------------------------------------------------------------
 * Metrics strip —— 4 列 1 行,数字仪表化
 * ------------------------------------------------------------------ */
.hourly-metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0;
  margin: 0 0 14px;
  padding: 12px 0 14px;
  border-top: 1px solid
    color-mix(in oklch, var(--color-border) 60%, transparent);
  border-bottom: 1px solid
    color-mix(in oklch, var(--color-border) 60%, transparent);
}

.metric {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 14px;
  border-right: 1px solid
    color-mix(in oklch, var(--color-border) 40%, transparent);
}
.metric:first-child {
  padding-left: 0;
}
.metric:last-child {
  padding-right: 0;
  border-right: 0;
}
.metric--accent .metric-num--accent {
  color: var(--color-warning);
}

.metric-label {
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  margin: 0;
}

.metric-value {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin: 0;
  min-width: 0;
  flex-wrap: wrap;
}
.metric-value--text {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
  color: var(--color-ink);
}
.metric-num {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.015em;
  font-variant-numeric: tabular-nums;
  line-height: 1.05;
  color: var(--color-ink);
}
.metric-num--temp {
  color: var(--color-warning);
}
.metric-num--accent {
  color: var(--color-warning);
}
.metric-unit {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.04em;
}
.metric-dash {
  font-size: 14px;
  color: var(--color-muted);
  font-weight: 400;
}
.metric-foot {
  font-size: 10px;
  color: var(--color-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.06em;
  margin-left: 2px;
}

/* ------------------------------------------------------------------
 * Chart body
 * ------------------------------------------------------------------ */
.hourly-chart {
  position: relative;
  flex: 1;
  min-height: 0;
}

.hourly-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 180px;
}
.hourly-empty__spinner {
  width: 24px;
  height: 24px;
  border: 1.5px solid color-mix(in oklch, var(--color-border) 70%, transparent);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: hourly-spin 0.9s linear infinite;
}
.hourly-empty__text {
  margin: 0;
  font-size: 12px;
  color: var(--color-muted);
  letter-spacing: 0.04em;
}

@keyframes hourly-spin {
  to {
    transform: rotate(360deg);
  }
}

/* ------------------------------------------------------------------
 * Responsive: <640px 折叠为 2x2 网格
 * ------------------------------------------------------------------ */
@media (max-width: 640px) {
  .hourly-header {
    flex-direction: column;
    gap: 8px;
  }
  .hourly-metrics {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px 0;
  }
  .metric {
    padding: 0 10px;
  }
  .metric:nth-child(2) {
    border-right: 0;
  }
  .metric:nth-child(1),
  .metric:nth-child(2) {
    padding-bottom: 12px;
    border-bottom: 1px solid
      color-mix(in oklch, var(--color-border) 40%, transparent);
  }
  .metric:nth-child(3) {
    padding-left: 0;
  }
  .metric:nth-child(4) {
    padding-right: 0;
  }
  .metric-num {
    font-size: 18px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hourly-empty__spinner {
    animation: none;
  }
}
</style>
