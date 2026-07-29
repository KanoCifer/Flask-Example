/**
 * 框架无关的 toast 通知队列。
 *
 * 职责：队列语义（push/dismiss/clear）、便利方法（success/error/info/warning）、
 * auto-dismiss timer、默认 timeout 表。不含 Vue / React 运行时依赖。
 *
 * 上层（vue-app/stores/notification · react-app/stores/notificationState）负责：
 * 响应式状态桥接（Pinia ref / Zustand set）。
 */

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  timeout?: number;
}

export type ToastListener = (items: readonly ToastItem[]) => void;

export class ToastQueue {
  /** 各 type 默认 timeout（ms），与 vue-app 原实现一致 */
  static readonly DEFAULTS: Record<ToastType, number> = {
    success: 3000,
    error: 5000,
    info: 3000,
    warning: 4000,
  };

  private items: ToastItem[] = [];
  private idCounter = 0;
  private timers = new Map<number, ReturnType<typeof setTimeout>>();
  private listeners = new Set<ToastListener>();

  /** 当前队列快照（只读副本） */
  getItems(): readonly ToastItem[] {
    return this.items;
  }

  /** 订阅队列变化；返回取消订阅函数 */
  subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    const snapshot = this.getItems();
    this.listeners.forEach((fn) => fn(snapshot));
  }

  push(message: string, type: ToastType = 'info', timeout = 4000): number {
    const id = this.idCounter++;
    const item: ToastItem = { id, message, type, timeout };
    this.items = [...this.items, item];

    if (timeout > 0) {
      const timer = setTimeout(() => this.dismiss(id), timeout);
      this.timers.set(id, timer);
    }
    this.emit();
    return id;
  }

  success(message: string, timeout: number = ToastQueue.DEFAULTS.success): number {
    return this.push(message, 'success', timeout);
  }

  error(message: string, timeout: number = ToastQueue.DEFAULTS.error): number {
    return this.push(message, 'error', timeout);
  }

  info(message: string, timeout: number = ToastQueue.DEFAULTS.info): number {
    return this.push(message, 'info', timeout);
  }

  warning(message: string, timeout: number = ToastQueue.DEFAULTS.warning): number {
    return this.push(message, 'warning', timeout);
  }

  dismiss(id: number): void {
    const timer = this.timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.items = this.items.filter((t) => t.id !== id);
    this.emit();
  }

  clear(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    this.items = [];
    this.emit();
  }
}
