import type { MapMarker } from '@/types/marker';

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

export interface TideTableItem {
  fxTime: string;
  height: number | string;
  type: 'H' | 'L';
}

export interface TideData {
  updateTime: string;
  tideTable: TideTableItem[];
  tideHourly: Array<{ fxTime: string; height: number | string }>;
}

/** v3 潮汐 API 响应包装层：data 字段含 fromCache 元数据 */
export interface TideApiEnvelope {
  data: TideData;
  fromCache: boolean;
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

// 天气预报（每日）
export interface WeatherDay {
  fxDate: string;
  sunrise: string;
  sunset: string;
  moonrise: string;
  moonset: string;
  moonPhase: string;
  moonPhaseIcon: string;
  tempMax: string;
  tempMin: string;
  iconDay: string;
  textDay: string;
  iconNight: string;
  textNight: string;
  wind360Day: string;
  windDirDay: string;
  windScaleDay: string;
  windSpeedDay: string;
  wind360Night: string;
  windDirNight: string;
  windScaleNight: string;
  windSpeedNight: string;
  humidity: string;
  precip: string;
  pressure: string;
  vis: string;
  cloud: string;
  uvIndex: string;
}

export interface WeatherForecastResponse {
  code: string;
  updateTime: string;
  fxLink: string;
  daily?: WeatherDay[];
  refer?: {
    sources?: string[];
    license?: string[];
  };
}

// 天气指数
export interface WeatherIndex {
  date: string;
  type: string;
  name: string;
  level: string;
  category: string;
  text: string;
}

export interface WeatherIndicesResponse {
  code: string;
  updateTime: string;
  fxLink: string;
  daily?: WeatherIndex[];
  refer?: {
    sources?: string[];
    license?: string[];
  };
}

// 实时天气
export interface WeatherNow {
  obsTime: string;
  temp: string;
  feelsLike: string;
  icon: string;
  text: string;
  wind360: string;
  windDir: string;
  windScale: string;
  windSpeed: string;
  humidity: string;
  precip: string;
  pressure: string;
  vis: string;
  cloud: string;
  dew: string;
}

export interface WeatherLiveResponse {
  code: string;
  updateTime: string;
  fxLink: string;
  now?: WeatherNow;
  refer?: {
    sources?: string[];
    license?: string[];
  };
}

export interface WeatherFullResponse {
  current?: WeatherLiveResponse;
  daily?: WeatherForecastResponse;
  hourly?: Record<string, unknown>;
  tide?: TideData;
  indices?: WeatherIndicesResponse;
  locationName?: string;
  poiId?: string;
}

export interface WeatherHourlyResponse {
  code: string;
  updateTime: string;
  fxLink: string;
  hourly?: WeatherHourly[];
}

export interface WeatherHourly {
  fxTime: string;
  temp: string;
  icon: string;
  text: string;
  wind360: string;
  windDir: string;
  windScale: string;
  windSpeed: string;
  humidity: string;
  precip: string;
  pressure: string;
  pop: string;
  cloud: string;
  dew: string;
}

// 钓鱼指数
export type FishingLevel = '爆护' | '好' | '一般' | '差' | '空军';

export interface FishingIndexData {
  fishing_index: number;
  expert_score: number;
  residual: number;
  level: FishingLevel;
  feature_breakdown: Record<string, number>;
  // enriched 模式下附加的天气数据（Go /v2/fishing/index enriched=true 时填充）
  current_weather?: WeatherNow;
  forecasts?: WeatherDay[];
  location_name?: string;
  tide_data?: TideData;
}

// 钓鱼反馈所需数据
export interface FishingFeedbackData {
  // 钓鱼指数（用于显示）
  fishing_index: number;
  level: FishingLevel;
  // 天气数据
  temperature: number;
  humidity: number;
  pressure: number;
  wind_speed: number;
  precipitation: number;
  indices: number;
  // 潮汐数据
  tide_level: number;
  tide_type?: '涨潮' | '退潮';
  tide_range: number;
  hours_to_next_tide: number;
}

export interface FishingFeedbackPayload {
  location_id: string;
  location_name: string;
  fishing_time: string;
  temperature?: number;
  humidity?: number;
  pressure?: number;
  wind_speed?: number;
  precipitation?: number;
  indices?: number;
  tide_level?: number;
  tide_type?: '涨潮' | '退潮';
  tide_range?: number;
  hours_to_next_tide?: number;
  feedback: FishingLevel;
}

export interface FishingFeedbackResponse {
  success: boolean;
  record_id: string;
  expert_score: number;
  residual: number;
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
// 钓点 DTO —— 与 go-backend/internal/dto/fish.go 对齐（镜像 frontend types）
// ---------------------------------------------------------------------------

export interface FishingSpot {
  id: string;
  name: string;
  description: string;
  /** [lng, lat] */
  location: [number, number];
  tags: string[];
  rating: number;
  images: string[];
  created_at: string;
  updated_at: string;
}

/**
 * 创建钓点载荷 —— 与 dto.FishingSpotIn 对齐。
 * Name / Location 必填（binding:"required"），其余可选。
 */
export interface CreateFishingSpotPayload {
  name: string;
  /** [lng, lat] */
  location: [number, number];
  description?: string;
  tags?: string[];
  rating?: number;
  images?: string[];
}

/**
 * 更新钓点载荷 —— 与 dto.FishingSpotUpdate 对齐。
 * 全字段可选：未传 = 不动，传了 = 显式覆盖（Partial update）。
 */
export type UpdateFishingSpotPayload = Partial<CreateFishingSpotPayload>;

/** 钓点业务字段(location 除外)—— MapMarker.extraData 的精确类型 */
export type SpotDetail = Omit<FishingSpot, 'location'>;

/**
 * FishingSpot DTO → MapMarker transform。
 * location 拆为 position；其余字段收进 extraData。
 *
 * 纯函数、无副作用 —— 可在 hook / 测试中直接调用。
 */
export function toMapMarker(spot: FishingSpot): MapMarker {
  const { location, ...rest } = spot;
  return {
    position: location,
    extraData: rest,
  };
}

/** 批量 transform —— fishingSpotsGateway.list() 结果直接喂给本函数 */
export function toMapMarkers(spots: FishingSpot[]): MapMarker[] {
  return spots.map(toMapMarker);
}
