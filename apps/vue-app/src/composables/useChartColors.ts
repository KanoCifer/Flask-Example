import { resolveCssColor } from '@/lib';
import { formatRgb, parse } from 'culori';
import { computed, onMounted, onUnmounted, ref } from 'vue';

export interface ChartPalette {
  primary: string;
  warning: string;
  foreground: string;
  mutedForeground: string;
  border: string;
  card: string;
  /** 5 个主题系列色，喂给 ECharts `color` 数组 */
  series: [string, string, string, string, string];
}

/** 不可解析颜色时的 fallback 通道：与 react-app/src/features/fishing/hooks/useChartTheme.ts
 *  里的 withAlpha 行为保持一致 —— 返回 muted slate-blue 带指定 alpha，
 *  而不是把原字符串透传给 zrender（zrender 内部颜色预处理可能产出 undefined，
 *  最终在 addColorStop 报 "The value provided ('undefined') could not be parsed as a color."）。
 *  真实案例: TrendChartCard 的 areaStyle 渐变里 oklch 字符串泄露 -> 浏览器崩溃。
 *
 *  culori 原生解析 oklch/hex/rgb/hsl/命名色，覆盖原 canvas 实现漏判的分支；
 *  formatRgb 按 CSSOM 标准输出 rgba(r, g, b, a)。 */
export function withAlpha(color: string, alpha: number): string {
  const parsed = color ? parse(color) : undefined;
  // 无法解析（含空串）时兜底为 muted slate-blue，绝不把原字符串泄露给 ECharts
  if (!parsed) return `rgba(120, 134, 170, ${alpha})`;
  return formatRgb({ ...parsed, alpha });
}

const PALETTE_KEYS: Array<keyof ChartPalette> = [
  'primary',
  'warning',
  'foreground',
  'mutedForeground',
  'border',
  'card',
];

export function useChartColors() {
  const themeVersion = ref(0);
  let observer: MutationObserver | null = null;
  /** 上一轮 palette 的快照:6 个 flat token 全等 + series 数组全等则复用同一引用。 */
  let cached: ChartPalette | null = null;

  onMounted(() => {
    observer = new MutationObserver(() => {
      themeVersion.value += 1;
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-color-scheme'],
    });
  });

  onUnmounted(() => {
    observer?.disconnect();
    observer = null;
  });

  const palette = computed<ChartPalette>(() => {
    // 显式 touch themeVersion 让 computed 跟随主题切换重算
    void themeVersion.value;
    const series: [string, string, string, string, string] = [
      resolveCssColor('--color-chart-1', '#5470c6'),
      resolveCssColor('--color-chart-2', '#91cc75'),
      resolveCssColor('--color-chart-3', '#fac858'),
      resolveCssColor('--color-chart-4', '#ee6666'),
      resolveCssColor('--color-chart-5', '#73c0de'),
    ];
    const fresh: ChartPalette = {
      primary: resolveCssColor('--color-accent', '#3b82f6'),
      warning: resolveCssColor('--color-warning', '#f97316'),
      foreground: resolveCssColor('--color-ink', '#1f2937'),
      mutedForeground: resolveCssColor('--color-muted', '#9ca3af'),
      border: resolveCssColor('--color-border', '#e5e7eb'),
      card: resolveCssColor('--color-page', '#ffffff'),
      series,
    };
    if (
      cached &&
      PALETTE_KEYS.every((k) => cached![k] === fresh[k]) &&
      cached.series.every((c, i) => c === series[i])
    ) {
      return cached;
    }
    cached = fresh;
    return fresh;
  });

  return { themeVersion, palette };
}
