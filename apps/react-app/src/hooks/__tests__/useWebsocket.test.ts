import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWebsocket } from '../useWebsocket';

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  readyState: number = WebSocket.CONNECTING;
  onopen: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  sent: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    // Simulate async open
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      this.onopen?.(new Event('open'));
    }, 0);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close(code?: number) {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.(
      new CloseEvent('close', { code: code ?? 1000, wasClean: code === 1000 }),
    );
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  MockWebSocket.instances = [];
  // @ts-expect-error mock
  globalThis.WebSocket = MockWebSocket;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function flushWsOpen() {
  act(() => {
    vi.advanceTimersByTime(1);
  });
}

describe('useWebsocket', () => {
  it('connects and sends visitor_id on open', () => {
    renderHook(() =>
      useWebsocket({
        url: 'ws://localhost/v3/public/ws',
        visitorId: 'test-visitor-123',
      }),
    );

    flushWsOpen();

    const ws = MockWebSocket.instances[0];
    expect(ws).toBeDefined();
    expect(ws.url).toBe('ws://localhost/v3/public/ws');
    expect(ws.sent).toContainEqual(
      JSON.stringify({ type: 'visitor_id', visitor_id: 'test-visitor-123' }),
    );
  });

  it('sends ping every 30 seconds', () => {
    renderHook(() =>
      useWebsocket({
        url: 'ws://localhost/ws',
        pingIntervalMs: 30000,
      }),
    );

    flushWsOpen();
    const ws = MockWebSocket.instances[0];

    act(() => {
      vi.advanceTimersByTime(30000);
    });
    expect(ws.sent.filter((s) => s === '{"type":"ping"}').length).toBe(1);

    act(() => {
      vi.advanceTimersByTime(30000);
    });
    expect(ws.sent.filter((s) => s === '{"type":"ping"}').length).toBe(2);
  });

  it('calls onCount when count message received', () => {
    const onCount = vi.fn();
    renderHook(() =>
      useWebsocket({
        url: 'ws://localhost/ws',
        onCount,
      }),
    );

    flushWsOpen();
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.onmessage?.(
        new MessageEvent('message', {
          data: JSON.stringify({ type: 'count', count: 42 }),
        }),
      );
    });

    expect(onCount).toHaveBeenCalledWith(42);
  });

  it('calls onConnectionDelay on pong', () => {
    const onConnectionDelay = vi.fn();
    renderHook(() =>
      useWebsocket({ url: 'ws://localhost/ws', onConnectionDelay }),
    );

    flushWsOpen();

    // Trigger a ping first to set pingStartTime
    act(() => {
      vi.advanceTimersByTime(30000);
    });

    // Simulate pong
    act(() => {
      const ws = MockWebSocket.instances[0];
      ws.onmessage?.(new MessageEvent('message', { data: '{"type":"pong"}' }));
    });

    expect(onConnectionDelay).toHaveBeenCalled();
    expect(onConnectionDelay.mock.calls[0][0]).toBeGreaterThanOrEqual(0);
  });

  it('reconnects with exponential backoff on non-1000 close', () => {
    renderHook(() =>
      useWebsocket({
        url: 'ws://localhost/ws',
        reconnectBaseMs: 1000,
        reconnectMaxMs: 30000,
      }),
    );

    flushWsOpen();
    expect(MockWebSocket.instances.length).toBe(1);

    // Simulate abnormal close (code 1006)
    act(() => {
      const ws = MockWebSocket.instances[0];
      ws.onclose?.(new CloseEvent('close', { code: 1006, wasClean: false }));
    });

    // Should schedule reconnect after 1s (base * 2^0)
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(MockWebSocket.instances.length).toBe(2);

    // Second instance was created by reconnect, close it abnormally
    act(() => {
      MockWebSocket.instances[1].onclose?.(
        new CloseEvent('close', { code: 1006, wasClean: false }),
      );
    });

    // Backoff = base * 2^1 = 2000ms. At 1999ms, no reconnect yet.
    // Note: MockWebSocket constructor uses setTimeout(fn, 0) to simulate async open,
    // so advancing timers also triggers pending opens from prior reconnects.
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // 1 original + 1 first reconnect + 1 second reconnect = 3
    expect(MockWebSocket.instances.length).toBe(3);
  });

  it('does not reconnect on clean close (code 1000)', () => {
    const { unmount } = renderHook(() =>
      useWebsocket({ url: 'ws://localhost/ws' }),
    );

    flushWsOpen();

    act(() => {
      MockWebSocket.instances[0].close(1000);
    });

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // Only 1 instance created, no reconnect
    expect(MockWebSocket.instances.length).toBe(1);

    unmount();
  });

  it('reconnects on visibilitychange to visible while disconnected', () => {
    renderHook(() => useWebsocket({ url: 'ws://localhost/ws' }));

    flushWsOpen();
    expect(MockWebSocket.instances.length).toBe(1);

    // Simulate abnormal close
    act(() => {
      MockWebSocket.instances[0].onclose?.(
        new CloseEvent('close', { code: 1006, wasClean: false }),
      );
    });

    // Simulate tab becoming visible
    act(() => {
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
      document.dispatchEvent(new Event('visibilitychange'));
    });

    flushWsOpen();
    expect(MockWebSocket.instances.length).toBe(2);
  });

  it('disconnects on beforeunload', () => {
    renderHook(() => useWebsocket({ url: 'ws://localhost/ws' }));

    flushWsOpen();
    const ws = MockWebSocket.instances[0];
    const closeSpy = vi.spyOn(ws, 'close');

    act(() => {
      window.dispatchEvent(new Event('beforeunload'));
    });

    expect(closeSpy).toHaveBeenCalledWith(1000);
  });

  it('cleans up on unmount', () => {
    const { unmount } = renderHook(() =>
      useWebsocket({ url: 'ws://localhost/ws' }),
    );

    flushWsOpen();
    const ws = MockWebSocket.instances[0];
    const closeSpy = vi.spyOn(ws, 'close');

    unmount();

    expect(closeSpy).toHaveBeenCalledWith(1000);
  });
});
