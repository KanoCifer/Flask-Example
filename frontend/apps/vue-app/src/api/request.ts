import axios, { AxiosError } from 'axios';
import { tokenService } from '@/api/tokenService';

export interface ApiResponse<T = unknown> {
  message: string;
  data: T;
  code?: number;
  errors?: Record<string, unknown>;
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/',
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 动态注入 Authorization header
apiClient.interceptors.request.use((config) => {
  const token = tokenService.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 401 自动刷新 token 拦截器 — 自包含实现，避免跨包依赖。
// refreshAccessToken 通过回调注入，由 features/auth 在初始化时注册。
type RefreshFn = () => Promise<void>;
let refreshFn: RefreshFn | null = null;

export function registerTokenRefresher(fn: RefreshFn): void {
  refreshFn = fn;
}

const refreshTokenEndpoint = 'v3/refresh-token';

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
    if (
      error.response?.status === 401 &&
      !_cfg.url?.includes(refreshTokenEndpoint) &&
      !_cfg._retry &&
      refreshFn
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

// 友好错误消息转换 — 在所有其他拦截器之后注册（错误链中优先执行），
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
