import type { ReadStatsMode } from '@/features/books/api';

const COMPARE_REF: Record<ReadStatsMode, string> = {
  weekly: '上周',
  monthly: '上月',
  annually: '去年',
  overall: '',
};

/**
 * 同比 / 环比的中文描述片段。返回空串表示无可比数据。
 *
 * 例:`weekly` 模式、`compare = 0.12` → `" · 比上周多 12%"`
 *     `compare = null` / `pct === 0`   → `""`
 */
export function formatCompareSentence(
  val: number | null | undefined,
  mode: ReadStatsMode,
): string {
  if (val == null) return '';
  const pct = Math.round(Math.abs(val) * 100);
  if (pct === 0) return '';
  const dir = val >= 0 ? '多' : '少';
  const ref = COMPARE_REF[mode];
  return ` · 比${ref}${dir} ${pct}%`;
}
