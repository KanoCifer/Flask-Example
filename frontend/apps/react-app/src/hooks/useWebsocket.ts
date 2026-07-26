import { useCallback, useEffect, useRef } from 'react';

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

  const wsRef = useRef<WebSocket | null>(null);
  const isConnectedRef = useRef(false);
  const reconnectAttemptRef = useRef(0);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingStartTimeRef = useRef(0);

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

  const stopPing = useCallback(() => {
    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
  }, []);

  // Ref to the latest connect — lets the setTimeout below avoid the TDZ
  // warning from react-hooks/immutability while still calling the live version.
  const connectRef = useRef<(() => void) | null>(null);

  const connect = useCallback(() => {
    stopPing();
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
    }

    let startTime: number;

    try {
      startTime = performance.now();
      wsRef.current = new WebSocket(url);
    } catch {
      // Invalid URL or environment — schedule reconnect
      const delay = Math.min(
        reconnectBaseMs * Math.pow(2, reconnectAttemptRef.current),
        reconnectMaxMs,
      );
      reconnectTimerRef.current = setTimeout(
        () => connectRef.current?.(),
        delay,
      );
      reconnectAttemptRef.current++;
      return;
    }

    const ws = wsRef.current;

    ws.onopen = () => {
      isConnectedRef.current = true;
      onConnectedChangeRef.current?.(true);
      reconnectAttemptRef.current = 0;
      onConnectionDelayRef.current?.(performance.now() - startTime);

      if (visitorIdRef.current) {
        ws.send(
          JSON.stringify({
            type: 'visitor_id',
            visitor_id: visitorIdRef.current,
          }),
        );
      }

      // Start ping loop
      stopPing();
      pingTimerRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          pingStartTimeRef.current = performance.now();
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, pingIntervalMs);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (
          data.type === 'count' &&
          onCountRef.current &&
          typeof data.count === 'number'
        ) {
          onCountRef.current(data.count);
        } else if (data.type === 'pong') {
          onConnectionDelayRef.current?.(
            performance.now() - pingStartTimeRef.current,
          );
        }
      } catch {
        // ignore non-JSON or malformed messages
      }
    };

    ws.onclose = (event) => {
      isConnectedRef.current = false;
      onConnectedChangeRef.current?.(false);
      stopPing();
      if (event.code !== 1000) {
        const delay = Math.min(
          reconnectBaseMs * Math.pow(2, reconnectAttemptRef.current),
          reconnectMaxMs,
        );
        reconnectTimerRef.current = setTimeout(
          () => connectRef.current?.(),
          delay,
        );
        reconnectAttemptRef.current++;
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [url, reconnectBaseMs, reconnectMaxMs, pingIntervalMs, stopPing]);

  // Keep ref pointing at the latest connect so the setTimeout above
  // can re-invoke it without referring to a forward-declared const.
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const disconnect = useCallback(() => {
    stopPing();
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close(1000);
      wsRef.current = null;
    }
    isConnectedRef.current = false;
    onConnectedChangeRef.current?.(false);
  }, [stopPing]);

  /** Send a ping and record start time for latency calculation */
  const sendPing = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      pingStartTimeRef.current = performance.now();
      wsRef.current.send(JSON.stringify({ type: 'ping' }));
    }
  }, []);

  useEffect(() => {
    connect();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !isConnectedRef.current) {
        reconnectAttemptRef.current = 0;
        connect();
      }
    };

    const handleOnline = () => {
      reconnectAttemptRef.current = 0;
      connect();
    };

    const handleBeforeUnload = () => {
      disconnect();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      disconnect();
    };
  }, [connect, disconnect]);

  return { sendPing };
}
