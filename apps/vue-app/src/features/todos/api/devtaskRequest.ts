import axios, { AxiosError } from 'axios';
import { getDevTaskToken, clearDevTaskToken } from './serviceToken';

// ── 专供 /v3/dev-tasks/* 的 axios 实例 ──
// 与 request.ts（用户 JWT）隔离：devtask 走 service-JWT，拦截器注入 service-token。

export interface ApiResponse<T = unknown> {
  message: string;
  data: T;
  code?: number;
  errors?: Record<string, unknown>;
}

const devtaskRequest = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/',
  timeout: 10_000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 动态注入 service-token（单独缓存，与用户 access-JWT 解耦）
devtaskRequest.interceptors.request.use(async (config) => {
  const token = await getDevTaskToken();
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 401 → service-token 可能已过期，清缓存后重试一次
devtaskRequest.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse>) => {
    const cfg = error.config as
      (typeof error.config & { _retry?: boolean }) | undefined;

    if (error.response?.status === 401 && cfg && !cfg._retry) {
      cfg._retry = true;
      clearDevTaskToken();
      return devtaskRequest(cfg);
    }

    // 友好错误消息（与 request.ts 一致）
    if (error.response?.data?.message) {
      error.message = error.response.data.message;
    } else if (error.code === 'ERR_NETWORK') {
      error.message = '网络连接失败，请检查网络设置';
    } else if (error.response?.status === 503) {
      error.message = 'devtask 服务暂不可用（secret 未配置）';
    }

    return Promise.reject(error);
  },
);

export default devtaskRequest;
