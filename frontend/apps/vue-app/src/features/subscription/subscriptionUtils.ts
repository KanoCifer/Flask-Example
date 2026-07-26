import type {
  CreateSubscriptionPayload,
  Subscription,
  UpdateSubscriptionPayload,
} from '@/features/rss/api';
import type {
  ReminderFormState,
  SubscriptionFormState,
  SubscriptionStatusMeta,
} from './types';

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
 * 创建订阅表单默认值
 */
export function createDefaultSubscriptionForm(): SubscriptionFormState {
  return {
    name: '',
    provider: '',
    price: '',
    currency: 'USD',
    billing_cycle: 'monthly',
    next_billing_date: getDefaultNextBillingDate(),
    status: 'active',
    notes: '',
  };
}

/**
 * 创建提醒表单默认值
 */
export function createDefaultReminderForm(): ReminderFormState {
  return {
    channels: [],
    days_30: false,
    days_7: true,
    days_3: false,
    days_1: true,
    day_of: true,
    email: '',
    feishu_webhook_url: '',
    bark_device_key: '',
  };
}

/**
 * 类型安全地将 unknown 转为 string[]
 */
export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

/**
 * 把 reminder_config 映射为表单状态
 */
export function createReminderFormState(
  config: Record<string, unknown> | null,
): ReminderFormState {
  const reminderConfig = config ?? {};
  return {
    channels: toStringArray(reminderConfig.channels),
    days_30: Boolean(reminderConfig.days_30),
    days_7: Boolean(reminderConfig.days_7),
    days_3: Boolean(reminderConfig.days_3),
    days_1: Boolean(reminderConfig.days_1),
    day_of:
      reminderConfig.day_of === undefined
        ? true
        : Boolean(reminderConfig.day_of),
    email: typeof reminderConfig.email === 'string' ? reminderConfig.email : '',
    feishu_webhook_url:
      typeof reminderConfig.feishu_webhook_url === 'string'
        ? reminderConfig.feishu_webhook_url
        : '',
    bark_device_key:
      typeof reminderConfig.bark_device_key === 'string'
        ? reminderConfig.bark_device_key
        : '',
  };
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
 * 获取状态样式元数据
 */
export function getStatusMeta(status: string): SubscriptionStatusMeta {
  switch (status) {
    case 'paused':
      return {
        label: '已暂停',
        dotClass: 'bg-amber-500',
        badgeClass:
          'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
      };
    case 'canceled':
      return {
        label: '已取消',
        dotClass: 'bg-red-500',
        badgeClass:
          'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
      };
    case 'expired':
      return {
        label: '已过期',
        dotClass: 'bg-slate-500',
        badgeClass:
          'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
      };
    default:
      return {
        label: '进行中',
        dotClass: 'bg-emerald-500',
        badgeClass:
          'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
      };
  }
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
 * 校验订阅表单
 */
export function validateSubscriptionForm(
  form: SubscriptionFormState,
): string | null {
  const name = form.name.trim();
  const provider = form.provider.trim();
  if (!name || !provider) {
    return '请填写订阅名称和服务商。';
  }

  const price = Number.parseFloat(form.price);
  if (!Number.isFinite(price) || price <= 0) {
    return '请输入大于 0 的价格。';
  }

  const currency = form.currency.trim();
  if (!currency) {
    return '请输入货币单位。';
  }
  if (currency.length > 10) {
    return '货币单位长度不能超过 10 个字符。';
  }
  if (!form.next_billing_date) {
    return '请选择下次扣费日期。';
  }
  return null;
}

/**
 * 创建请求体映射
 */
export function toCreatePayload(
  form: SubscriptionFormState,
): CreateSubscriptionPayload {
  return {
    name: form.name.trim(),
    provider: form.provider.trim(),
    price: Number.parseFloat(form.price),
    currency: form.currency.trim(),
    billing_cycle: form.billing_cycle,
    next_billing_date: form.next_billing_date,
    status: 'active',
    notes: form.notes.trim() || null,
  };
}

/**
 * 更新请求体映射
 */
export function toUpdatePayload(
  form: SubscriptionFormState,
): UpdateSubscriptionPayload {
  return {
    name: form.name.trim(),
    provider: form.provider.trim(),
    price: Number.parseFloat(form.price),
    currency: form.currency.trim(),
    billing_cycle: form.billing_cycle,
    next_billing_date: form.next_billing_date,
    status: form.status,
    notes: form.notes.trim() || null,
  };
}

/**
 * 生成提醒配置 payload
 */
export function createReminderPayload(
  form: ReminderFormState,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    channels: form.channels,
    days_30: form.days_30,
    days_7: form.days_7,
    days_3: form.days_3,
    days_1: form.days_1,
    day_of: form.day_of,
  };

  const email = form.email.trim();
  const feishuWebhookUrl = form.feishu_webhook_url.trim();
  const barkDeviceKey = form.bark_device_key.trim();
  if (email) payload.email = email;
  if (feishuWebhookUrl) payload.feishu_webhook_url = feishuWebhookUrl;
  if (barkDeviceKey) payload.bark_device_key = barkDeviceKey;

  return payload;
}

/**
 * 是否开启任意提醒时间点
 */
export function hasEnabledReminderPoint(form: ReminderFormState): boolean {
  return (
    form.days_30 || form.days_7 || form.days_3 || form.days_1 || form.day_of
  );
}

/**
 * 提醒渠道文本
 */
export function getReminderChannelsText(
  config: Record<string, unknown> | null,
): string {
  const channels = toStringArray(config?.channels);
  if (channels.length === 0) return '未配置';
  return channels.join('、');
}

/**
 * 提醒时间点文本
 */
export function getReminderPointsText(
  config: Record<string, unknown> | null,
): string {
  if (!config) return '未配置';
  const points: string[] = [];
  if (config.days_30) points.push('提前 30 天');
  if (config.days_7) points.push('提前 7 天');
  if (config.days_3) points.push('提前 3 天');
  if (config.days_1) points.push('提前 1 天');
  if (config.day_of === undefined || Boolean(config.day_of))
    points.push('当天');
  return points.length > 0 ? points.join('、') : '未配置';
}

/**
 * 同步表单数据
 */
export function applyFormValues(
  target: SubscriptionFormState,
  source: SubscriptionFormState,
): void {
  target.name = source.name;
  target.provider = source.provider;
  target.price = source.price;
  target.currency = source.currency;
  target.billing_cycle = source.billing_cycle;
  target.next_billing_date = source.next_billing_date;
  target.status = source.status;
  target.notes = source.notes;
}

/**
 * 同步提醒表单数据
 */
export function applyReminderFormValues(
  target: ReminderFormState,
  source: ReminderFormState,
): void {
  target.channels = [...source.channels];
  target.days_30 = source.days_30;
  target.days_7 = source.days_7;
  target.days_3 = source.days_3;
  target.days_1 = source.days_1;
  target.day_of = source.day_of;
  target.email = source.email;
  target.feishu_webhook_url = source.feishu_webhook_url;
  target.bark_device_key = source.bark_device_key;
}

/**
 * 订阅实体映射为编辑表单
 */
export function mapSubscriptionToForm(
  subscription: Subscription,
): SubscriptionFormState {
  return {
    name: subscription.name,
    provider: subscription.provider,
    price: String(subscription.price),
    currency: subscription.currency,
    billing_cycle: subscription.billing_cycle,
    next_billing_date: toDateInputValue(subscription.next_billing_date),
    status: subscription.status,
    notes: subscription.notes ?? '',
  };
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
