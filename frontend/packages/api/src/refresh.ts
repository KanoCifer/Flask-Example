import axios from 'axios';
import { tokenService } from '@readinglist/utils';

const refreshTokenEndpoint = '/v3/refresh-token';

// 独立 axios 实例，不走全局拦截器，避免循环拦截
const refreshRequest = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/',
  timeout: 10000,
  withCredentials: true,
});

let promise: Promise<void> | null = null;
let lastRefreshAt = 0;

// Loop breaker：500 ms 内的连续 refresh 直接拒绝，避免上下游
// (request / dev-task/token) 同时 retry 各自挂一个 refresh 时无限交替刷屏。
const REFRESH_COOLDOWN_MS = 500;

/** 刷新 access-token 并持久化到 tokenService */
export async function refreshAccessToken() {
  if (promise) {
    return promise;
  }
  const now = Date.now();
  if (now - lastRefreshAt < REFRESH_COOLDOWN_MS) {
    throw new Error('refresh token throttled');
  }
  lastRefreshAt = now;
  promise = (async () => {
    try {
      await refreshToken();
    } finally {
      promise = null;
    }
  })();
  return promise;
}

async function refreshToken(): Promise<void> {
  const res = await refreshRequest.post(refreshTokenEndpoint, undefined, {
    _isRefreshToken: true,
  } as unknown as import('axios').InternalAxiosRequestConfig);
  const accessToken = res.data?.data?.access_token;
  if (accessToken) {
    tokenService.save(accessToken);
  }
}

/** 判断一个请求是否是 refresh-token 请求自身（避免循环重试） */
export function isRefreshTokenRequest(config: {
  _isRefreshToken?: boolean;
}): boolean {
  return !!config._isRefreshToken;
}
