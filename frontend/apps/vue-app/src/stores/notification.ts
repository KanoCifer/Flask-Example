import { defineStore } from 'pinia';
import { ref } from 'vue';
import { ToastQueue } from '@readinglist/utils';
import type { ToastType, ToastItem } from '@readinglist/utils';

export type { ToastType, ToastItem };

export const useNotificationStore = defineStore('notification', () => {
  const queue = new ToastQueue();
  const toasts = ref<ToastItem[]>([]);

  queue.subscribe((items) => {
    toasts.value = [...items];
  });

  return {
    toasts,
    push: (message: string, type?: ToastType, timeout?: number) =>
      queue.push(message, type, timeout),
    success: (message: string, timeout?: number) => queue.success(message, timeout),
    error: (message: string, timeout?: number) => queue.error(message, timeout),
    info: (message: string, timeout?: number) => queue.info(message, timeout),
    warning: (message: string, timeout?: number) => queue.warning(message, timeout),
    dismiss: (id: number) => queue.dismiss(id),
    clear: () => queue.clear(),
  };
});
