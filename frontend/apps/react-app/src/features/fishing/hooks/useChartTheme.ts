import { formatRgb, parse } from 'culori';
import { useEffect, useState } from 'react';

/**
 * 把 ECharts 的硬编码色（#3b82f6 / #f97316 / #06b6d4 …）替换成主题 token。
 *
 * 两个坑：
 * 1. `@theme inline` 的 `--color-*` 不会作为 CSS 自定义属性落到 :root，
 *    所以读「原始」主题变量（--ink / --chart-* / --border-color …），它们才真正 emit。
 * 2. zrender（ECharts 的渲染层）解析不了 oklch()，只认 rgb/hex。
 *    用 culori 的 parse + formatRgb 把 oklch/hex/hsl/命名色统一折算成 rgb，
 *    无需 DOM probe（因此 SSR / 无 body 时也能复用）。
 *
 * 主题切换（.dark class / data-color-scheme 属性）时 MutationObserver 重算。
 */
export interface ChartTheme {
  ink: string;
  muted: string;
  border: string;
  accent: string;
  paper: string;
  tide: string;
  temp: string;
  rain: string;
  success: string;
  warning: string;
  destructive: string;
}

const VAR_MAP: Record<keyof ChartTheme, string> = {
  ink: '--ink',
  muted: '--muted-text',
  border: '--border-color',
  accent: '--accent',
  paper: '--page',
  tide: '--chart-3',
  temp: '--chart-1',
  rain: '--chart-3',
  success: '--color-emerald-500',
  warning: '--color-amber-500',
  destructive: '--color-rose-500',
};

const FALLBACK: ChartTheme = {
  ink: 'rgb(40, 37, 32)',
  muted: 'rgb(107, 100, 90)',
  border: 'rgb(224, 219, 210)',
  accent: 'rgb(140, 108, 74)',
  paper: 'rgb(248, 245, 240)',
  tide: 'rgb(120, 134, 170)',
  temp: 'rgb(179, 120, 74)',
  rain: 'rgb(120, 134, 170)',
  success: 'rgb(16, 185, 129)',
  warning: 'rgb(245, 158, 11)',
  destructive: 'rgb(244, 63, 94)',
};

function resolveChartTheme(): ChartTheme {
  if (typeof document === 'undefined') return FALLBACK;
  const rootStyle = getComputedStyle(document.documentElement);
  const out = {} as ChartTheme;
  (Object.keys(VAR_MAP) as (keyof ChartTheme)[]).forEach((key) => {
    const raw = rootStyle.getPropertyValue(VAR_MAP[key]).trim();
    // culori 解析不了（含空串 / var() 等）时回退 FALLBACK，绝不把原字符串泄露给 zrender
    const parsed = raw ? parse(raw) : undefined;
    out[key] = parsed ? formatRgb(parsed) : FALLBACK[key];
  });
  return out;
}

/** 给颜色叠加透明度（用于图表面积渐变的透明尾巴）。
 *  culori 原生解析 oklch/hex/rgb/hsl/命名色；解析失败（含 undefined / 非字符串）
 *  时返回带 fallback 的 rgba，避免 zrender 在 addColorStop 里撞到 'undefined'。*/
export function withAlpha(
  color: string | undefined | null,
  alpha: number,
): string {
  const parsed = color && typeof color === 'string' ? parse(color) : undefined;
  if (!parsed) return `rgba(120, 134, 170, ${alpha})`;
  return formatRgb({ ...parsed, alpha });
}

export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>(resolveChartTheme);

  useEffect(() => {
    const recompute = () => setTheme(resolveChartTheme());
    // 主题切换后 CSS 变量可能在下一帧才落定，rAF 兜一手。
    const observer = new MutationObserver(() =>
      requestAnimationFrame(recompute),
    );
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-color-scheme'],
    });
    return () => observer.disconnect();
  }, []);

  return theme;
}
