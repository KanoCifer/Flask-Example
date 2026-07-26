import type { AxiosResponse } from 'axios';

import apiClient from '@/api/apiClient';
import type {
  Moment,
  MomentCreatePayload,
  MomentListResponse,
  MomentStatus,
  MomentUpdatePayload,
} from '@readinglist/types';

interface ListPublicMomentsParams {
  page?: number;
  page_size?: number;
  tag?: string;
}

interface ListAdminMomentsParams {
  page?: number;
  page_size?: number;
  status?: MomentStatus;
}

export interface MomentsGateway {
  listPublic(
    params?: ListPublicMomentsParams,
  ): Promise<AxiosResponse<MomentListResponse>>;
  listAdmin(
    params?: ListAdminMomentsParams,
  ): Promise<AxiosResponse<MomentListResponse>>;
  get(id: string): Promise<AxiosResponse<{ moment: Moment }>>;
  getAdmin(id: string): Promise<AxiosResponse<{ moment: Moment }>>;
  create(
    payload: MomentCreatePayload,
  ): Promise<AxiosResponse<{ moment: Moment }>>;
  update(
    id: string,
    payload: MomentUpdatePayload,
  ): Promise<AxiosResponse<{ moment: Moment }>>;
  remove(id: string): Promise<AxiosResponse<void>>;
}

export const momentsGateway = (): MomentsGateway => {
  return {
    async listPublic(params) {
      return apiClient.get('v3/moments', { params }) as Promise<
        AxiosResponse<MomentListResponse>
      >;
    },

    async listAdmin(params) {
      return apiClient.get('v3/moments/admin', { params }) as Promise<
        AxiosResponse<MomentListResponse>
      >;
    },

    async get(id) {
      return apiClient.get(`v3/moments/${id}`) as Promise<
        AxiosResponse<{ moment: Moment }>
      >;
    },

    async getAdmin(id) {
      return apiClient.get(`v3/moments/admin/${id}`) as Promise<
        AxiosResponse<{ moment: Moment }>
      >;
    },

    async create(payload) {
      return apiClient.post('v3/moments', payload) as Promise<
        AxiosResponse<{ moment: Moment }>
      >;
    },

    async update(id, payload) {
      return apiClient.patch(`v3/moments/${id}`, payload) as Promise<
        AxiosResponse<{ moment: Moment }>
      >;
    },

    async remove(id) {
      return apiClient.delete(`v3/moments/${id}`) as Promise<
        AxiosResponse<void>
      >;
    },
  };
};
