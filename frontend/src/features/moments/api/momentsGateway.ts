import { apiClient } from '@/api/request';
import type {
  ListAdminMomentsParams,
  ListPublicMomentsParams,
  Moment,
  MomentCreatePayload,
  MomentListResponse,
  MomentUpdatePayload,
} from '@/features/moments/types';

export interface MomentsGateway {
  listPublic(params?: ListPublicMomentsParams): Promise<MomentListResponse>;
  listAdmin(params?: ListAdminMomentsParams): Promise<MomentListResponse>;
  get(id: string): Promise<{ moment: Moment }>;
  getAdmin(id: string): Promise<{ moment: Moment }>;
  create(payload: MomentCreatePayload): Promise<{ moment: Moment }>;
  update(id: string, payload: MomentUpdatePayload): Promise<{ moment: Moment }>;
  remove(id: string): Promise<void>;
}

export const momentsGateway: MomentsGateway = {
  async listPublic(params) {
    const res = await apiClient.get<{ data: MomentListResponse }>(
      'v3/moments',
      {
        params,
      },
    );
    return res.data.data;
  },

  async listAdmin(params) {
    const res = await apiClient.get<{ data: MomentListResponse }>(
      'v3/moments/admin',
      { params },
    );
    return res.data.data;
  },

  async get(id) {
    const res = await apiClient.get<{ data: { moment: Moment } }>(
      `v3/moments/${id}`,
    );
    return res.data.data;
  },

  async getAdmin(id) {
    const res = await apiClient.get<{ data: { moment: Moment } }>(
      `v3/moments/admin/${id}`,
    );
    return res.data.data;
  },

  async create(payload) {
    const res = await apiClient.post<{ data: { moment: Moment } }>(
      'v3/moments',
      payload,
    );
    return res.data.data;
  },

  async update(id, payload) {
    const res = await apiClient.patch<{ data: { moment: Moment } }>(
      `v3/moments/${id}`,
      payload,
    );
    return res.data.data;
  },

  async remove(id) {
    await apiClient.delete(`v3/moments/${id}`);
  },
};
