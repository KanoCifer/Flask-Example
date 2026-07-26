import { apiClient } from '@/api/request';

import type {
  CreateSubscriptionPayload,
  Subscription,
  TestNotificationPayload,
  UpdateSubscriptionPayload,
} from '@/features/subscription/types';

export interface SubscriptionGateway {
  /** 获取订阅列表 */
  getSubscriptions(): Promise<Subscription[]>;
  /** 获取单个订阅详情 */
  getSubscription(subId: number): Promise<Subscription>;
  /** 创建订阅 */
  createSubscription(payload: CreateSubscriptionPayload): Promise<Subscription>;
  /** 更新订阅 */
  updateSubscription(
    subId: number,
    payload: UpdateSubscriptionPayload,
  ): Promise<Subscription>;
  /** 删除订阅 */
  deleteSubscription(subId: number): Promise<void>;
  /** 更新订阅状态 */
  updateStatus(subId: number, newStatus: string): Promise<Subscription>;
  /** 更新订阅提醒配置 */
  updateReminders(
    subId: number,
    reminderData: Record<string, unknown>,
  ): Promise<Subscription>;
  /** 获取即将到期的订阅 */
  getUpcomingSubscriptions(): Promise<Subscription[]>;
  /** 测试通知 */
  testNotification(
    subId: number,
    payload: TestNotificationPayload,
  ): Promise<Record<string, boolean>>;
  /** 获取用户全局默认通知配置 */
  getUserGlobalConfig(): Promise<Record<string, unknown>>;
  /** 更新用户全局默认通知配置 */
  updateUserGlobalConfig(
    configData: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
}

export const subscriptionGateway: SubscriptionGateway = {
  async getSubscriptions(): Promise<Subscription[]> {
    const res = await apiClient.get<{
      data: { subscriptions: Subscription[] };
    }>('v2/subscriptions');
    return res.data.data.subscriptions;
  },

  async getSubscription(subId: number): Promise<Subscription> {
    const res = await apiClient.get<{ data: { subscription: Subscription } }>(
      `v2/subscriptions/${subId}`,
    );
    return res.data.data.subscription;
  },

  async createSubscription(
    payload: CreateSubscriptionPayload,
  ): Promise<Subscription> {
    const res = await apiClient.post<{ data: { subscription: Subscription } }>(
      'v2/subscriptions',
      payload,
    );
    return res.data.data.subscription;
  },

  async updateSubscription(
    subId: number,
    payload: UpdateSubscriptionPayload,
  ): Promise<Subscription> {
    const res = await apiClient.put<{ data: { subscription: Subscription } }>(
      `v2/subscriptions/${subId}`,
      payload,
    );
    return res.data.data.subscription;
  },

  async deleteSubscription(subId: number): Promise<void> {
    await apiClient.delete(`v2/subscriptions/${subId}`);
  },

  async updateStatus(subId: number, newStatus: string): Promise<Subscription> {
    const res = await apiClient.patch<{ data: { subscription: Subscription } }>(
      `v2/subscriptions/${subId}/status`,
      undefined,
      {
        params: { new_status: newStatus },
      },
    );
    return res.data.data.subscription;
  },

  async updateReminders(
    subId: number,
    reminderData: Record<string, unknown>,
  ): Promise<Subscription> {
    const res = await apiClient.patch<{ data: { subscription: Subscription } }>(
      `v2/subscriptions/${subId}/reminders`,
      reminderData,
    );
    return res.data.data.subscription;
  },

  async getUpcomingSubscriptions(): Promise<Subscription[]> {
    const res = await apiClient.get<{
      data: { subscriptions: Subscription[] };
    }>('v2/subscriptions/upcoming');
    return res.data.data.subscriptions;
  },

  async testNotification(
    subId: number,
    payload: TestNotificationPayload,
  ): Promise<Record<string, boolean>> {
    const res = await apiClient.post<{
      data: { results: Record<string, boolean> };
    }>(`v2/subscriptions/${subId}/test-notification`, payload);
    return res.data.data.results;
  },

  async getUserGlobalConfig(): Promise<Record<string, unknown>> {
    const res = await apiClient.get<{
      data: { config: Record<string, unknown> };
    }>('v2/subscriptions/global-config');
    return res.data.data.config;
  },

  async updateUserGlobalConfig(
    configData: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const res = await apiClient.put<{
      data: { config: Record<string, unknown> };
    }>('v2/subscriptions/global-config', {
      config_data: configData,
    });
    return res.data.data.config;
  },
};
