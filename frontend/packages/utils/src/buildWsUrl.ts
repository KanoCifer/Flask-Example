/**
 * 从 API 基地址推导 WebSocket URL。
 * - 若 apiBase 以 http/https 开头，直接替换协议为 ws/wss
 * - 否则根据当前页面协议推导 ws/wss，并拼接 host 与 apiBase
 */
export function buildWsUrl(apiBase: string = import.meta.env.VITE_API_BASE || '/'): string {
  if (apiBase.startsWith('http')) {
    return apiBase.replace(/^http/, 'ws') + '/v3/public/ws';
  }
  const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = typeof window !== 'undefined' ? window.location.host : '';
  return `${protocol}//${host}${apiBase}/v3/public/ws`;
}
