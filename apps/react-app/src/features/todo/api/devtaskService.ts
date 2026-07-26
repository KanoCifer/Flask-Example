import devtaskRequest from './devtaskRequest.ts';
import apiClient, { extractData } from '@/api/apiClient.ts';
import type {
  CreateDevTaskPayload,
  DevTask,
  DevTaskListResponse,
  ListDevTasksParams,
  McpTokenResult,
  UpdateDevTaskPayload,
} from './types';

export interface DevTaskService {
  list(params?: ListDevTasksParams): Promise<DevTaskListResponse>;
  get(id: string): Promise<DevTask>;
  create(payload: CreateDevTaskPayload): Promise<DevTask>;
  update(id: string, payload: UpdateDevTaskPayload): Promise<void>;
  remove(id: string): Promise<void>;
  hardDelete(id: string): Promise<void>;
  /** 签发 MCP 服务 Token — 走用户 JWT 的 request（非 service-token） */
  issueMcpToken(days: number): Promise<McpTokenResult>;
}

export const devTaskService = (): DevTaskService => ({
  async list(params): Promise<DevTaskListResponse> {
    const res = await devtaskRequest.get<{ data: DevTaskListResponse }>(
      'v3/dev-tasks',
      {
        params,
      },
    );
    return extractData(res);
  },

  async get(id: string): Promise<DevTask> {
    const res = await devtaskRequest.get<{ data: DevTask }>(
      `v3/dev-tasks/${id}`,
    );
    return extractData(res);
  },

  async create(payload: CreateDevTaskPayload): Promise<DevTask> {
    const res = await devtaskRequest.post<{ data: DevTask }>(
      'v3/dev-tasks',
      payload,
    );
    return extractData(res);
  },

  async update(id: string, payload: UpdateDevTaskPayload): Promise<void> {
    await devtaskRequest.patch(`v3/dev-tasks/${id}`, payload);
  },

  async remove(id: string): Promise<void> {
    await devtaskRequest.delete(`v3/dev-tasks/${id}`);
  },

  async hardDelete(id: string): Promise<void> {
    await devtaskRequest.delete(`v3/dev-tasks/${id}/permanent`);
  },

  async issueMcpToken(days: number): Promise<McpTokenResult> {
    const res = await apiClient.get<{ data: McpTokenResult }>(
      'v3/dev-task/token',
      { params: { days } },
    );
    return extractData(res);
  },
});
