// visitor 模块桶导出 — 对外公开 API

export { useVisitorCountStore } from './stores/visitorCount';
export { getVisitorId } from './lib/visitor-id';
export { collectVisitorData, reportVisitorData } from './lib/visitor-track';
export {
  initVisitorWebSocket,
  reconnectWs,
  connectionDelay,
  isConnected,
  sendPing,
} from './lib/visitor-ws';
