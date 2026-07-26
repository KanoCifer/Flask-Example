export { fishingGateway } from './fishingGateway';
export type { FishingGateway } from './fishingGateway';

export { fishingSpotsGateway } from './fishingSpotsGateway';
export type {
  FishingSpotsGateway,
  DeleteFishingSpotOptions,
} from './fishingSpotsGateway';

export { weatherGateway } from './weatherGateway';
export type { WeatherGateway } from './weatherGateway';

// 钓点 / 天气领域类型 —— 真源在 @/features/fishing/types，桶重新导出以保持兼容
export type {
  CreateFishingSpotPayload,
  FishingSpot,
  TideResponse,
  UpdateFishingSpotPayload,
  WeatherDay,
  WeatherFullResponse,
  WeatherNow,
} from '@/features/fishing/types';

export { mapGateway } from './mapGateway';
export type { MapGateway } from './mapGateway';
