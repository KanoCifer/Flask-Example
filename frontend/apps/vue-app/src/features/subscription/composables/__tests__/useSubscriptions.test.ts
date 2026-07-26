import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Subscription } from '@/features/subscription/types';

// ── gateway mock ─────────────────────────────────────────────────
const getSubscriptions = vi.fn();
const createSubscription = vi.fn();
const updateSubscription = vi.fn();
const deleteSubscription = vi.fn();
const updateStatus = vi.fn();

vi.mock('@/features/rss/api', () => ({
  subscriptionGateway: {
    getSubscriptions: (...args: unknown[]) => getSubscriptions(...args),
    createSubscription: (...args: unknown[]) => createSubscription(...args),
    updateSubscription: (...args: unknown[]) => updateSubscription(...args),
    deleteSubscription: (...args: unknown[]) => deleteSubscription(...args),
    updateStatus: (...args: unknown[]) => updateStatus(...args),
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
    reminder_config: null,
    status: 'active',
    notes: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('useSubscriptions', () => {
  beforeEach(async () => {
    vi.resetModules();
    getSubscriptions.mockReset();
    createSubscription.mockReset();
    updateSubscription.mockReset();
    deleteSubscription.mockReset();
    updateStatus.mockReset();
    success.mockReset();
    error.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('初始为空列表 + 默认加载态', async () => {
    const { useSubscriptions: hook } = await import('../useSubscriptions');
    const s = hook();
    expect(s.subscriptions.value).toEqual([]);
    expect(s.isLoading.value).toBe(false);
    expect(s.selectedSubId.value).toBeNull();
    expect(s.activeCount.value).toBe(0);
  });

  it('fetchSubscriptions 成功：写入列表并选中首项', async () => {
    const list = [makeSubscription({ id: 1 }), makeSubscription({ id: 2 })];
    getSubscriptions.mockResolvedValueOnce(list);

    const { useSubscriptions: hook } = await import('../useSubscriptions');
    const s = hook();
    await s.fetchSubscriptions();

    expect(s.subscriptions.value).toHaveLength(2);
    expect(s.selectedSubId.value).toBe(1);
    expect(s.isLoading.value).toBe(false);
  });

  it('fetchSubscriptions 失败：写 errorMessage + notifier.error', async () => {
    getSubscriptions.mockRejectedValueOnce(new Error('网络错误'));

    const { useSubscriptions: hook } = await import('../useSubscriptions');
    const s = hook();
    await s.fetchSubscriptions();

    expect(s.errorMessage.value).toBe('网络错误');
    expect(error).toHaveBeenCalledWith('网络错误');
  });

  it('openAddModal 重置表单并打开弹窗', async () => {
    const { useSubscriptions: hook } = await import('../useSubscriptions');
    const s = hook();
    expect(s.isAddModalOpen.value).toBe(false);
    s.openAddModal();
    expect(s.isAddModalOpen.value).toBe(true);
    expect(s.addFormError.value).toBe('');
  });

  it('handleCreateSubscription 校验失败：写 addFormError', async () => {
    const { useSubscriptions: hook } = await import('../useSubscriptions');
    const s = hook();
    // 空名称 → 校验不通过
    const form = { ...s.createForm, name: '', provider: '', price: '' };
    await s.handleCreateSubscription(form);
    expect(s.addFormError.value).toBe('请填写订阅名称和服务商。');
    expect(createSubscription).not.toHaveBeenCalled();
  });

  it('handleCreateSubscription 成功：prepend + 选中 + 关闭弹窗', async () => {
    const created = makeSubscription({ id: 99, name: 'Spotify' });
    createSubscription.mockResolvedValueOnce(created);

    const { useSubscriptions: hook } = await import('../useSubscriptions');
    const s = hook();
    s.openAddModal();
    const form = {
      ...s.createForm,
      name: 'Spotify',
      provider: 'Spotify',
      price: '49',
      currency: 'CNY',
      billing_cycle: 'monthly',
      next_billing_date: '2026-09-01',
      status: 'active',
      notes: '',
    };
    await s.handleCreateSubscription(form);

    expect(s.subscriptions.value[0].id).toBe(99);
    expect(s.selectedSubId.value).toBe(99);
    expect(s.isAddModalOpen.value).toBe(false);
    expect(success).toHaveBeenCalledWith('订阅创建成功');
  });

  it('openEditModal 回填 editForm 并记录 editTargetId', async () => {
    const { useSubscriptions: hook } = await import('../useSubscriptions');
    const s = hook();
    const target = makeSubscription({ id: 7, name: 'iCloud' });
    s.openEditModal(target);
    expect(s.editTargetId.value).toBe(7);
    expect(s.editForm.name).toBe('iCloud');
    expect(s.isEditModalOpen.value).toBe(true);
  });

  it('handleUpdateSubscription 成功：替换列表项 + 关闭弹窗', async () => {
    const updated = makeSubscription({ id: 1, name: 'Netflix Premium' });
    updateSubscription.mockResolvedValueOnce(updated);

    const { useSubscriptions: hook } = await import('../useSubscriptions');
    const s = hook();
    s.subscriptions.value = [makeSubscription({ id: 1 })];
    s.openEditModal(s.subscriptions.value[0]);

    const form = {
      name: 'Netflix Premium',
      provider: 'Netflix',
      price: '120',
      currency: 'CNY',
      billing_cycle: 'monthly',
      next_billing_date: '2026-08-01',
      status: 'active',
      notes: '',
    };
    await s.handleUpdateSubscription(form);

    expect(s.subscriptions.value[0].name).toBe('Netflix Premium');
    expect(s.isEditModalOpen.value).toBe(false);
    expect(success).toHaveBeenCalledWith('订阅信息已更新');
  });

  it('handleToggleStatus 翻转状态并提示', async () => {
    const toggled = makeSubscription({ id: 1, status: 'paused' });
    updateStatus.mockResolvedValueOnce(toggled);

    const { useSubscriptions: hook } = await import('../useSubscriptions');
    const s = hook();
    s.subscriptions.value = [makeSubscription({ id: 1, status: 'active' })];

    await s.handleToggleStatus(s.subscriptions.value[0]);

    expect(updateStatus).toHaveBeenCalledWith(1, 'paused');
    expect(s.subscriptions.value[0].status).toBe('paused');
    expect(success).toHaveBeenCalledWith('订阅已暂停');
  });

  it('handleDeleteSubscription 确认后删除 + 重选首项', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    deleteSubscription.mockResolvedValueOnce(undefined);

    const { useSubscriptions: hook } = await import('../useSubscriptions');
    const s = hook();
    s.subscriptions.value = [
      makeSubscription({ id: 1 }),
      makeSubscription({ id: 2 }),
    ];
    s.selectedSubId.value = 1;

    await s.handleDeleteSubscription(s.subscriptions.value[0]);

    expect(deleteSubscription).toHaveBeenCalledWith(1);
    expect(s.subscriptions.value.map((i) => i.id)).toEqual([2]);
    expect(s.selectedSubId.value).toBe(2);
    expect(success).toHaveBeenCalledWith('订阅已删除');
    vi.unstubAllGlobals();
  });

  it('handleDeleteSubscription 取消则不操作', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false),
    );

    const { useSubscriptions: hook } = await import('../useSubscriptions');
    const s = hook();
    s.subscriptions.value = [makeSubscription({ id: 1 })];

    await s.handleDeleteSubscription(s.subscriptions.value[0]);

    expect(deleteSubscription).not.toHaveBeenCalled();
    expect(s.subscriptions.value).toHaveLength(1);
    vi.unstubAllGlobals();
  });

  it('sortedSubscriptions 按 next_billing_date 升序', async () => {
    const { useSubscriptions: hook } = await import('../useSubscriptions');
    const s = hook();
    s.subscriptions.value = [
      makeSubscription({ id: 1, next_billing_date: '2026-12-01' }),
      makeSubscription({ id: 2, next_billing_date: '2026-06-01' }),
      makeSubscription({ id: 3, next_billing_date: '2026-09-01' }),
    ];
    expect(s.sortedSubscriptions.value.map((i) => i.id)).toEqual([2, 3, 1]);
  });

  it('monthlyEstimate 只累加 active 项', async () => {
    const { useSubscriptions: hook } = await import('../useSubscriptions');
    const s = hook();
    s.subscriptions.value = [
      makeSubscription({
        id: 1,
        status: 'active',
        price: 120,
        billing_cycle: 'monthly',
      }),
      makeSubscription({
        id: 2,
        status: 'paused',
        price: 999,
        billing_cycle: 'monthly',
      }),
      makeSubscription({
        id: 3,
        status: 'active',
        price: 120,
        billing_cycle: 'yearly',
      }),
    ];
    // 120 + 120/12 = 130
    expect(s.monthlyEstimate.value).toBe(130);
  });
});
