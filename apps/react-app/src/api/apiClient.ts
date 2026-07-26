import axios, { AxiosError } from 'axios';
import { isrefreshTokenRequest, refreshAccessToken } from './refresh';
import { tokenService } from '../lib/tokenService';

export interface ApiResponse<T = unknown> {
  message: string;
  data: T;
  code?: number;
  errors?: Record<string, unknown>;
}

// 辅助方法 — 从 { data: { data: T } } 中解出 T。
// 兼容两种响应形状：axios 直接返回的 ApiResponse 信封，或已标注的 { data: T }。
export const extractData = <T = unknown>(res: { data: { data: T } }): T =>
  res.data.data;

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/',
  timeout: 10000,
  withCredentials: true,
});

// 动态注入 Authorization header
apiClient.interceptors.request.use((config) => {
  const token = tokenService.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 添加401自动刷新token拦截器
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
      _hadAuth?: boolean;
    };
    // 关键约束：不重试 refresh-token 自己的请求；同一请求只重试一次；
    // 没带 Authorization 的请求（从未登录）触发的 401 不要再走 refresh——refresh
    // 也救不了从未认证的用户，强行重试只会让 refresh 与 dev-task/token 交替刷屏。
    const originalHadAuth = !!cfg.headers?.Authorization;
    if (
      error.response?.status === 401 &&
      !isrefreshTokenRequest(_cfg) &&
      !_cfg._retry &&
      originalHadAuth
    ) {
      _cfg._hadAuth = true;
      _cfg._retry = true;

      try {
        await refreshAccessToken();
        return apiClient(_cfg);
      } catch (error) {
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  },
);

export default apiClient;
