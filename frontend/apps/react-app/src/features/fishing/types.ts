// 仅引入本地定义 / 函数实际使用的共享类型；其余通过下方 export type 透传。
import type {
  FishingSpot,
  MapMarker,
  TideData,
  WeatherHourly,
  WeatherDay,
  WeatherIndex,
  WeatherNow,
  FishingIndexData,
} from '@readinglist/types';

// ── 共享类型 re-export —— 供 barrel (index.ts) / service.ts / 组件消费 ──

export type {
  FishingSpot,
  MapMarker,
  SpotDetail,
  TideData,
  TideTableItem,
  TideApiEnvelope,
  TideResponse,
  WeatherHourly,
  WeatherDay,
  WeatherForecastResponse,
  WeatherIndex,
  WeatherIndicesResponse,
  WeatherNow,
  WeatherLiveResponse,
  WeatherFullResponse,
  FishingLevel,
  FishingIndexData,
  FishingFeedbackData,
  FishingFeedbackPayload,
  FishingFeedbackResponse,
  FishingStats,
  CreateFishingSpotPayload,
  UpdateFishingSpotPayload,
} from '@readinglist/types';

// ── React / 钓点域本地-only 类型 ──

/**
 * AMap.Geolocation.getCurrentPosition 回调的 result 形状（领域类型,非 SDK 类型）。
 * 官方 @types/amap-js-api 把事件 payload 标为 any,这里手工声明以收紧下游。
 */
export type GeolocationStatusEvent = {
  position: { lng: number; lat: number };
  info?: string;
};

export interface ApiEnvelope<T> {
  data: T;
}

export interface RouteInfo {
  distance: number;
  time: number;
}

export interface SecurityKeyResponse {
  securityJsCode?: string;
}

export interface RegeoResponseData {
  status?: string;
  regeocode?: {
    addressComponent?: {
      adcode?: string;
    };
  };
}

export interface AnalysisPayload {
  liveWeather: WeatherNow | null;
  forecasts: WeatherDay[];
  tideData: TideData | null;
  weatherIndices: WeatherIndex[];
  fishingIndex?: FishingIndexData;
  locationName: string;
  tideSpotName: string;
  modelId?: string;
}

// POI 数据
export interface PoiItem {
  name: string;
  id: string;
  lat: string;
  lon: string;
  adm2: string;
  adm1: string;
  country: string;
  tz: string;
  utcOffset: string;
  isDst: string;
  type: string;
  rank: string;
  fxLink: string;
}

export interface PoiResponse {
  poi?: PoiItem[];
}

export interface WeatherHourlyResponse {
  code: string;
  updateTime: string;
  fxLink: string;
  hourly?: WeatherHourly[];
}

// AI 天气分析评分
export interface FishingScores {
  expert_score: number;
  ai_final_score: number;
  final_score: number;
}

export interface AnalysisChunk {
  content?: string;
  is_end?: boolean;
  scores?: FishingScores;
}

/**
 * 喂给 AI 分析组件的聚合数据。
 * 在 useFishingAnalysis hook 中拼装，在 FishingAnalysisDrawer / AIAnalysisWidget 中消费。
 * 字段都是 optional —— Live / forecast / tide 任一为空时，AI 内部按需处理。
 */
export type WeatherAnalysisPayload = Omit<AnalysisPayload, 'modelId'>;

// ---------------------------------------------------------------------------
// 钓点 DTO transform（运行时函数）
// ---------------------------------------------------------------------------

/**
 * FishingSpot DTO → MapMarker transform。
 * location 拆为 position；kind 提升到顶层（标记配色 / 过滤必用）；其余字段收进 extraData。
 *
 * 纯函数、无副作用 —— 可在 hook / 测试中直接调用。
 */
export function toMapMarker(spot: FishingSpot): MapMarker {
  const { location, ...rest } = spot;
  return {
    position: location,
    kind: spot.kind,
    extraData: rest,
  };
}

/** 批量 transform —— fishingSpotsGateway.list() 结果直接喂给本函数 */
export function toMapMarkers(spots: FishingSpot[]): MapMarker[] {
  return spots.map(toMapMarker);
}
