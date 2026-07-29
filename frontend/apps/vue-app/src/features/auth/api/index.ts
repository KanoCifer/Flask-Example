// auth api 桶导出 —— 网关已迁移到 @readinglist/api，此处重新导出以保持兼容

export { authGateway, createAuthGateway } from '@readinglist/api';
export type { AuthGateway, LoginResult, PasskeyLoginResult } from '@readinglist/api';
export { refreshAccessToken, isrefreshTokenRequest } from '../lib/refresh';
