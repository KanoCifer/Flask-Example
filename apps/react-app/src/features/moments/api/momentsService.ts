import type { AxiosResponse } from 'axios';

import {
  momentsGateway,
  type MomentsGateway,
} from '@/features/moments/api/momentsGateway';
import type { ApiResponse } from '@/api/apiClient';
import { extractData } from '@/api/apiClient';
import type {
  Moment,
  MomentCreatePayload,
  MomentListResponse,
  MomentStatus,
  MomentUpdatePayload,
} from '@/types';

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

export interface MomentsService {
  listPublic(params?: ListPublicMomentsParams): Promise<MomentListResponse>;
  listAdmin(params?: ListAdminMomentsParams): Promise<MomentListResponse>;
  get(id: string): Promise<Moment>;
  getAdmin(id: string): Promise<Moment>;
  create(payload: MomentCreatePayload): Promise<Moment>;
  update(id: string, payload: MomentUpdatePayload): Promise<Moment>;
  remove(id: string): Promise<void>;
}

export const momentsService = (): MomentsService => {
  const gateway: MomentsGateway = momentsGateway();

  const unwrap = <T>(res: AxiosResponse<unknown>): T =>
    extractData(res as unknown as { data: ApiResponse<unknown> }) as T;

  return {
    async listPublic(params) {
      const res = await gateway.listPublic(params);
      return unwrap<MomentListResponse>(res);
    },

    async listAdmin(params) {
      const res = await gateway.listAdmin(params);
      return unwrap<MomentListResponse>(res);
    },

    async get(id) {
      const res = await gateway.get(id);
      return unwrap<{ moment: Moment }>(res).moment;
    },

    async getAdmin(id) {
      const res = await gateway.getAdmin(id);
      return unwrap<{ moment: Moment }>(res).moment;
    },

    async create(payload) {
      const res = await gateway.create(payload);
      return unwrap<{ moment: Moment }>(res).moment;
    },

    async update(id, payload) {
      const res = await gateway.update(id, payload);
      return unwrap<{ moment: Moment }>(res).moment;
    },

    async remove(id) {
      await gateway.remove(id);
    },
  };
};
