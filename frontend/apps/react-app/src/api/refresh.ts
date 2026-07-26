import axios from 'axios';
import { tokenService } from '../lib/tokenService';

const refreshTokenEndpoint = '/v3/refresh-token';

// 创建独立的axios实例，不使用全局拦截器，避免循环拦截
const refreshRequest = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/',
  timeout: 10000,
  withCredentials: true,
  _isRefreshToken: false, // 标记这是刷新token的请求
});

let promise: Promise<void> | null = null;
let lastRefreshAt = 0;
// Loop breaker：500 ms 内的连续 refresh 直接拒绝，避免上下游 (request / dev-task/token)
// 同时 retry 各自挂一个 refresh 时无限交替刷屏。
const REFRESH_COOLDOWN_MS = 500;
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

export async function refreshToken(): Promise<void> {
  const res = await refreshRequest.post(refreshTokenEndpoint, undefined, {
    _isRefreshToken: true,
  });
  const accessToken = res.data?.data?.access_token;
  if (accessToken) {
    tokenService.save(accessToken);
  }
}

export function isrefreshTokenRequest(config: {
  _isRefreshToken?: boolean;
}): boolean {
  return !!config._isRefreshToken;
}
