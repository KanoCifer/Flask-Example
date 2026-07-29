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
export { galleryGateway } from './gateways/pic';
export type {
  GalleryGateway,
  GalleryData,
  GalleryImage,
  ExifInfo,
  SaveGalleryPayload,
} from './gateways/pic';
