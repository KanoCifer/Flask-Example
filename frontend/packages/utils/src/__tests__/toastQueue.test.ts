import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToastQueue, type ToastItem } from '../toastQueue';

describe('ToastQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('初始为空', () => {
    const q = new ToastQueue();
    expect(q.getItems()).toHaveLength(0);
  });

  it('push 添加 item 并返回自增 id', () => {
    const q = new ToastQueue();
    const id = q.push('Hello', 'info');
    expect(id).toBe(0);
    expect(q.getItems()).toHaveLength(1);
    expect(q.getItems()[0].message).toBe('Hello');
    expect(q.getItems()[0].type).toBe('info');
  });

  it('success/error/info/warning 设置对应 type', () => {
    const q = new ToastQueue();
    q.success('ok');
    q.error('bad');
    q.info('note');
    q.warning('careful');

    expect(q.getItems().map((t) => t.type)).toEqual([
      'success',
      'error',
      'info',
      'warning',
    ]);
  });

  it('dismiss 移除指定 item', () => {
    const q = new ToastQueue();
    const id = q.push('to remove', 'info');
    q.dismiss(id);
    expect(q.getItems()).toHaveLength(0);
  });

  it('clear 清空所有 item', () => {
    const q = new ToastQueue();
    q.push('a');
    q.push('b');
    q.clear();
    expect(q.getItems()).toHaveLength(0);
  });

  it('timeout 后自动 dismiss', () => {
    const q = new ToastQueue();
    q.push('auto dismiss', 'info', 3000);
    expect(q.getItems()).toHaveLength(1);

    vi.advanceTimersByTime(3000);
    expect(q.getItems()).toHaveLength(0);
  });

  it('timeout=0 不自动 dismiss', () => {
    const q = new ToastQueue();
    q.push('sticky', 'info', 0);
    vi.advanceTimersByTime(99999);
    expect(q.getItems()).toHaveLength(1);
  });

  it('dismiss 清理对应 timer，不触发自动 dismiss', () => {
    const q = new ToastQueue();
    const id = q.push('manual dismiss', 'info', 3000);
    q.dismiss(id);
    expect(q.getItems()).toHaveLength(0);

    vi.advanceTimersByTime(3000);
    // 已被手动 dismiss，timer 已清理，不会再次触发
    expect(q.getItems()).toHaveLength(0);
  });

  it('clear 清理所有 timer', () => {
    const q = new ToastQueue();
    q.push('a', 'info', 1000);
    q.push('b', 'info', 2000);
    q.clear();

    vi.advanceTimersByTime(2000);
    expect(q.getItems()).toHaveLength(0);
  });

  it('subscribe 在 push/dismiss/clear 时收到快照', () => {
    const q = new ToastQueue();
    const snapshots: ToastItem[][] = [];
    q.subscribe((items) => {
      snapshots.push([...items]);
    });

    q.push('first');
    q.push('second');
    q.dismiss(0);
    q.clear();

    expect(snapshots).toHaveLength(4);
    expect(snapshots[0]).toHaveLength(1);
    expect(snapshots[1]).toHaveLength(2);
    expect(snapshots[2]).toHaveLength(1);
    expect(snapshots[2][0].message).toBe('second');
    expect(snapshots[3]).toHaveLength(0);
  });

  it('取消订阅后不再收到回调', () => {
    const q = new ToastQueue();
    const snapshots: ToastItem[][] = [];
    const unsub = q.subscribe((items) => {
      snapshots.push([...items]);
    });

    q.push('before unsub');
    unsub();
    q.push('after unsub');

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0][0].message).toBe('before unsub');
  });

  it('默认 timeout 与 vue-app 原实现一致', () => {
    expect(ToastQueue.DEFAULTS.success).toBe(3000);
    expect(ToastQueue.DEFAULTS.error).toBe(5000);
    expect(ToastQueue.DEFAULTS.info).toBe(3000);
    expect(ToastQueue.DEFAULTS.warning).toBe(4000);
  });
});
