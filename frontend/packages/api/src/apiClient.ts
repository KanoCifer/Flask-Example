import axios, { AxiosError } from 'axios';
import { tokenService } from '@readinglist/utils';
import { isRefreshTokenRequest, refreshAccessToken } from './refresh';
import type { ApiResponse } from './types';

export { type ApiResponse } from './types';
export { extractData } from './extractData';

// ── Token 刷新回调（回调注入模式）──
// 默认使用共享的 refreshAccessToken，apps 可通过 registerTokenRefresher 覆盖。
type RefreshFn = () => Promise<void>;
let refreshFn: RefreshFn = refreshAccessToken;

/** 注册 token 刷新回调。apps 在初始化时调用，注入自身 refresh 实现。 */
export function registerTokenRefresher(fn: RefreshFn): void {
  refreshFn = fn;
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/',
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── 请求拦截器：动态注入 Authorization header ──
apiClient.interceptors.request.use((config) => {
  const token = tokenService.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const refreshTokenEndpoint = '/v3/refresh-token';

// ── 响应拦截器：401 自动刷新 token ──
// 关键约束（合并两端经验）：
// 1. 不重试 refresh-token 请求自身
// 2. 同一请求只重试一次（_retry 标记）
// 3. 没带 Authorization 的请求（从未登录）触发的 401 不走 refresh——refresh
//    也救不了从未认证的用户，强行重试只会让 refresh 与 dev-task/token 交替刷屏
apiClient.interceptors.response.use(
  (response) => response,

  async (error: AxiosError<ApiResponse>) => {
    const cfg = error.config;
    if (!cfg) {
      return Promise.reject(error);
    }
    const _cfg = cfg as typeof cfg & {
      _isRefreshToken?: boolean;
      _retry?: boolean;
    };
    const originalHadAuth = !!cfg.headers?.Authorization;
    if (
      error.response?.status === 401 &&
      !isRefreshTokenRequest(_cfg) &&
      !_cfg._retry &&
      !cfg.url?.includes(refreshTokenEndpoint) &&
      originalHadAuth
    ) {
      _cfg._retry = true;
      try {
        await refreshFn();
        return apiClient(_cfg);
      } catch (error) {
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  },
);

// ── 响应拦截器：友好错误消息转换 ──
// 在所有其他拦截器之后注册（错误链中优先执行），
// 优先取后端返回的 message，无后端响应时按状态码映射友好文案
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiResponse>) => {
    if (error.response?.data?.message) {
      error.message = error.response.data.message;
    } else if (error.code === 'ERR_NETWORK') {
      error.message = '网络连接失败，请检查网络设置';
    } else {
      const status = error.response?.status;
      if (status === 429) {
        error.message = '请求过于频繁，请稍后再试';
      } else if (status === 502 || status === 503) {
        error.message = '服务暂时不可用，请稍后重试';
      } else if (status === 422) {
        error.message = '请求参数错误，请检查后重试';
      } else if (status === 500) {
        error.message = '服务器内部错误，请稍后重试';
      } else if (status === 403) {
        error.message = '需要管理员账户';
      } else if (status && status >= 400) {
        error.message = `请求出错 (${status})，请稍后重试`;
      }
    }
    return Promise.reject(error);
  },
);

export default apiClient;
