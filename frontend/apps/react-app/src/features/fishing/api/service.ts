import { llmService } from '@/lib';
import type { StreamFrameType } from '@/lib/llm';
import { fishingGateway, type FishingGateway } from '@readinglist/api';
import type { AnalysisPayload } from '../types';
import type {
  FishingFeedbackPayload,
  FishingFeedbackResponse,
  FishingIndexData,
  TideData,
  WeatherDay,
  WeatherFullResponse,
  WeatherHourly,
  WeatherIndex,
  WeatherNow,
} from '@readinglist/types';

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
    enriched?: boolean;
  }): Promise<FishingIndexData>;

  submitFishingFeedback(
    payload: FishingFeedbackPayload,
  ): Promise<FishingFeedbackResponse>;
}

/**
 * 钓鱼地图服务 —— 委托给共享 @readinglist/api fishingGateway，
 * 保留工厂形态以兼容旧消费方。
 */
export const fishingMapService = (): FishingMapService => {
  const gateway: FishingGateway = fishingGateway;

  return {
    async getTide(payload: {
      harbor: string;
      date: string;
    }): Promise<TideData> {
      // shared gateway 返回 TideApiEnvelope（含 fromCache 元数据），取 .data 得到 raw TideData
      const envelope = await gateway.getTide(payload);
      return envelope.data;
    },

    async getSecurityJsCode(): Promise<string> {
      const { securityJsCode } = await gateway.getSecurityKey();
      return securityJsCode ? atob(securityJsCode) : '';
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
      const data = (await gateway.getWeatherFull(payload)) as
        | WeatherFullResponse
        | undefined;
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
      enriched?: boolean;
    }): Promise<FishingIndexData> {
      return gateway.getFishingIndex(payload);
    },

    async submitFishingFeedback(
      payload: FishingFeedbackPayload,
    ): Promise<FishingFeedbackResponse> {
      return gateway.postFishingFeedback(payload);
    },
  };
};
