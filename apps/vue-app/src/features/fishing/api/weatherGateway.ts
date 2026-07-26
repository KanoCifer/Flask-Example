import { apiClient } from '@/api/request';
import type {
  TideApiEnvelope,
  WeatherDay,
  WeatherFullResponse,
  WeatherNow,
} from '@readinglist/types';

export type { TideApiEnvelope, WeatherDay, WeatherFullResponse, WeatherNow };

export interface WeatherGateway {
  getTide(payload: { harbor: string; date: string }): Promise<TideApiEnvelope>;
  getWeatherFull(payload: {
    location: [number, number];
  }): Promise<WeatherFullResponse>;
}

export const weatherGateway: WeatherGateway = {
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
};
