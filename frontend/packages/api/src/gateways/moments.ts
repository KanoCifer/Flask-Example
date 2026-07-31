import { apiClient } from '../apiClient';
import type {
  ListAdminMomentsParams,
  ListPublicMomentsParams,
  Moment,
  MomentCreatePayload,
  MomentListResponse,
  MomentUpdatePayload,
} from '@readinglist/types';

// ── 碎碎念网关 —— 对齐 v3 后端 `response.Success(c, data, msg)` 信封 ──
//
// 后端响应形状:{ data: <payload>, message: "..." }
// 单条端点返回的是 Moment 本身,列表端点是 { moments, pagination }。
// 网关解包后,契约与前端 store / composer 期望的形状对齐:
//   - get / getAdmin / create / update → 直接返回 Moment
//   - listPublic / listAdmin          → 展平 pagination 为顶层 { total, page, page_size }

interface RawMomentList {
  moments: Moment[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
  };
}

function flattenList(raw: RawMomentList): MomentListResponse {
  return {
    moments: raw.moments,
    total: raw.pagination.total,
    page: raw.pagination.page,
    page_size: raw.pagination.per_page,
  };
}

export interface MomentsGateway {
  listPublic(params?: ListPublicMomentsParams): Promise<MomentListResponse>;
  listAdmin(params?: ListAdminMomentsParams): Promise<MomentListResponse>;
  get(id: string): Promise<Moment>;
  getAdmin(id: string): Promise<Moment>;
  create(payload: MomentCreatePayload): Promise<Moment>;
  update(id: string, payload: MomentUpdatePayload): Promise<Moment>;
  remove(id: string): Promise<void>;
}

export const momentsGateway: MomentsGateway = {
  async listPublic(params) {
    const res = await apiClient.get<{ data: RawMomentList }>('v3/moments', {
      params,
    });
    return flattenList(res.data.data);
  },

  async listAdmin(params) {
    const res = await apiClient.get<{ data: RawMomentList }>(
      'v3/moments/admin',
      { params },
    );
    return flattenList(res.data.data);
  },

  async get(id) {
    const res = await apiClient.get<{ data: Moment }>(`v3/moments/${id}`);
    return res.data.data;
  },

  async getAdmin(id) {
    const res = await apiClient.get<{ data: Moment }>(
      `v3/moments/admin/${id}`,
    );
    return res.data.data;
  },

  async create(payload) {
    const res = await apiClient.post<{ data: Moment }>('v3/moments', payload);
    return res.data.data;
  },

  async update(id, payload) {
    const res = await apiClient.patch<{ data: Moment }>(
      `v3/moments/${id}`,
      payload,
    );
    return res.data.data;
  },

  async remove(id) {
    await apiClient.delete(`v3/moments/${id}`);
  },
};