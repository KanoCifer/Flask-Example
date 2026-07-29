import { create } from 'zustand';
import { ToastQueue } from '@readinglist/utils';
import type { ToastItem, ToastType } from '@readinglist/utils';

interface NotificationState {
  notifications: ToastItem[];
  push: (message: string, type: ToastType, timeout?: number) => number;
  success: (message: string, timeout?: number) => number;
  error: (message: string, timeout?: number) => number;
  info: (message: string, timeout?: number) => number;
  warning: (message: string, timeout?: number) => number;
  dismiss: (id: number) => void;
  clear: () => void;
}

const queue = new ToastQueue();

export const useNotificationStore = create<NotificationState>(() => ({
  notifications: [],

  push: (message: string, type: ToastType = 'info', timeout = 3000) =>
    queue.push(message, type, timeout),
  success: (message, timeout) => queue.success(message, timeout),
  error: (message, timeout) => queue.error(message, timeout),
  info: (message, timeout) => queue.info(message, timeout),
  warning: (message, timeout) => queue.warning(message, timeout),
  dismiss: (id) => queue.dismiss(id),
  clear: () => queue.clear(),
}));

// 桥接：queue 变化 → 更新 Zustand state（auto-dismiss 由 queue 核心驱动）
queue.subscribe((items) => {
  useNotificationStore.setState({ notifications: [...items] });
});
