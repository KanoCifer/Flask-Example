import { apiClient } from '../apiClient';
import type { ApiResponse } from '../types';
import type { EventItem, StatusDetailData } from '@readinglist/types';

// ── 服务状态网关（Vue / React 共享）──

export interface StatusGateway {
  /** 获取服务状态详情 */
  fetchStatusDetail(): Promise<StatusDetailData>;
}

export const statusGateway: StatusGateway = {
  async fetchStatusDetail(): Promise<StatusDetailData> {
    const res = await apiClient.get<ApiResponse<StatusDetailData>>(
      'v3/status/detail',
    );
    return res.data.data;
  },
};

export interface FetchRecentEventsOptions {
  /** 默认 10 */
  perPage?: number;
  /** 按事件类型过滤，如 startup / deploy */
  type?: string;
}

/**
 * 取最近 N 条服务事件（按时间倒序），用于 StatusView「最近事件」卡片。
 * 后端复用 /v3/system/events，仅调整 per_page / type。
 */
export async function fetchRecentEvents(
  options: FetchRecentEventsOptions = {},
): Promise<EventItem[]> {
  const { perPage = 10, type } = options;
  const params: Record<string, string | number> = {
    page: 1,
    per_page: perPage,
  };
  if (type) params.type = type;
  const res = await apiClient.get<ApiResponse<unknown>>('v3/system/events', {
    params,
  });
  return (res.data.data as EventItem[]) ?? [];
}
