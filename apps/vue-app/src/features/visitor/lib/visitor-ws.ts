import { useWebSocket } from '@/composables';
import { getVisitorId } from './visitor-id';
import { useVisitorCountStore } from '../stores/visitorCount';
import type { Pinia } from 'pinia';

let initialized = false;
let wsDisconnect: (() => void) | null = null;
let wsConnect: (() => void) | null = null;
let wsSendPing: (() => void) | null = null;
/** 全局单例的 connectionDelay ref，供 Footer 等组件只读订阅 */
export let connectionDelay:
  ReturnType<typeof useWebSocket>['connectionDelay'] | null = null;
/** 全局单例的连接状态 ref */
export let isConnected: ReturnType<typeof useWebSocket>['isConnected'] | null =
  null;

function buildWsUrl(): string {
  const apiBase = import.meta.env.VITE_API_BASE || '';

  // VITE_API_BASE 是绝对 URL（如 https://api.kanocifer.chat）时，
  // 直接从中派生 wss URL，忽略当前页面的 host
  if (apiBase.startsWith('http://') || apiBase.startsWith('https://')) {
    return apiBase.replace(/^http/, 'ws') + '/v3/public/ws';
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}${apiBase}/v3/public/ws`;
}

export function initVisitorWebSocket(pinia: Pinia) {
  if (initialized) return;
  initialized = true;

  const store = useVisitorCountStore(pinia);

  const ws = useWebSocket({
    url: buildWsUrl(),
    visitorId: getVisitorId(),
    onCount: (count: number) => {
      store.setCount(count);
    },
    immediate: true,
  });

  wsDisconnect = ws.disconnect;
  wsConnect = ws.connect;
  wsSendPing = ws.sendPing;
  connectionDelay = ws.connectionDelay;
  isConnected = ws.isConnected;
}

/** 断开并重新连接 WS，用于登录/登出后携带更新后的 cookie */
export function reconnectWs() {
  if (wsDisconnect && wsConnect) {
    wsDisconnect();
    wsConnect();
  }
}

/** 在全局 WS 连接上发送一次 ping，用于 StatusView 等高频延迟监测 */
export function sendPing() {
  wsSendPing?.();
}
