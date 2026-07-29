// 过渡期 re-export — API 请求基础设施已迁移到 @readinglist/api
export {
  apiClient,
  extractData,
  registerTokenRefresher,
  refreshAccessToken,
  isRefreshTokenRequest,
} from '@readinglist/api';
export type { ApiResponse } from '@readinglist/api';
// 兼容默认导入（旧代码 `import apiClient from '@/api/apiClient'`）
export { default } from '@readinglist/api';
