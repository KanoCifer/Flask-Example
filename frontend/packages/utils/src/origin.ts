// ── origin.ts ───────────────────────────────────────────────────────────────
// 把后端返回的媒体/接口 URL 统一为当前环境可加载的绝对地址。框架无关。
//
// 从 Vue 端 `composables/useOrigin.ts` 与 React 端 `hooks/useOrigin.ts` 迁入，
// 以 React 端为底本（双函数：useOrigin 用于 legacy endpoint，rewriteMediaUrl 用于媒体 URL）。

export interface OriginConfig {
  /**
   * 显式指定 API 域名（不含协议），覆盖从 VITE_API_BASE 推导的值。
   * 测试/特殊场景用；留空则自动从环境变量推导。
   */
  apiDomain?: string;
}

// ── API origin 推导（与原 Vue 实现一致）────────────────────────────────────
// VITE_API_BASE 是绝对 URL → 用其 origin；否则用当前页面的 origin。
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || '/';

const DEFAULT_API_ORIGIN = ((): string => {
  if (API_BASE.startsWith('http://') || API_BASE.startsWith('https://')) {
    try {
      return new URL(API_BASE).origin;
    } catch {
      // fall through
    }
  }
  // SSR 安全：无 window 时退回默认域名（仅作为最后兜底）
  if (typeof window === 'undefined') return 'https://api.kanocifer.chat';
  return window.location.origin;
})();

/** 当前页面是否运行在 https 环境。 */
function isHttps(): boolean {
  return (
    typeof window !== 'undefined' && window.location.protocol === 'https:'
  );
}

/**
 * 旧版 endpoint 拼接器：把相对路径升级为完整 URL。
 *
 * 仅在 https 环境下把相对路径固定升级到 API 域；
 * http（本地开发）下原样返回，走 Vite 代理。
 * 已是 http(s) 绝对 URL 时原样返回，避免双前缀。
 */
export function useOrigin(url: string, config?: OriginConfig): string {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (!isHttps()) return url;
  const origin = config?.apiDomain
    ? `https://${config.apiDomain}`
    : DEFAULT_API_ORIGIN;
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * 把后端返回的图片（媒体）URL 统一为当前环境可加载的地址。
 *
 * 背景：数据库里历史记录的 url 形如 `https://api.kanocifer.chat/api/v1/media/...`，
 * 是绝对路径。在开发环境（localhost:5173）下浏览器无法直接访问生产域名，
 * 且会被 CORB 拦截导致 `<img>` 加载失败。
 *
 * 规则：
 * 1. 空字符串 —— 原样返回；
 * 2. 已是当前 API 域的完整 URL —— 原样返回；
 * 3. 是其他域名的完整 URL —— 把 origin 替换为当前 API 域，保留 path/query；
 * 4. 是相对路径 —— 拼上当前 API 域。
 */
export function rewriteMediaUrl(rawUrl: string, config?: OriginConfig): string {
  if (!rawUrl) return '';

  const origin = config?.apiDomain
    ? `https://${config.apiDomain}`
    : DEFAULT_API_ORIGIN;

  const isAbsolute =
    rawUrl.startsWith('http://') || rawUrl.startsWith('https://');
  if (isAbsolute) {
    try {
      const u = new URL(rawUrl);
      if (u.origin === origin) return rawUrl;
      return `${origin}${u.pathname}${u.search}`;
    } catch {
      return rawUrl;
    }
  }

  return `${origin}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
}
