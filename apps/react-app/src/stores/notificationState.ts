import { create } from 'zustand';

interface Notification {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  timeout?: number;
}

interface NotificationState {
  notifications: Notification[];
  push: (
    message: string,
    type: 'success' | 'error' | 'info' | 'warning',
    timeout?: number,
  ) => number;
  success: (message: string, timeout?: number) => number;
  error: (message: string, timeout?: number) => number;
  info: (message: string, timeout?: number) => number;
  warning: (message: string, timeout?: number) => number;
  dismiss: (id: number) => void;
  clear: () => void;
}

let idCounter = 0;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],

  // 改变通知array的方法
  push: (
    message: string,
    type: 'success' | 'error' | 'info' | 'warning',
    timeout: number = 3000,
  ) => {
    const id = idCounter++;

    set((state) => ({
      notifications: [...state.notifications, { id, message, type, timeout }],
    }));
    return id;
  },

  success: (message, timeout) =>
    get().push(message, 'success', timeout ?? 3000),
  error: (message, timeout) => get().push(message, 'error', timeout ?? 10000),
  info: (message, timeout) => get().push(message, 'info', timeout ?? 3000),
  warning: (message, timeout) =>
    get().push(message, 'warning', timeout ?? 4000),

  dismiss: (id) =>
    set((state) => ({
      notifications: state.notifications.filter(
        (notification) => notification.id !== id,
      ),
    })),
  clear: () => set(() => ({ notifications: [] })),
}));
