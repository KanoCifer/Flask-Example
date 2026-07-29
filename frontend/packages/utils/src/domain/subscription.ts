import type { Subscription } from '@readinglist/types';

/**
 * 默认周期选项
 */
export const cycleOptions = [
  { value: 'monthly', label: '月付' },
  { value: 'quarterly', label: '季付' },
  { value: 'yearly', label: '年付' },
  { value: 'weekly', label: '周付' },
  { value: 'daily', label: '日付' },
];

/**
 * 默认状态选项
 */
export const statusOptions = [
  { value: 'active', label: '进行中' },
  { value: 'paused', label: '已暂停' },
  { value: 'canceled', label: '已取消' },
  { value: 'expired', label: '已过期' },
];

/**
 * 默认通知渠道选项
 */
export const channelOptions = [
  { value: 'email', label: '邮件' },
  { value: 'feishu', label: '飞书' },
  { value: 'bark', label: 'Bark' },
];

/**
 * 默认提醒时间点选项
 */
export const reminderPointOptions = [
  { key: 'days_30', label: '提前 30 天' },
  { key: 'days_7', label: '提前 7 天' },
  { key: 'days_3', label: '提前 3 天' },
  { key: 'days_1', label: '提前 1 天' },
  { key: 'day_of', label: '当天提醒' },
] as const;

/**
 * 默认币种建议
 */
export const currencySuggestions = ['USD', 'CNY', 'EUR', 'JPY', 'HKD', 'GBP'];

/**
 * 获取默认下次扣费日期（30天后）
 */
export function getDefaultNextBillingDate(): string {
  const nextMonth = new Date();
  nextMonth.setDate(nextMonth.getDate() + 30);
  const year = nextMonth.getFullYear();
  const month = String(nextMonth.getMonth() + 1).padStart(2, '0');
  const day = String(nextMonth.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 将任意日期字符串规范为 yyyy-mm-dd
 */
export function toDateInputValue(value: string): string {
  const match = /^\d{4}-\d{2}-\d{2}/.exec(value);
  if (match) return match[0];
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 计算订阅月度成本估算
 */
export function getMonthlyEstimate(subscription: Subscription): number {
  const price = Number(subscription.price) || 0;
  switch (subscription.billing_cycle) {
    case 'yearly':
      return price / 12;
    case 'quarterly':
      return price / 3;
    case 'weekly':
      return (price * 52) / 12;
    case 'daily':
      return price * 30;
    default:
      return price;
  }
}

/**
 * 计算距离目标日期还剩天数
 */
export function getDaysUntil(dateValue: string): number {
  const target = new Date(dateValue);
  if (Number.isNaN(target.getTime())) return 0;
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.max(Math.ceil(diff / (1000 * 60 * 60 * 24)), 0);
}

/**
 * 获取周期文案
 */
export function getCycleLabel(cycle: string): string {
  const matched = cycleOptions.find((option) => option.value === cycle);
  return matched?.label ?? cycle;
}

/**
 * 价格格式化
 */
export function formatPrice(price: number, currency: string): string {
  const upperCurrency = currency.toUpperCase();
  if (upperCurrency === 'CNY' || upperCurrency === 'RMB') {
    return `¥${price.toFixed(2)}`;
  }
  if (upperCurrency === 'USD') {
    return `$${price.toFixed(2)}`;
  }
  if (upperCurrency === 'EUR') {
    return `€${price.toFixed(2)}`;
  }
  return `${currency} ${price.toFixed(2)}`;
}

/**
 * 更新数组中的订阅项
 */
export function upsertSubscription(
  items: Subscription[],
  updated: Subscription,
): Subscription[] {
  return items.map((item) => (item.id === updated.id ? updated : item));
}

/**
 * 类型安全地将 unknown 转为 string[]
 */
export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}
