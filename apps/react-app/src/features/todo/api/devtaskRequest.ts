import axios, { AxiosError } from 'axios';
import apiClient from '@/api/apiClient';

// ── 专供 /v3/dev-tasks/* 的 axios 实例 ──
// devtask 走 DevTaskMiddleware（service-JWT 鉴权），与用户 JWT 两套体系。
// service-token 通过 /v3/dev-task/token（用户 JWT）换取，单独缓存。

interface DevTaskTokenRaw {
  token: string;
  expires_at: string; // RFC3339
}

interface CachedToken {
  token: string;
  expiresAt: number; // epoch ms
}

let cache: CachedToken | null = null;
let inflight: Promise<string> | null = null;

// 到期前 60s 提前刷新，避免带着即将过期的 token 发出请求
const REFRESH_AHEAD_MS = 60_000;

function isUsable(c: CachedToken): boolean {
  return Date.now() < c.expiresAt - REFRESH_AHEAD_MS;
}

function clearDevTaskToken(): void {
  cache = null;
  inflight = null;
}

async function getDevTaskToken(): Promise<string> {
  if (cache && isUsable(cache)) return cache.token;
  if (inflight) return inflight;

  inflight = (async () => {
    const res = await apiClient.get<{ data: DevTaskTokenRaw }>(
      'v3/dev-task/token',
    );
    const { token, expires_at } = res.data.data;
    cache = { token, expiresAt: new Date(expires_at).getTime() };
    return token;
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}

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
});

// 动态注入 service-token
devtaskRequest.interceptors.request.use(async (config) => {
  const token = await getDevTaskToken();
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 401 → service-token 可能已过期，清缓存。不在这里再 retriedevtaskRequest：
// devtaskRequest 的重试会让 getDevTaskToken 再次走 MAIN request，而 MAIN 已经在
// 上一层处理了 user-JWT 401。再嵌套一层重试会变成
// dev-task/token ↔ refresh-token 交替刷屏。直接拒绝，由调用方决定是否
// 下一次重试。Cache 清掉就够了，下次进来会拿新的 service-token。
devtaskRequest.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse>) => {
    const cfg = error.config as
      (typeof error.config & { _retry?: boolean }) | undefined;

    if (error.response?.status === 401 && cfg && !cfg._retry) {
      cfg._retry = true;
      clearDevTaskToken();
    }

    return Promise.reject(error);
  },
);

export default devtaskRequest;
