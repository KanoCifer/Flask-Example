import { useCallback, useEffect, useRef } from 'react';
import { WebSocketManager } from '@readinglist/utils';

interface UseWebSocketOptions {
  url: string;
  visitorId?: string | null;
  onCount?: (count: number) => void;
  onConnectionDelay?: (ms: number) => void;
  onConnectedChange?: (connected: boolean) => void;
  reconnectBaseMs?: number;
  reconnectMaxMs?: number;
  pingIntervalMs?: number;
}

/**
 * React 薄包装层 — 将框架无关的 WebSocketManager 适配为 React hook。
 *
 * 负责：useEffect 生命周期、visibilitychange / online / beforeunload 事件绑定。
 * 连接/重连/ping 核心逻辑全部委托给 {@link WebSocketManager}。
 */
export function useWebsocket(options: UseWebSocketOptions) {
  const {
    url,
    visitorId,
    onCount,
    onConnectionDelay,
    onConnectedChange,
    reconnectBaseMs = 1000,
    reconnectMaxMs = 30000,
    pingIntervalMs = 30000,
  } = options;

  // Stable callbacks — refs for values that change but shouldn't trigger reconnect
  const onCountRef = useRef(onCount);
  const onConnectionDelayRef = useRef(onConnectionDelay);
  const onConnectedChangeRef = useRef(onConnectedChange);
  const visitorIdRef = useRef(visitorId);

  useEffect(() => {
    onCountRef.current = onCount;
    onConnectionDelayRef.current = onConnectionDelay;
    onConnectedChangeRef.current = onConnectedChange;
    visitorIdRef.current = visitorId;
  });

  const managerRef = useRef<WebSocketManager | null>(null);

  useEffect(() => {
    const manager = new WebSocketManager({
      url,
      visitorId: visitorIdRef.current,
      onCount: (count) => onCountRef.current?.(count),
      onOpen: () => onConnectedChangeRef.current?.(true),
      onClose: () => onConnectedChangeRef.current?.(false),
      onLatency: (ms) => onConnectionDelayRef.current?.(ms),
      reconnectBaseMs,
      reconnectMaxMs,
      pingIntervalMs,
    });
    managerRef.current = manager;

    manager.connect();

    const handleVisibility = () => {
      if (
        document.visibilityState === 'visible' &&
        !manager.isConnected
      ) {
        manager.connect();
      }
    };

    const handleOnline = () => {
      manager.connect();
    };

    const handleBeforeUnload = () => {
      manager.disconnect();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      manager.disconnect();
      managerRef.current = null;
    };
  }, [url, reconnectBaseMs, reconnectMaxMs, pingIntervalMs]);

  const sendPing = useCallback(() => {
    managerRef.current?.sendPing();
  }, []);

  return { sendPing };
}
