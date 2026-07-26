import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  ReminderFormState,
  Subscription,
} from '@/features/subscription/types';
import { ref } from 'vue';

// ── gateway mock ─────────────────────────────────────────────────
const updateReminders = vi.fn();
const testNotification = vi.fn();

vi.mock('@/features/rss/api', () => ({
  subscriptionGateway: {
    updateReminders: (...args: unknown[]) => updateReminders(...args),
    testNotification: (...args: unknown[]) => testNotification(...args),
  },
}));

// ── notification store mock ──────────────────────────────────────
const success = vi.fn();
const error = vi.fn();
vi.mock('@/stores/notification', () => ({
  useNotificationStore: () => ({
    success,
    error,
  }),
}));

function makeSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 1,
    name: 'Netflix',
    provider: 'Netflix',
    price: 99,
    currency: 'CNY',
    billing_cycle: 'monthly',
    next_billing_date: '2026-08-01',
    reminder_config: {
      channels: ['email'],
      days_7: true,
      email: 'user@example.com',
    },
    status: 'active',
    notes: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeForm(
  overrides: Partial<ReminderFormState> = {},
): ReminderFormState {
  return {
    channels: ['email'],
    days_30: false,
    days_7: true,
    days_3: false,
    days_1: true,
    day_of: true,
    email: 'user@example.com',
    feishu_webhook_url: '',
    bark_device_key: '',
    ...overrides,
  };
}

describe('useReminderConfig', () => {
  beforeEach(async () => {
    vi.resetModules();
    updateReminders.mockReset();
    testNotification.mockReset();
    success.mockReset();
    error.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('初始关闭 + 默认表单', async () => {
    const { useReminderConfig: hook } = await import('../useReminderConfig');
    const subscriptions = ref<Subscription[]>([]);
    const r = hook(subscriptions);
    expect(r.isReminderModalOpen.value).toBe(false);
    expect(r.reminderTargetId.value).toBeNull();
    expect(r.reminderForm.channels).toEqual([]);
  });

  it('openReminderModal 回填表单 + 记录 targetId + 打开弹窗', async () => {
    const { useReminderConfig: hook } = await import('../useReminderConfig');
    const subscriptions = ref<Subscription[]>([]);
    const r = hook(subscriptions);
    const sub = makeSubscription({
      reminder_config: { channels: ['feishu'], days_3: true },
    });

    r.openReminderModal(sub);

    expect(r.isReminderModalOpen.value).toBe(true);
    expect(r.reminderTargetId.value).toBe(1);
    expect(r.reminderForm.channels).toEqual(['feishu']);
    expect(r.reminderForm.days_3).toBe(true);
    expect(r.reminderTestResult.value).toBeNull();
  });

  it('handleSaveReminderConfigFromForm 渠道为空 → 写错误不请求', async () => {
    const { useReminderConfig: hook } = await import('../useReminderConfig');
    const subscriptions = ref<Subscription[]>([]);
    const r = hook(subscriptions);
    r.openReminderModal(makeSubscription());

    await r.handleSaveReminderConfigFromForm(makeForm({ channels: [] }));

    expect(r.reminderFormError.value).toBe('请至少选择一个通知渠道。');
    expect(updateReminders).not.toHaveBeenCalled();
  });

  it('handleSaveReminderConfigFromForm 无提醒时间点 → 写错误不请求', async () => {
    const { useReminderConfig: hook } = await import('../useReminderConfig');
    const subscriptions = ref<Subscription[]>([]);
    const r = hook(subscriptions);
    r.openReminderModal(makeSubscription());

    await r.handleSaveReminderConfigFromForm(
      makeForm({
        days_30: false,
        days_7: false,
        days_3: false,
        days_1: false,
        day_of: false,
      }),
    );

    expect(r.reminderFormError.value).toBe('请至少选择一个提醒时间点。');
    expect(updateReminders).not.toHaveBeenCalled();
  });

  it('handleSaveReminderConfigFromForm 成功：upsert 列表 + 关闭弹窗', async () => {
    const updated = makeSubscription({ id: 1, name: 'Configured' });
    updateReminders.mockResolvedValueOnce(updated);

    const { useReminderConfig: hook } = await import('../useReminderConfig');
    const subscriptions = ref<Subscription[]>([makeSubscription()]);
    const r = hook(subscriptions);
    r.openReminderModal(subscriptions.value[0]);

    await r.handleSaveReminderConfigFromForm(makeForm());

    expect(updateReminders).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ channels: ['email'] }),
    );
    expect(subscriptions.value[0].name).toBe('Configured');
    expect(r.isReminderModalOpen.value).toBe(false);
    expect(success).toHaveBeenCalledWith('通知配置已保存');
  });

  it('handleSaveReminderConfigFromForm 失败：写 reminderFormError', async () => {
    updateReminders.mockRejectedValueOnce(new Error('保存失败'));

    const { useReminderConfig: hook } = await import('../useReminderConfig');
    const subscriptions = ref<Subscription[]>([makeSubscription()]);
    const r = hook(subscriptions);
    r.openReminderModal(subscriptions.value[0]);

    await r.handleSaveReminderConfigFromForm(makeForm());

    expect(r.reminderFormError.value).toBe('保存失败');
    expect(r.isReminderModalOpen.value).toBe(true);
  });

  it('handleTestNotificationFromForm 渠道为空 → 写错误不请求', async () => {
    const { useReminderConfig: hook } = await import('../useReminderConfig');
    const subscriptions = ref<Subscription[]>([]);
    const r = hook(subscriptions);
    r.openReminderModal(makeSubscription());

    await r.handleTestNotificationFromForm(makeForm({ channels: [] }));

    expect(r.reminderFormError.value).toBe('测试前请先选择至少一个通知渠道。');
    expect(testNotification).not.toHaveBeenCalled();
  });

  it('handleTestNotificationFromForm 成功：写 testResult + 提示', async () => {
    testNotification.mockResolvedValueOnce({ email: true });

    const { useReminderConfig: hook } = await import('../useReminderConfig');
    const subscriptions = ref<Subscription[]>([makeSubscription()]);
    const r = hook(subscriptions);
    r.openReminderModal(subscriptions.value[0]);

    await r.handleTestNotificationFromForm(makeForm());

    expect(testNotification).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ channels: ['email'] }),
    );
    expect(r.reminderTestResult.value).toEqual({ email: true });
    expect(success).toHaveBeenCalledWith('测试通知发送成功（1/1）');
  });

  it('handleTestNotificationFromForm 全失败：notifier.error', async () => {
    testNotification.mockResolvedValueOnce({ email: false, bark: false });

    const { useReminderConfig: hook } = await import('../useReminderConfig');
    const subscriptions = ref<Subscription[]>([makeSubscription()]);
    const r = hook(subscriptions);
    r.openReminderModal(subscriptions.value[0]);

    await r.handleTestNotificationFromForm(
      makeForm({ channels: ['email', 'bark'] }),
    );

    expect(r.reminderTestResult.value).toEqual({ email: false, bark: false });
    expect(error).toHaveBeenCalledWith('测试通知发送失败，请检查渠道配置。');
  });

  it('handleTestNotificationFromForm 异常：写 reminderFormError', async () => {
    testNotification.mockRejectedValueOnce(new Error('网络异常'));

    const { useReminderConfig: hook } = await import('../useReminderConfig');
    const subscriptions = ref<Subscription[]>([makeSubscription()]);
    const r = hook(subscriptions);
    r.openReminderModal(subscriptions.value[0]);

    await r.handleTestNotificationFromForm(makeForm());

    expect(r.reminderFormError.value).toBe('网络异常');
  });
});
