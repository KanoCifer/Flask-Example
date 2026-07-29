// ── 订阅（Subscription）领域类型 ─────────────────────────────────────────────

/** 订阅数据类型 */
export interface Subscription {
  id: number;
  name: string;
  provider: string;
  price: number;
  currency: string;
  billing_cycle: string;
  next_billing_date: string;
  reminder_config: Record<string, unknown> | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** 创建订阅请求体 */
export interface CreateSubscriptionPayload {
  name: string;
  provider: string;
  price: number;
  currency: string;
  billing_cycle: string;
  next_billing_date: string;
  reminder_config?: Record<string, unknown> | null;
  status: string;
  notes?: string | null;
}

/** 更新订阅请求体 */
export interface UpdateSubscriptionPayload {
  name?: string;
  provider?: string;
  price?: number;
  currency?: string;
  billing_cycle?: string;
  next_billing_date?: string;
  reminder_config?: Record<string, unknown> | null;
  status?: string;
  notes?: string | null;
}

/** 测试通知请求体 */
export interface TestNotificationPayload {
  channels: string[];
  config: Record<string, unknown>;
}
