// API base URL for constructing full media URLs and origin detection.
// 默认 '/api' 走同源（Vite 代理），生产环境通过 VITE_API_BASE 切到 CDN/独立 API 域。
const API_BASE = import.meta.env.VITE_API_BASE || '/';

// 当前 API 域的 origin（用于重写数据库里存的历史跨域 URL）。
// 模块顶层计算一次，避免每次调用都 new URL。
const API_ORIGIN = (() => {
  if (API_BASE.startsWith('http://') || API_BASE.startsWith('https://')) {
    try {
      return new URL(API_BASE).origin;
    } catch {
      return window.location.origin;
    }
  }
  return window.location.origin;
})();

/**
 * 旧版 endpoint 拼接器：把相对路径升级为完整 URL。
 *
 * 仅在 https 环境下把 `http://` 协议固定升级到生产域 `https://api.kanocifer.chat`。
 * 当前仅用于 SSE 等 legacy endpoint；新代码优先用 `rewriteMediaUrl` 或业务层直传。
 */
export function useOrigin(url: string) {
  if (location.protocol === 'http:') {
    return url;
  }
  // 已是 http(s) 绝对 URL 时原样返回，避免双前缀
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return 'https://api.kanocifer.chat' + (url.startsWith('/') ? '' : '/') + url;
}

/**
 * 把后端返回的图片（媒体）URL 统一为当前环境可加载的地址。
 *
 * 背景：数据库里历史记录的 url 形如 `https://api.kanocifer.chat/api/v1/media/...`，
 * 是绝对路径。在开发环境（localhost:5173）下浏览器无法直接访问生产域名，
 * 且会被 CORB 拦截导致 `<img>` 加载失败 —— 拍立得"相片区"为空，
 * 在深色模式下 `--page` 也是深色，整张卡片与背景融为一体，看起来一片空白。
 *
 * 规则：
 * 1. 空字符串 —— 原样返回；
 * 2. 已是当前 API 域的完整 URL —— 原样返回；
 * 3. 是其他域名的完整 URL —— 把 origin 替换为当前 API 域，保留 path/query；
 * 4. 是相对路径 —— 拼上当前 API 域。
 */
export function rewriteMediaUrl(rawUrl: string): string {
  if (!rawUrl) return '';

  const isAbsolute =
    rawUrl.startsWith('http://') || rawUrl.startsWith('https://');
  if (isAbsolute) {
    try {
      const u = new URL(rawUrl);
      if (u.origin === API_ORIGIN) return rawUrl;
      return `${API_ORIGIN}${u.pathname}${u.search}`;
    } catch {
      return rawUrl;
    }
  }

  return `${API_ORIGIN}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
}
