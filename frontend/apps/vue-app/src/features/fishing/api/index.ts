// 钓鱼 / 天气网关已迁移到 @readinglist/api，此处重新导出以保持兼容

export { fishingGateway } from './fishingGateway';
export type { FishingGateway } from './fishingGateway';

export { fishingSpotsGateway } from './fishingSpotsGateway';
export type {
  FishingSpotsGateway,
  DeleteFishingSpotOptions,
} from './fishingSpotsGateway';

export { fishingGateway as weatherGateway } from '@readinglist/api';
export type { FishingGateway as WeatherGateway } from '@readinglist/api';

export { fishingGateway as mapGateway } from '@readinglist/api';
export type { FishingGateway as MapGateway } from '@readinglist/api';

// 钓点 / 天气领域类型 —— 真源在 @readinglist/types，桶重新导出以保持兼容
export type {
  CreateFishingSpotPayload,
  FishingSpot,
  TideResponse,
  UpdateFishingSpotPayload,
  WeatherDay,
  WeatherFullResponse,
  WeatherNow,
} from '@readinglist/types';
