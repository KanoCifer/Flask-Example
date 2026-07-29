import { apiClient } from '../apiClient';
import type {
  CreateFishingSpotPayload,
  FishingSpot,
  UpdateFishingSpotPayload,
} from '@readinglist/types';

// ── 钓点网关 —— 与 go-backend 对齐（Vue / React 共享）──

const API_VERSION = 'v3';
const API_URL_BASE = `${API_VERSION}/fish/`;

/** 软删 / 物理删除选项 —— 与 handler DeleteFishingSpot ?hard=true 对齐 */
export interface DeleteFishingSpotOptions {
  /** true = 物理删除；省略 / false = 软删（设 DeletedAt） */
  hard?: boolean;
}

export interface FishingSpotGateway {
  list(): Promise<FishingSpot[]>;
  getByID(id: string): Promise<FishingSpot>;
  create(payload: CreateFishingSpotPayload): Promise<void>;
  update(id: string, payload: UpdateFishingSpotPayload): Promise<void>;
  remove(id: string, options?: DeleteFishingSpotOptions): Promise<void>;
}

export const fishingSpotGateway: FishingSpotGateway = {
  async list(): Promise<FishingSpot[]> {
    const res = await apiClient.get<{ data: FishingSpot[] }>(
      `${API_URL_BASE}spots`,
    );
    return res.data.data;
  },

  async getByID(id: string): Promise<FishingSpot> {
    const res = await apiClient.get<{ data: FishingSpot }>(
      `${API_URL_BASE}spots/${id}`,
    );
    return res.data.data;
  },

  async create(payload: CreateFishingSpotPayload): Promise<void> {
    await apiClient.post(`${API_URL_BASE}spots`, payload);
  },

  async update(id: string, payload: UpdateFishingSpotPayload): Promise<void> {
    await apiClient.patch(`${API_URL_BASE}spots/${id}`, payload);
  },

  async remove(
    id: string,
    options: DeleteFishingSpotOptions = {},
  ): Promise<void> {
    await apiClient.delete(`${API_URL_BASE}spots/${id}`, {
      params: { hard: options.hard ? 'true' : undefined },
    });
  },
};
