// auth 网关 —— 真源 @readinglist/api
export { authGateway, createAuthGateway } from '@readinglist/api';
export type {
  AuthGateway,
  LoginResult,
  PasskeyLoginResult,
} from '@readinglist/api';
export { refreshAccessToken, isRefreshTokenRequest } from '../lib/refresh';
