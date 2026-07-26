export function buildWsUrl(): string {
  const apiBase = import.meta.env.VITE_API_BASE || '/';
  if (apiBase.startsWith('http')) {
    return apiBase.replace(/^http/, 'ws') + '/v3/public/ws';
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}${apiBase}/v3/public/ws`;
}
