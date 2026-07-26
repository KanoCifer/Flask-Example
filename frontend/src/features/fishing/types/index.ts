/**
 * 钓鱼域类型聚合（天气/潮汐/钓点/反馈/地图标记）。
 *
 * 来源：和风天气 API + 国家海洋预报台潮汐 API + 后端 fishing_index 接口。
 * 仅描述网络层数据，不夹带 view-only 派生字段。
 */

// ---------------------------------------------------------------------------
// 钓点 DTO —— 与 go-backend/internal/dto/fish.go 对齐
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

// ---------------------------------------------------------------------------
// 潮汐 / 天气
// ---------------------------------------------------------------------------

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

/** @deprecated 兼容别名：v2 时直接返回 raw TideData；v3 后等价于 TideApiEnvelope */
export type TideResponse = TideApiEnvelope;

export interface WeatherHourly {
  fxTime: string;
  /** QWeather 返回字符串数值,如 "29";消费方需自行 Number() 转换 */
  temp?: string;
  /** QWeather 返回字符串数值,如 "0.5";消费方需自行 Number() 转换 */
  precip?: string;
  humidity?: string;
  pressure?: string;
  windDir?: string;
  windScale?: string;
  windSpeed?: string;
  text?: string;
  icon?: string;
}

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

// ---------------------------------------------------------------------------
// 钓鱼指数 / 反馈
// ---------------------------------------------------------------------------

export type FishingLevel = '爆护' | '好' | '一般' | '差' | '空军';
export type FishingIndexLevel = FishingLevel | '极好';
export type FishingFeedbackLevel = FishingLevel;

export interface FishingIndexData {
  fishing_index: number;
  expert_score: number;
  residual: number;
  level: FishingIndexLevel;
  feature_breakdown: Record<string, number>;
  // enriched 模式下附加的天气数据（Python /v2/fishing/index enriched=true 时填充）
  current_weather?: WeatherNow;
  forecasts?: WeatherDay[];
  location_name?: string;
  tide_data?: TideData;
}

export interface FishingFeedbackData {
  fishing_index: number;
  level: FishingIndexLevel;
  temperature: number;
  humidity: number;
  pressure: number;
  wind_speed: number;
  precipitation: number;
  indices: number;
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
  feedback: FishingFeedbackLevel;
}

export interface FishingFeedbackResponse {
  success: boolean;
  record_id: string;
  expert_score: number;
  residual: number;
}

/**
 * 喂给 <WeatherAnalysis> AI 分析的聚合 view-model。
 */
export interface WeatherAnalysisPayload {
  liveWeather?: WeatherNow | null;
  forecasts?: WeatherDay[];
  tideData?: TideData | null;
  weatherIndices?: Array<Record<string, unknown>>;
  fishingIndex?: FishingIndexData;
  locationName?: string;
  tideSpotName?: string;
}

// ---------------------------------------------------------------------------
// 钓鱼统计
// ---------------------------------------------------------------------------

export interface FishingStats {
  total_records: number;
  latest_record_time: string | null;
}

// ---------------------------------------------------------------------------
// 地图标记
// ---------------------------------------------------------------------------

/** 钓点业务字段(location 除外)—— MapMarker.extraData 的精确类型 */
export type SpotDetail = Omit<FishingSpot, 'location'>;

/**
 * 地图标记点 DTO（不耦合 AMap SDK —— MapContainer 内部转为 AMap.Marker）。
 *
 * 字段:
 * - position:  经纬度 [lng, lat]
 * - content:   自定义 DOM 字符串（可选；MapContainer 默认使用内置 SVG）
 * - offset:    像素偏移 [x, y]（可选；与 content 配合使用）
 * - extraData: 钓点业务数据（name/description/tags/rating/images 等，location 除外）
 *             来源：FishingSpot DTO；地图渲染层（renderMarkers / planFromMarker）
 *             只消费 position —— 挂 extraData 是给 infoWindow / 详情面板等上层用。
 */
export interface MapMarker {
  position: [number, number];
  content?: string;
  offset?: [number, number];
  extraData?: Omit<FishingSpot, 'location'>;
}

/**
 * FishingSpot DTO → MapMarker transform。
 * location 拆为 position；其余字段收进 extraData。
 *
 * 纯函数、无副作用 —— 可在 composable / 测试中直接调用。
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
