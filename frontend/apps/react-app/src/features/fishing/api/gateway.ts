import type { AxiosResponse } from 'axios';

import apiClient from '@/api/apiClient';

import type { ApiEnvelope, SecurityKeyResponse } from '../types';
import type {
  FishingFeedbackPayload,
  FishingFeedbackResponse,
  FishingIndexData,
  TideApiEnvelope,
  WeatherFullResponse,
} from '@readinglist/types';

export interface fishingMapGateway {
  getSecurityKey(): Promise<AxiosResponse<ApiEnvelope<SecurityKeyResponse>>>;
  getTide(payload?: {
    harbor: string;
    date: string;
  }): Promise<AxiosResponse<ApiEnvelope<TideApiEnvelope>>>;

  getWeatherFull(payload: {
    location: [number, number];
  }): Promise<AxiosResponse<ApiEnvelope<WeatherFullResponse>>>;

  getFishingIndex(payload: {
    location: [number, number];
    enriched?: boolean;
  }): Promise<AxiosResponse<ApiEnvelope<FishingIndexData>>>;

  postFishingFeedback(
    payload: FishingFeedbackPayload,
  ): Promise<AxiosResponse<ApiEnvelope<FishingFeedbackResponse>>>;
}

export const fishingMapGateway = (): fishingMapGateway => {
  return {
    async getSecurityKey() {
      return apiClient.get('v1/amap/security-key') as Promise<
        AxiosResponse<ApiEnvelope<SecurityKeyResponse>>
      >;
    },

    async getTide(payload?: { harbor: string; date: string }) {
      return apiClient.get('v3/weather/tide', { params: payload }) as Promise<
        AxiosResponse<ApiEnvelope<TideApiEnvelope>>
      >;
    },

    async getWeatherFull(payload: { location: [number, number] }) {
      const [lng, lat] = payload.location;
      return apiClient.get('v3/weather/full', {
        params: { location: `${lng.toFixed(2)},${lat.toFixed(2)}` },
      }) as Promise<AxiosResponse<ApiEnvelope<WeatherFullResponse>>>;
    },

    async getFishingIndex(payload: {
      location: [number, number];
      enriched?: boolean;
    }) {
      const [lng, lat] = payload.location;
      return apiClient.get('v2/fishing/index', {
        params: {
          location: `${lng.toFixed(2)},${lat.toFixed(2)}`,
          enriched: payload.enriched ?? true,
        },
      }) as Promise<AxiosResponse<ApiEnvelope<FishingIndexData>>>;
    },

    async postFishingFeedback(payload: FishingFeedbackPayload) {
      return apiClient.post('v2/fishing/feedback', payload) as Promise<
        AxiosResponse<ApiEnvelope<FishingFeedbackResponse>>
      >;
    },
  };
};
