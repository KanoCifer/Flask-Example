// visitor 模块桶导出 — 对外公开 API

export { useVisitorCountStore } from './stores/visitorCount';
export { getVisitorId } from '@readinglist/utils';
export { collectVisitorData } from '@readinglist/utils';
export { reportVisitorData } from './lib/visitor-track';
export {
  initVisitorWebSocket,
  reconnectWs,
  connectionDelay,
  isConnected,
  sendPing,
} from './lib/visitor-ws';
