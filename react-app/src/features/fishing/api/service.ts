import { llmService } from '@/lib';
import type { StreamFrameType } from '@/lib/llm';
import { fishingMapGateway } from './gateway';
import type {
  AnalysisPayload,
  FishingFeedbackPayload,
  FishingFeedbackResponse,
  FishingIndexData,
  SecurityKeyResponse,
  TideData,
  WeatherDay,
  WeatherFullResponse,
  WeatherHourly,
  WeatherIndex,
  WeatherNow,
} from '../types';

export interface FishingMapService {
  getSecurityJsCode(): Promise<string>;
  /**
   * 流式 AI 天气分析。第二参数 `kind` 透传自后端双通道信封:
   *   - 'reasoning' → 调用方写到推理缓冲区
   *   - 'content'   → 调用方写到正文缓冲区
   * 旧调用方仅传 `(content)` 时按 content 行为兼容。
   */
  generateAnalysis(
    payload: AnalysisPayload,
    onChunk: (content: string, kind?: StreamFrameType) => void,
    signal?: AbortSignal,
  ): Promise<void>;

  getTide(payload: { harbor: string; date: string }): Promise<TideData>;

  fetchWeatherFull(payload: { location: [number, number] }): Promise<{
    updateTime?: string;
    now?: WeatherNow;
    daily?: WeatherDay[];
    hourly?: WeatherHourly[];
    locationName: string;
    indices: WeatherIndex[];
    tideData: TideData | null;
  }>;

  fetchFishingIndex(payload: {
    location: [number, number];
  }): Promise<FishingIndexData>;

  submitFishingFeedback(
    payload: FishingFeedbackPayload,
  ): Promise<FishingFeedbackResponse>;
}

export const fishingMapService = (): FishingMapService => {
  const gateway = fishingMapGateway();

  return {
    async getTide(payload: {
      harbor: string;
      date: string;
    }): Promise<TideData> {
      const res = await gateway.getTide(payload);
      return res.data.data;
    },

    async getSecurityJsCode(): Promise<string> {
      const securityResponse = await gateway.getSecurityKey();
      const encodedKey =
        (securityResponse.data.data as SecurityKeyResponse | undefined)
          ?.securityJsCode ?? '';
      return encodedKey ? atob(encodedKey) : '';
    },

    async generateAnalysis(
      payload: AnalysisPayload,
      onChunk: (content: string, kind?: StreamFrameType) => void,
      signal?: AbortSignal,
    ): Promise<void> {
      await llmService().weatherAnalysis(
        { weather_data: payload },
        (content, kind) => onChunk(content, kind),
        signal,
      );
    },

    async fetchWeatherFull(payload: { location: [number, number] }): Promise<{
      updateTime?: string;
      now?: WeatherNow;
      daily?: WeatherDay[];
      hourly?: WeatherHourly[];
      locationName: string;
      indices: WeatherIndex[];
      tideData: TideData | null;
    }> {
      const weatherRes = await gateway.getWeatherFull(payload);

      const data = weatherRes.data.data as WeatherFullResponse | undefined;
      const now = data?.current?.now;
      const daily = data?.daily?.daily;
      const hourly = data?.hourly?.hourly as WeatherHourly[] | undefined;
      const updateTime = data?.current?.updateTime ?? data?.daily?.updateTime;
      const locationName = data?.locationName ?? '未知地点';
      const tideData = data?.tide ?? null;
      const indices = data?.indices?.daily ?? [];

      return {
        updateTime,
        now,
        daily,
        hourly,
        locationName,
        indices,
        tideData,
      };
    },

    async fetchFishingIndex(payload: {
      location: [number, number];
    }): Promise<FishingIndexData> {
      const res = await gateway.getFishingIndex(payload);
      return res.data.data;
    },

    async submitFishingFeedback(
      payload: FishingFeedbackPayload,
    ): Promise<FishingFeedbackResponse> {
      const res = await gateway.postFishingFeedback(payload);
      return res.data.data;
    },
  };
};
