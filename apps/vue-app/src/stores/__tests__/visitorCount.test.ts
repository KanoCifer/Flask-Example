import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useVisitorCountStore } from '@/features/visitor/stores/visitorCount';

describe('visitorCount store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('初始 count 为 0，未连接，visitorId 为 null', () => {
    const store = useVisitorCountStore();
    expect(store.count).toBe(0);
    expect(store.isConnected).toBe(false);
    expect(store.visitorId).toBeNull();
  });

  it('setCount 更新 count', () => {
    const store = useVisitorCountStore();
    store.setCount(42);
    expect(store.count).toBe(42);
  });

  it('setConnected 更新连接状态', () => {
    const store = useVisitorCountStore();
    store.setConnected(true);
    expect(store.isConnected).toBe(true);
    store.setConnected(false);
    expect(store.isConnected).toBe(false);
  });

  it('setVisitorId 更新 visitorId', () => {
    const store = useVisitorCountStore();
    store.setVisitorId('abc-123');
    expect(store.visitorId).toBe('abc-123');
    store.setVisitorId(null);
    expect(store.visitorId).toBeNull();
  });
});
