// ── formatdate.ts ───────────────────────────────────────────────────────────
// 日期格式化。框架无关。
//
// 从 Vue 端 `lib/dayjs.ts` 与 React 端 `lib/formatdate.ts` 迁入，
// 以 React 端为底本（utc 解析 + 本地时区展示），并补上 format 参数。

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

/**
 * 把 UTC 时间字符串按本地时区格式化。
 *
 * @param dateStr UTC 时间字符串（ISO 8601）
 * @param format 输出格式，默认 `YYYY-MM-DD HH:mm:ss`
 */
export function formatDate(
  dateStr: string | null | undefined,
  format: string = 'YYYY-MM-DD HH:mm:ss',
): string {
  if (!dateStr) return '未知时间';
  return dayjs.utc(dateStr).local().format(format);
}
