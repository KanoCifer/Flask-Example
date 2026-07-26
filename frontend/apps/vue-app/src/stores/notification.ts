import { defineStore } from 'pinia';
import { ref } from 'vue';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  timeout?: number;
}

export const useNotificationStore = defineStore('notification', () => {
  const toasts = ref<ToastItem[]>([]);
  let idCounter = 1;

  function push(message: string, type: ToastType = 'info', timeout = 4000) {
    const id = idCounter++;
    toasts.value.push({ id, message, type, timeout });

    if (timeout > 0) {
      setTimeout(() => dismiss(id), timeout);
    }
    return id;
  }

  function success(message: string, timeout?: number) {
    return push(message, 'success', timeout ?? 3000);
  }

  function error(message: string, timeout?: number) {
    return push(message, 'error', timeout ?? 10000);
  }

  function info(message: string, timeout?: number) {
    return push(message, 'info', timeout ?? 3000);
  }

  function warning(message: string, timeout?: number) {
    return push(message, 'warning', timeout ?? 4000);
  }

  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  function clear() {
    toasts.value = [];
  }

  return { toasts, push, success, error, info, warning, dismiss, clear };
});
