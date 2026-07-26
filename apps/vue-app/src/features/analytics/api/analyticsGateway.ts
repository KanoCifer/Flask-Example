import { apiClient } from '@/api/request';
import { type ApiResponse } from '@/lib';

import type {
  AnalyticsOverviewData,
  PostViewData,
} from '@/features/analytics/types';

export interface AnalyticsGateway {
  getOverview(days: number): Promise<AnalyticsOverviewData>;
  getUserLogins(params: {
    days: number;
    page: number;
    page_size: number;
  }): Promise<AnalyticsOverviewData>;
  getPostViews(): Promise<ApiResponse<PostViewData[]>>;
  reportVisitorData(data: Record<string, unknown>): Promise<void>;
}

export const analyticsGateway: AnalyticsGateway = {
  async getOverview(days: number): Promise<AnalyticsOverviewData> {
    const res = await apiClient.get<ApiResponse<Record<string, unknown>>>(
      'v3/status/overview',
      {
        params: { days },
      },
    );
    return res.data;
  },

  async getUserLogins(params: {
    days: number;
    page: number;
    page_size: number;
  }): Promise<AnalyticsOverviewData> {
    const res = await apiClient.get<ApiResponse<Record<string, unknown>>>(
      'v3/status/user-logins',
      {
        params,
      },
    );
    return res.data;
  },

  async getPostViews(): Promise<ApiResponse<PostViewData[]>> {
    const res =
      await apiClient.get<ApiResponse<PostViewData[]>>('v3/post/views');
    return res.data;
  },

  async reportVisitorData(data: Record<string, unknown>): Promise<void> {
    await apiClient.post('/v3/track', data, {
      timeout: 5000,
      withCredentials: true,
    });
  },
};
