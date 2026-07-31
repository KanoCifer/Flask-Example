// @readinglist/api — 跨前端共享的 API 请求层

export {
  apiClient,
  extractData,
  registerTokenRefresher,
} from './apiClient';
export { default } from './apiClient';
export type { ApiResponse } from './types';
export {
  refreshAccessToken,
  isRefreshTokenRequest,
} from './refresh';

// ── SSE 流消费工具 ──────────────────────────────────────────────────────
export {
  consumeSseStream,
  parseSseChunk,
} from './sse';
export type { SseHandlers, SseRequestOptions } from './sse';

// ── devtask ──────────────────────────────────────────────────────────────
export { default as devtaskRequest } from './devtaskRequest';
export { getDevTaskToken, clearDevTaskToken } from './serviceToken';
export { devTaskGateway } from './gateways/devtask';
export type { DevTaskGateway } from './gateways/devtask';
export { devTaskService } from './gateways/devtaskService';
export type { DevTaskService } from './gateways/devtaskService';

// ── auth ──────────────────────────────────────────────────────────────
export { authGateway, createAuthGateway } from './gateways/auth';
export type { AuthGateway, LoginResult, PasskeyLoginResult } from './gateways/auth';

// ── blog ──────────────────────────────────────────────────────────────
export { blogGateway } from './gateways/blog';
export type { BlogGateway } from './gateways/blog';

// ── books / weread ────────────────────────────────────────────────────
export { wereadGateway } from './gateways/weread';
export type { WereadGateway } from './gateways/weread';

// ── moments ───────────────────────────────────────────────────────────
export { momentsGateway } from './gateways/moments';
export type { MomentsGateway } from './gateways/moments';

// ── pic / gallery ────────────────────────────────────────────────────
export {
  galleryGateway,
  PIC_MAX_IMAGE_BYTES,
  PIC_ACCEPTED_MIME,
} from './gateways/pic';
export type {
  GalleryGateway,
  GalleryData,
  GalleryImage,
  ExifInfo,
  SaveGalleryPayload,
} from './gateways/pic';

// ── fishing / weather / map ─────────────────────────────────────────────
export { fishingGateway } from './gateways/fishing';
export type { FishingGateway } from './gateways/fishing';
export { fishingSpotGateway } from './gateways/fishingSpot';
export { fishingSpotGateway as fishingSpotsGateway } from './gateways/fishingSpot';
export type {
  FishingSpotGateway,
  DeleteFishingSpotOptions,
} from './gateways/fishingSpot';

export { fishingGateway as mapGateway } from './gateways/fishing';
export type { FishingGateway as MapGateway } from './gateways/fishing';
export { fishingGateway as weatherGateway } from './gateways/fishing';
export type { FishingGateway as WeatherGateway } from './gateways/fishing';

// ── social / likes ────────────────────────────────────────────────────
export { socialGateway } from './gateways/social';
export type { SocialGateway } from './gateways/social';

// ── changelog ─────────────────────────────────────────────────────────
export { changelogGateway } from './gateways/changelog';
export type { ChangelogGateway } from './gateways/changelog';

// ── upload ────────────────────────────────────────────────────────────
export { uploadGateway } from './gateways/upload';
export type { UploadGateway, UploadType, UploadConfig } from './gateways/upload';

// ── status / system ───────────────────────────────────────────────────
export { statusGateway, fetchRecentEvents } from './gateways/status';
export type { StatusGateway, FetchRecentEventsOptions } from './gateways/status';

// ── device ────────────────────────────────────────────────────────────
export { deviceGateway } from './gateways/device';
export type { DeviceGateway } from './gateways/device';

// ── analytics ─────────────────────────────────────────────────────────
export { analyticsGateway } from './gateways/analytics';
export type { AnalyticsGateway } from './gateways/analytics';

// ── subscription ──────────────────────────────────────────────────────
export { subscriptionGateway } from './gateways/subscription';
export type { SubscriptionGateway } from './gateways/subscription';

// ── rss ──────────────────────────────────────────────────────────────
export { rssGateway } from './gateways/rss';
export type { RssGateway } from './gateways/rss';
export type { SubscriptionItem } from '@readinglist/types';

// ── ai / LLM ─────────────────────────────────────────────────────────
export { aiGateway } from './gateways/ai';
export type { AiGateway } from './gateways/ai';
