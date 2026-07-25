/**
 * 把 design-system 的 CSS 变量值（oklch / hex / rgb / 命名色）解析成
 * ECharts 能吃的 'rgb(r, g, b)' / 'rgba(r, g, b, a)' 字符串。
 *
 * 为什么：ECharts 内部对 oklch() 支持不完整，做透明度叠加时会 silent fail。
 * culori 原生解析 oklch/hex/rgb/hsl/命名色，统一 formatRgb 吐 CSSOM 标准
 * 的 rgb()/rgba()，无需依赖 <canvas>（因此在 SSR / 无 DOM 环境也可复用）。
 *
 * 用法：
 *   resolveCssColor('--primary', '#3b82f6')
 */

import { formatRgb, parse } from 'culori';

/**
 * 读取 :root 上的 CSS 变量，返回 culori 解析后的标准 rgb 字符串。
 * 仅用在客户端(onMounted)——CSS 变量在此时已存在,解析到对应 rgb。
 * fallback 供解析失败或 SSR 兜底;默认黑色,保证 ECharts 一定拿到合法色值。
 */
export function resolveCssColor(cssVar: string, fallback = '#000000'): string {
  if (typeof document === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(cssVar)
    .trim();
  if (!raw) return fallback;

  const parsed = parse(raw);
  // culori 无法解析时返回 undefined —— 兜回 fallback，绝不把原字符串泄露给 ECharts
  if (!parsed) return fallback;
  return formatRgb(parsed);
}
