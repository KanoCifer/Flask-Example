import { describe, it, expect, beforeEach } from 'vitest';
import { getVisitorId } from '../visitorId';

describe('getVisitorId', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('首次调用生成 UUID 并持久化', () => {
    const id = getVisitorId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(localStorage.getItem('visitor_id')).toBe(id);
  });

  it('多次调用返回同一个 ID', () => {
    const first = getVisitorId();
    const second = getVisitorId();
    expect(first).toBe(second);
  });

  it('localStorage 已有 ID 时直接返回', () => {
    localStorage.setItem('visitor_id', 'test-fixed-id');
    expect(getVisitorId()).toBe('test-fixed-id');
  });
});
