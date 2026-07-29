import { apiClient } from '../apiClient';
import type {
  FishingFeedbackPayload,
  FishingFeedbackResponse,
  FishingIndexData,
  FishingStats,
  TideApiEnvelope,
  WeatherFullResponse,
} from '@readinglist/types';

// ── 钓鱼指数 / 天气 / 潮汐网关（Vue / React 共享）──

export interface FishingGateway {
  /** 获取钓鱼指数 */
  getFishingIndex(payload: {
    location: [number, number];
    enriched?: boolean;
  }): Promise<FishingIndexData>;
  /** 提交钓鱼反馈 */
  postFishingFeedback(
    payload: FishingFeedbackPayload,
  ): Promise<FishingFeedbackResponse>;
  /** 获取钓鱼统计 */
  getFishingStats(): Promise<FishingStats>;
  /** 获取潮汐数据 */
  getTide(payload: { harbor: string; date: string }): Promise<TideApiEnvelope>;
  /** 获取完整天气数据 */
  getWeatherFull(payload: {
    location: [number, number];
  }): Promise<WeatherFullResponse>;
  /** 获取高德地图安全密钥 */
  getSecurityKey(): Promise<{ securityJsCode: string }>;
}

export const fishingGateway: FishingGateway = {
  async getFishingIndex(payload: {
    location: [number, number];
    enriched?: boolean;
  }): Promise<FishingIndexData> {
    const [lng, lat] = payload.location;
    const res = await apiClient.get<{ data: FishingIndexData }>(
      'v2/fishing/index',
      {
        params: {
          location: `${lng.toFixed(2)},${lat.toFixed(2)}`,
          enriched: payload.enriched ?? true,
        },
      },
    );
    return res.data.data;
  },

  async postFishingFeedback(
    payload: FishingFeedbackPayload,
  ): Promise<FishingFeedbackResponse> {
    const res = await apiClient.post<{ data: FishingFeedbackResponse }>(
      'v2/fishing/feedback',
      payload,
    );
    return res.data.data;
  },

  async getFishingStats(): Promise<FishingStats> {
    const res = await apiClient.get<{ data: FishingStats }>('v2/fishing/stats');
    return res.data.data;
  },

  async getTide(payload: {
    harbor: string;
    date: string;
  }): Promise<TideApiEnvelope> {
    const res = await apiClient.get<{ data: TideApiEnvelope }>(
      'v3/weather/tide',
      {
        params: payload,
      },
    );
    return res.data.data;
  },

  async getWeatherFull(payload: {
    location: [number, number];
  }): Promise<WeatherFullResponse> {
    const [lng, lat] = payload.location;
    const res = await apiClient.get<{ data: WeatherFullResponse }>(
      'v3/weather/full',
      {
        params: { location: `${lng.toFixed(2)},${lat.toFixed(2)}` },
      },
    );
    return res.data.data;
  },

  async getSecurityKey(): Promise<{ securityJsCode: string }> {
    const res = await apiClient.get<{ data: { securityJsCode: string } }>(
      'v2/publicv2/amap/security-key',
    );
    return res.data.data;
  },
};
