import { apiClient } from '@/api/request';
import { type ApiResponse } from '@/lib';

export interface EventItem {
  id: number;
  timestamp: string;
  type: string;
  source: string;
  title: string;
  message: string;
  extra: Record<string, unknown>;
}

export interface EventListData {
  items: EventItem[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    pages: number;
  };
}

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
  const res = await apiClient.get<ApiResponse<EventListData>>(
    'v3/system/events',
    { params },
  );
  return res.data.data.items;
}
