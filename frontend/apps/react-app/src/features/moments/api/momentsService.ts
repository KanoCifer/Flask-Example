import { momentsGateway, type MomentsGateway } from '@readinglist/api';
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
  const gateway: MomentsGateway = momentsGateway;

  return {
    async listPublic(params) {
      return gateway.listPublic(params);
    },

    async listAdmin(params) {
      return gateway.listAdmin(params);
    },

    async get(id) {
      return gateway.get(id);
    },

    async getAdmin(id) {
      return gateway.getAdmin(id);
    },

    async create(payload) {
      return gateway.create(payload);
    },

    async update(id, payload) {
      return gateway.update(id, payload);
    },

    async remove(id) {
      await gateway.remove(id);
    },
  };
};
