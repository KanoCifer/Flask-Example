import { onMounted, onUnmounted, ref } from 'vue';
import { WebSocketManager } from '@readinglist/utils';

interface UseWebSocketOptions {
  url: string;
  visitorId?: string | null;
  onCount?: (count: number) => void;
  reconnectBaseMs?: number;
  reconnectMaxMs?: number;
  pingIntervalMs?: number;
  immediate?: boolean;
}

/**
 * Vue 薄包装层 — 将框架无关的 WebSocketManager 适配为响应式 composable。
 *
 * 负责：Vue ref 状态同步、生命周期 (onMounted/onUnmounted)、
 * visibilitychange / online / beforeunload 事件绑定。
 * 连接/重连/ping 核心逻辑全部委托给 {@link WebSocketManager}。
 */
export function useWebSocket(options: UseWebSocketOptions) {
  const {
    url,
    onCount,
    visitorId,
    reconnectBaseMs = 1000,
    reconnectMaxMs = 30000,
    pingIntervalMs = 30000,
    immediate = false,
  } = options;

  const isConnected = ref(false);
  const connectionDelay = ref<number>(0);

  const manager = new WebSocketManager({
    url,
    visitorId,
    onCount,
    reconnectBaseMs,
    reconnectMaxMs,
    pingIntervalMs,
    onOpen: () => {
      isConnected.value = true;
    },
    onClose: () => {
      isConnected.value = false;
    },
    onLatency: (ms) => {
      connectionDelay.value = ms;
    },
  });

  const connect = () => manager.connect();
  const disconnect = () => manager.disconnect();
  const sendPing = () => manager.sendPing();
  const send = (data: object) => manager.send(data);

  const handleVisibility = () => {
    if (document.visibilityState === 'visible' && !isConnected.value) {
      connect();
    }
  };

  const handleOnline = () => {
    connect();
  };

  const handleBeforeUnload = () => {
    disconnect();
  };

  if (immediate) {
    connect();
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);
    window.addEventListener('beforeunload', handleBeforeUnload);
  } else {
    onMounted(() => {
      connect();
      document.addEventListener('visibilitychange', handleVisibility);
      window.addEventListener('online', handleOnline);
    });

    onUnmounted(() => {
      disconnect();
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
    });
  }

  return { isConnected, connectionDelay, send, sendPing, disconnect, connect };
}
