import { apiClient } from '@/api/request';
import { tokenService } from '@/api/tokenService';

// ── devtask service-JWT 缓存 ──
// /v3/dev-tasks/* 走 DevTaskMiddleware（service-JWT 鉴权），与用户 JWT 是两套体系。
// 用用户 JWT 调 /v3/dev-task/token 换取短期 service-token，缓存复用。

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

// 失效缓存（401 重试 / 登出时调用）
export function clearDevTaskToken(): void {
  cache = null;
  inflight = null;
}

export async function getDevTaskToken(): Promise<string> {
  // 未登录时直接短路：无用户 access-token 就不应发起任何 devtask 请求，
  // 否则 devtaskRequest 拦截器会反复打 v3/dev-task/token 形成循环。
  if (!tokenService.get()) {
    return Promise.reject(new Error('未登录，无法获取 devtask token'));
  }
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
