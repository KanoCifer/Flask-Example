// ── 钓鱼域类型聚合（天气/潮汐/钓点/反馈/地图标记） ──────────────────────────
//
// 来源：和风天气 API + 国家海洋预报台潮汐 API + 后端 fishing_index 接口。
// 仅描述网络层数据，不夹带 view-only 派生字段。
//
// 钓点 DTO 与 go-backend/internal/dto/fish.go 对齐 —— 单一真源在后端。

// ---------------------------------------------------------------------------
// 钓点 DTO
// ---------------------------------------------------------------------------

/**
 * 钓点水体类型 —— 与 go-backend document.Kind* 常量、Python models 的 kind 字段共用同一组字面量。
 * 三值封闭：新增类型须同步 Go / Python 的校验枚举。
 */
export type FishingSpotKind = 'lake' | 'river' | 'reservoir';

/** 遍历用的有序全集 —— filter chips / 选择器按此顺序渲染 */
export const FISHING_SPOT_KINDS: readonly FishingSpotKind[] = [
  'lake',
  'river',
  'reservoir',
] as const;

/** 中文展示 label —— UI 层唯一文案来源，勿在组件内内联硬编码 */
export const FISHING_SPOT_KIND_LABELS: Readonly<
  Record<FishingSpotKind, string>
> = {
  lake: '湖泊',
  river: '溪流·江',
  reservoir: '水库',
};

export interface FishingSpot {
  id: string;
  name: string;
  description: string;
  /** [lng, lat] */
  location: [number, number];
  /**
   * 水体类型。字段必需存在，值可为 null ——
   * 遗留行经 migration 名字启发式回填，未匹配的少数留 null，UI 按未分类（muted）渲染。
   */
  kind: FishingSpotKind | null;
  tags: string[];
  rating: number;
  images: string[];
  created_at: string;
  updated_at: string;
}

/**
 * 创建钓点载荷 —— 与 dto.FishingSpotIn 对齐。
 * Name / Location / Kind 必填（binding:"required,oneof=lake river reservoir"），其余可选。
 */
export interface CreateFishingSpotPayload {
  name: string;
  /** [lng, lat] */
  location: [number, number];
  /** 新建时严格必填 —— 不接受 null，后端 oneof 校验会拒绝非法值 */
  kind: FishingSpotKind;
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

// ---------------------------------------------------------------------------
// 钓点编辑器(view 层契约，与 useSpotEditor seam 配套)
// ---------------------------------------------------------------------------

/**
 * 编辑器内的"图片条目" view-model —— 来自 initial.images(edit 模式)或本地新增上传(create 模式)。
 *
 * 与 DTO `images: string[]` 区别:组件层需要在选片/上传过程中维护每个条目的 id / uploadedAt / description,
 * 所以 seam 的 picture 列表是 `{id, url, ...}` 而不是纯字符串数组,提交时再 .map(p => p.url) 拍平。
 */
export interface SpotPicture {
  id: string;
  uploadedAt: string;
  url: string;
  description: string;
}

/**
 * 编辑器草稿 —— create 与 edit 共用同一份字段结构,行为差异由 seam 内部分支。
 *
 * - create 模式:全字段必填(name 必填;kind/coordinate 后置必填,canSubmit 守住)
 * - edit 模式:location 不在草稿里(交给 marker / 后端),kind 可回填;pictures 走单独 ref。
 */
export interface SpotEditorDraft {
  name: string;
  description: string;
  /** 编辑器内用逗号分隔的字符串;提交时 split → trim → filter(Boolean) → tags: string[] */
  tags: string;
  rating: number;
  /** create 模式下必填(null = 未选);edit 模式下可空字符串,与后端保持一致。 */
  kind: FishingSpotKind | null;
  /** [lng, lat] —— create 模式必填;edit 模式始终 null,坐标编辑走其他 seam。 */
  coordinate: [number, number] | null;
}

/** 单钓点图片上限 9 —— 与 SpotFormPanel / SpotDetailPanel 既有 MAX_PICTURES 对齐。 */
export const SPOT_MAX_PICTURES = 9;
/** 单张图片字节上限 5MB —— 与 SpotFormPanel / SpotDetailPanel 既有 MAX_UPLOAD_BYTES 对齐。 */
export const SPOT_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

// ---------------------------------------------------------------------------
// 潮汐
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

// ---------------------------------------------------------------------------
// 天气（和风天气 API 原始响应）
// ---------------------------------------------------------------------------

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
  // enriched 模式下附加的天气数据（后端 /v2/fishing/index enriched=true 时填充）
  current_weather?: WeatherNow;
  forecasts?: WeatherDay[];
  location_name?: string;
  tide_data?: TideData;
  hourly_weather?: { hourly?: WeatherHourly[] };
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

// ---------------------------------------------------------------------------
// 钓鱼统计
// ---------------------------------------------------------------------------

export interface FishingStats {
  total_records: number;
  latest_record_time: string | null;
}

// ---------------------------------------------------------------------------
// 地图标记（框架无关）
// ---------------------------------------------------------------------------

/**
 * 地图标记点 DTO（不耦合 AMap SDK —— 消费方内部转为 AMap.Marker）。
 *
 * 字段:
 * - position:  经纬度 [lng, lat]
 * - kind:      水体类型（必需；null = 未分类遗留行）—— 标记配色 / 侧栏过滤的唯一依据，
 *              提升到顶层而非只读 extraData，因为 extraData 可缺省而 kind 渲染必用。
 * - content:   自定义 DOM 字符串（可选；默认使用内置 SVG）
 * - offset:    像素偏移 [x, y]（可选；与 content 配合使用）
 * - extraData: 钓点业务数据（name/description/tags/rating/images 等，location 除外）
 */
export interface MapMarker {
  position: [number, number];
  kind: FishingSpotKind | null;
  content?: string;
  offset?: [number, number];
  extraData?: Omit<FishingSpot, 'location'>;
}

// ---------------------------------------------------------------------------
// AI 分析聚合
// ---------------------------------------------------------------------------

/** 喂给 AI 分析的聚合 view-model。 */
export interface WeatherAnalysisPayload {
  liveWeather?: WeatherNow | null;
  forecasts?: WeatherDay[];
  tideData?: TideData | null;
  weatherIndices?: Array<Record<string, unknown>>;
  fishingIndex?: FishingIndexData;
  locationName?: string;
  tideSpotName?: string;
}
