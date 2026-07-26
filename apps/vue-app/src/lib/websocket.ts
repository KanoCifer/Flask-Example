/**
 * 框架无关的 WebSocket 连接管理器。
 *
 * 职责：原生 WebSocket 连接、指数退避重连、ping/pong 延迟测量、
 * visitor_id 上报。不含 Vue / 浏览器事件绑定，可由任意上层包装。
 *
 * 上层（composables/useWebSocket）负责：Vue ref 状态同步、生命周期
 * (onMounted/onUnmounted)、visibilitychange / online 事件。
 */

export interface WebSocketManagerOptions {
  url: string;
  visitorId?: string | null;
  /** 收到服务端 count 消息时回调 */
  onCount?: (count: number) => void;
  /** 连接建立时回调 */
  onOpen?: () => void;
  /** 连接断开时回调（含正常关闭） */
  onClose?: (event: CloseEvent) => void;
  /** 连接错误时回调 */
  onError?: () => void;
  /** ping 往返延迟算出后回调（ms） */
  onLatency?: (ms: number) => void;
  reconnectBaseMs?: number;
  reconnectMaxMs?: number;
  pingIntervalMs?: number;
}

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingStartTime = 0;

  private readonly url: string;
  private readonly visitorId: string | null;
  private readonly onCount?: (count: number) => void;
  private readonly onOpen?: () => void;
  private readonly onClose?: (event: CloseEvent) => void;
  private readonly onError?: () => void;
  private readonly onLatency?: (ms: number) => void;
  private readonly reconnectBaseMs: number;
  private readonly reconnectMaxMs: number;
  private readonly pingIntervalMs: number;

  private _isConnected = false;
  private _connectionDelay = 0;
  private _reconnectAttempt = 0;

  constructor(options: WebSocketManagerOptions) {
    this.url = options.url;
    this.visitorId = options.visitorId ?? null;
    this.onCount = options.onCount;
    this.onOpen = options.onOpen;
    this.onClose = options.onClose;
    this.onError = options.onError;
    this.onLatency = options.onLatency;
    this.reconnectBaseMs = options.reconnectBaseMs ?? 1000;
    this.reconnectMaxMs = options.reconnectMaxMs ?? 30000;
    this.pingIntervalMs = options.pingIntervalMs ?? 30000;
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  get connectionDelay(): number {
    return this._connectionDelay;
  }

  get reconnectAttempt(): number {
    return this._reconnectAttempt;
  }

  private calculateConnectionDelay(startTime: number) {
    const delay = performance.now() - startTime;
    this._connectionDelay = delay;
    this.onLatency?.(delay);
  }

  private scheduleReconnect() {
    const delay = Math.min(
      this.reconnectBaseMs * Math.pow(2, this._reconnectAttempt),
      this.reconnectMaxMs,
    );
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
    this._reconnectAttempt++;
  }

  private startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.pingStartTime = performance.now();
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, this.pingIntervalMs);
  }

  private stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private sendVisitorId(visitorId: string | null) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({ type: 'visitor_id', visitor_id: visitorId }),
      );
    }
  }

  /** 发送一次性 ping，用于外部主动延迟测量（如 StatusView） */
  sendPing() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.pingStartTime = performance.now();
      this.ws.send(JSON.stringify({ type: 'ping' }));
    }
  }

  send(data: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  connect() {
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.close();
    }

    let startTime: number;

    try {
      startTime = performance.now();
      this.ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this._isConnected = true;
      this._reconnectAttempt = 0;
      this.calculateConnectionDelay(startTime);
      this.sendVisitorId(this.visitorId);
      this.startPing();
      this.onOpen?.();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (
          data.type === 'count' &&
          this.onCount &&
          typeof data.count === 'number'
        ) {
          this.onCount(data.count);
        } else if (data.type === 'pong') {
          this.calculateConnectionDelay(this.pingStartTime);
        }
      } catch {
        // ignore non-JSON or malformed messages
      }
    };

    this.ws.onclose = (event) => {
      this._isConnected = false;
      this.stopPing();
      this.onClose?.(event);
      if (event.code !== 1000) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      this.onError?.();
      this.ws?.close();
    };
  }

  disconnect() {
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close(1000);
      this.ws = null;
    }
    this._isConnected = false;
  }
}
