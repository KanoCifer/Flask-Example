import devtaskRequest from './devtaskRequest';

import type {
  CreateDevTaskPayload,
  DevTask,
  DevTaskListResponse,
  ListDevTasksParams,
  McpTokenResult,
  UpdateDevTaskPayload,
} from '@/features/todos/types';

// ── 与后端 document/dev_task.go 对齐 —— 单一真源在后端，前端镜像。 ──

export interface DevTaskGateway {
  list(params?: ListDevTasksParams): Promise<DevTaskListResponse>;
  get(slug: string): Promise<DevTask>;
  create(payload: CreateDevTaskPayload): Promise<DevTask>;
  update(slug: string, payload: UpdateDevTaskPayload): Promise<void>;
  remove(slug: string): Promise<void>;
  hardDelete(slug: string): Promise<void>;
  // 签发 MCP / 长期服务 JWT。days: 1..365。
  issueMcpToken(days: number): Promise<McpTokenResult>;
}

export const devTaskGateway: DevTaskGateway = {
  async list(params): Promise<DevTaskListResponse> {
    const res = await devtaskRequest.get<{ data: DevTaskListResponse }>(
      'v3/dev-tasks',
      {
        params,
      },
    );
    return res.data.data;
  },

  async get(slug: string): Promise<DevTask> {
    const res = await devtaskRequest.get<{ data: DevTask }>(
      `v3/dev-tasks/${slug}`,
    );
    return res.data.data;
  },

  async create(payload: CreateDevTaskPayload): Promise<DevTask> {
    const res = await devtaskRequest.post<{ data: DevTask }>(
      'v3/dev-tasks',
      payload,
    );
    return res.data.data;
  },

  async update(slug: string, payload: UpdateDevTaskPayload): Promise<void> {
    await devtaskRequest.patch(`v3/dev-tasks/${slug}`, payload);
  },

  async remove(slug: string): Promise<void> {
    await devtaskRequest.delete(`v3/dev-tasks/${slug}`);
  },

  async hardDelete(slug: string): Promise<void> {
    await devtaskRequest.delete(`v3/dev-tasks/${slug}/permanent`);
  },

  async issueMcpToken(days: number): Promise<McpTokenResult> {
    // 走用户 JWT 的 apiClient（非 service-token），因为这是 admin 身份换长期 token
    const { apiClient } = await import('@/api/request');
    const res = await apiClient.get<{ data: McpTokenResult }>(
      'v3/dev-task/token',
      {
        params: { days },
      },
    );
    return res.data.data;
  },
};
