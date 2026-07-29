import type {
  CreateSubscriptionPayload,
  Subscription,
  UpdateSubscriptionPayload,
} from '@readinglist/utils';
import type { ReminderFormState, SubscriptionFormState } from './types';
import {
  toStringArray,
  getDefaultNextBillingDate,
  toDateInputValue,
} from '@readinglist/utils';

// ── 领域纯函数已迁移到 @readinglist/utils/domain/subscription.ts ─────────────
// 重新导出以保持现有 import 路径兼容。
export {
  cycleOptions,
  statusOptions,
  channelOptions,
  reminderPointOptions,
  currencySuggestions,
  getDefaultNextBillingDate,
  toDateInputValue,
  getMonthlyEstimate,
  getDaysUntil,
  getCycleLabel,
  formatPrice,
  upsertSubscription,
} from '@readinglist/utils';

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
 * 获取状态样式元数据
 */
export function getStatusMeta(status: string): {
  label: string;
  dotClass: string;
  badgeClass: string;
} {
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
