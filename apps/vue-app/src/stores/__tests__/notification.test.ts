import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useNotificationStore } from '../notification';

describe('notification store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('初始无 toasts', () => {
    const store = useNotificationStore();
    expect(store.toasts).toHaveLength(0);
  });

  it('push 添加 toast 并返回 id', () => {
    const store = useNotificationStore();
    const id = store.push('Hello', 'info');
    expect(id).toBe(1);
    expect(store.toasts).toHaveLength(1);
    expect(store.toasts[0].message).toBe('Hello');
    expect(store.toasts[0].type).toBe('info');
  });

  it('success/error/info/warning 设置对应 type', () => {
    const store = useNotificationStore();
    store.success('ok');
    store.error('bad');
    store.info('note');
    store.warning('careful');

    expect(store.toasts.map((t) => t.type)).toEqual([
      'success',
      'error',
      'info',
      'warning',
    ]);
  });

  it('dismiss 移除指定 toast', () => {
    const store = useNotificationStore();
    const id = store.push('to remove', 'info');
    store.dismiss(id);
    expect(store.toasts).toHaveLength(0);
  });

  it('clear 清空所有 toast', () => {
    const store = useNotificationStore();
    store.push('a');
    store.push('b');
    store.clear();
    expect(store.toasts).toHaveLength(0);
  });

  it('timeout 后自动 dismiss', () => {
    const store = useNotificationStore();
    store.push('auto dismiss', 'info', 3000);
    expect(store.toasts).toHaveLength(1);

    vi.advanceTimersByTime(3000);
    expect(store.toasts).toHaveLength(0);
  });

  it('timeout=0 不自动 dismiss', () => {
    const store = useNotificationStore();
    store.push('sticky', 'info', 0);
    vi.advanceTimersByTime(99999);
    expect(store.toasts).toHaveLength(1);
  });
});
