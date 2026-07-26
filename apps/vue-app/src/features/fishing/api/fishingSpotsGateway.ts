import { apiClient } from '@/api/request';

import type {
  CreateFishingSpotPayload,
  FishingSpot,
  UpdateFishingSpotPayload,
} from '@/features/fishing/types';

// ── 与 go-backend 对齐 —— 单一真源在后端（dto/fish.go + document/fishing_spot.go），前端镜像。 ──

const ApiVersion = 'v3';
const ApiUrlBase = `${ApiVersion}/fish/`;

/** 软删 / 物理删除选项 —— 与 handler DeleteFishingSpot ?hard=true 对齐 */
export interface DeleteFishingSpotOptions {
  /** true = 物理删除；省略 / false = 软删（设 DeletedAt） */
  hard?: boolean;
}

export interface FishingSpotsGateway {
  list(): Promise<FishingSpot[]>;
  getByID(id: string): Promise<FishingSpot>;
  create(payload: CreateFishingSpotPayload): Promise<void>;
  update(id: string, payload: UpdateFishingSpotPayload): Promise<void>;
  remove(id: string, options?: DeleteFishingSpotOptions): Promise<void>;
}

export const fishingSpotsGateway: FishingSpotsGateway = {
  async list(): Promise<FishingSpot[]> {
    const res = await apiClient.get<{ data: FishingSpot[] }>(
      `${ApiUrlBase}spots`,
    );
    return res.data.data;
  },

  async getByID(id: string): Promise<FishingSpot> {
    const res = await apiClient.get<{ data: FishingSpot }>(
      `${ApiUrlBase}spots/${id}`,
    );
    return res.data.data;
  },

  async create(payload: CreateFishingSpotPayload): Promise<void> {
    await apiClient.post(`${ApiUrlBase}spots`, payload);
  },

  async update(id: string, payload: UpdateFishingSpotPayload): Promise<void> {
    await apiClient.patch(`${ApiUrlBase}spots/${id}`, payload);
  },

  async remove(
    id: string,
    options: DeleteFishingSpotOptions = {},
  ): Promise<void> {
    await apiClient.delete(`${ApiUrlBase}spots/${id}`, {
      params: { hard: options.hard ? 'true' : undefined },
    });
  },
};
