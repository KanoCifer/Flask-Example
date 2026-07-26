import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import utc from 'dayjs/plugin/utc';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);
dayjs.extend(utc);

export default dayjs;

// ── date.ts ──────────────────────────────────────────────────────────

/** 今天日期 YYYY-MM-DD。 */
export function formatToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface WeekRangeOptions {
  /** 0 = Sunday, 1 = Monday (project default). */
  weekStartsOn?: 0 | 1;
}

/** 本周起止日期范围 "YYYY-MM-DD ~ YYYY-MM-DD"。 */
export function formatCurrentWeekRange(opts: WeekRangeOptions = {}): string {
  const { weekStartsOn = 1 } = opts;
  const now = new Date();
  const start = new Date(now);
  const offset = (now.getDay() - weekStartsOn + 7) % 7;
  start.setDate(now.getDate() - offset);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `${fmt(start)} ~ ${fmt(end)}`;
}

// ── formatdate.ts ───────────────────────────────────────────────────

export const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '未知时间';
  return dayjs.utc(dateStr).local().format('YYYY-MM-DD HH:mm:ss');
};

// ── duration.ts ─────────────────────────────────────────────────────

/**
 * 秒数 → 统一的中文时长。
 *
 * - `null` / `undefined` / `<= 0` → `"0 分钟"`
 * - `< 1 小时`                → `"X 分钟"`
 * - `>= 1 小时, m > 0`        → `"X 小时 Y 分钟"`
 * - `>= 1 小时, m === 0`      → `"X 小时"`
 *
 * 替代项目里 4 份手抄副本(useStatsView / BookShelfStatsBar / BentoReadingList /
 * useFishingRoute)与 weread 组件里的 formatReadingTime。
 */
export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '0 分钟';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) {
    return m > 0 ? `${h} 小时 ${m} 分钟` : `${h} 小时`;
  }
  return `${m} 分钟`;
}

// ── relative.ts ─────────────────────────────────────────────────────

/**
 * unix 秒数 / 时间字符串 → 中文相对时间。
 *
 * 输入接受 `number | string | null | undefined`:
 * - 数字:按 unix 秒解释
 * - 字符串:先尝试 `Number()` 解析为 unix 秒,失败再尝试 `Date.parse`(ISO 8601)
 * - 空值:返回 `—`
 *
 * 输出阶梯:
 *   `< 60s`     → 刚刚
 *   `< 1h`      → X 分钟前
 *   `< 24h`     → X 小时前
 *   `< 48h`     → 昨天
 *   `< 30d`     → X 天前
 *   `< 1y`      → X 个月前
 *   `>= 1y`     → X 年前
 *
 * 替代 `views/books/weread/utils/format.ts` 里的同名函数(已补"昨天"分支)
 * 与 `BookShelfStatsBar` 里手抄的 `recencyLabel`。
 */
function toUnixSeconds(t: number | string | null | undefined): number | null {
  if (t == null || t === '') return null;
  const n = typeof t === 'number' ? t : Number(t);
  if (!Number.isNaN(n) && n > 0) return n;
  const ms = Date.parse(String(t));
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}

export function formatRelative(
  time: number | string | null | undefined,
): string {
  const unixSeconds = toUnixSeconds(time);
  if (unixSeconds == null) return '—';
  const diff = Date.now() / 1000 - unixSeconds;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 86400 * 2) return '昨天';
  if (diff < 2592000) return `${Math.floor(diff / 86400)} 天前`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)} 个月前`;
  return `${Math.floor(diff / 31536000)} 年前`;
}
