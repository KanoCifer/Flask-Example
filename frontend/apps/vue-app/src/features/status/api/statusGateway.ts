import { apiClient } from '@/api/request';
import { type ApiResponse } from '@/lib';

import type { StatusDetailData } from '@/features/status/types';

export async function fetchStatusDetail(): Promise<StatusDetailData> {
  const res =
    await apiClient.get<ApiResponse<StatusDetailData>>('v3/status/detail');
  return res.data.data;
}
