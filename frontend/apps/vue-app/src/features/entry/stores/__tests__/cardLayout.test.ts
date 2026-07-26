import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useCardLayoutStore } from '@/features/entry/cardLayout';

describe('cardLayout store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('初始 offsets 为空，isEditing false', () => {
    const store = useCardLayoutStore();
    expect(store.offsets).toEqual({});
    expect(store.isEditing).toBe(false);
  });

  it('getOffset 返回默认值 {x:0, y:0}', () => {
    const store = useCardLayoutStore();
    expect(store.getOffset('card-a')).toEqual({ x: 0, y: 0 });
  });

  it('setOffset 更新指定卡片偏移', () => {
    const store = useCardLayoutStore();
    store.setOffset('card-a', { x: 10, y: 20 });
    expect(store.getOffset('card-a')).toEqual({ x: 10, y: 20 });
  });

  it('getOffset 返回稳定引用', () => {
    const store = useCardLayoutStore();
    store.setOffset('card-a', { x: 5, y: 5 });
    const a = store.getOffset('card-a');
    const b = store.getOffset('card-a');
    expect(a).toBe(b); // 同一引用
  });

  it('saveEditing 持久化当前 offsets 到 localStorage', () => {
    const store = useCardLayoutStore();
    store.setOffset('card-a', { x: 1, y: 2 });
    store.startEditing();
    store.saveEditing();
    const raw = localStorage.getItem('readinglist_card_offsets');
    expect(raw).toBe(JSON.stringify({ 'card-a': { x: 1, y: 2 } }));
  });

  it('startEditing 创建快照', () => {
    const store = useCardLayoutStore();
    store.setOffset('card-a', { x: 10, y: 10 });
    store.startEditing();
    expect(store.isEditing).toBe(true);
    expect(store.snapshot).toEqual({ 'card-a': { x: 10, y: 10 } });
  });

  it('saveEditing 持久化并退出编辑模式', () => {
    const store = useCardLayoutStore();
    store.startEditing();
    store.setOffset('card-b', { x: 3, y: 4 });
    store.saveEditing();
    expect(store.isEditing).toBe(false);
    expect(store.snapshot).toBeNull();
    expect(
      JSON.parse(localStorage.getItem('readinglist_card_offsets')!),
    ).toEqual({
      'card-b': { x: 3, y: 4 },
    });
  });

  it('cancelEditing 回滚到快照', () => {
    const store = useCardLayoutStore();
    store.setOffset('card-a', { x: 10, y: 10 });
    store.startEditing();
    store.setOffset('card-a', { x: 99, y: 99 });
    store.cancelEditing();
    expect(store.isEditing).toBe(false);
    expect(store.getOffset('card-a')).toEqual({ x: 10, y: 10 });
  });

  it('resetAllOffsets 清空所有偏移', () => {
    const store = useCardLayoutStore();
    store.setOffset('card-a', { x: 1, y: 2 });
    store.setOffset('card-b', { x: 3, y: 4 });
    store.resetAllOffsets();
    expect(store.offsets).toEqual({});
    expect(localStorage.getItem('readinglist_card_offsets')).toBe('{}');
  });
});
