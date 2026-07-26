/**
 * 微信读书组件内部的纯函数工具。
 *
 * - deterministicCoverGradient: 无封面兜底的稳定渐变色(依赖 bookId 域)
 * - formatProgressPercent:      0-100 进度 → "45%"
 *
 * 通用时长/相对时间格式化已上移到 `utils/date/duration.ts` 与
 * `utils/date/relative.ts`,本文件不再重复。
 */

export function formatProgressPercent(
  percent: number | null | undefined,
): string {
  if (percent == null) return '0%';
  return `${Math.round(percent)}%`;
}

/**
 * 给没有真实封面的书生成稳定的渐变背景色
 * - 基于 bookId 字符串 hash 取色相,保证同一本书每次显示同一个色
 * - 调色板刻意偏"纸感 / 旧书"——避免 AI slop 的紫色渐变
 */
const PAPER_PALETTE: ReadonlyArray<readonly [string, string]> = [
  ['oklch(0.66 0.108 43)', 'oklch(0.43 0.092 41)'], // 焦糖 → 暗红棕
  ['oklch(0.64 0.034 248)', 'oklch(0.43 0.037 246)'], // 雾蓝 → 墨青
  ['oklch(0.69 0.046 87)', 'oklch(0.43 0.042 83)'], // 沙驼 → 橄榄棕
  ['oklch(0.64 0.075 1)', 'oklch(0.42 0.064 360)'], // 干玫瑰 → 酒红
  ['oklch(0.55 0.044 164)', 'oklch(0.35 0.031 159)'], // 烟绿 → 墨绿
  ['oklch(0.57 0.053 73)', 'oklch(0.36 0.039 72)'], // 旧书 → 深咖
  ['oklch(0.70 0.018 350)', 'oklch(0.45 0.040 310)'], // 烟紫 → 灰紫
  ['oklch(0.59 0.089 44)', 'oklch(0.35 0.073 43)'], // 砖红 → 焦糖
];

export function deterministicCoverGradient(bookId: string): string {
  const hash = [...bookId].reduce(
    (acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0,
    7,
  );
  const [a, b] = PAPER_PALETTE[hash % PAPER_PALETTE.length]!;
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}
