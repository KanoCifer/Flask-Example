import { describe, it, expect } from 'vitest';
import { formatDate } from '../formatdate';

describe('formatDate', () => {
  it('空值返回 未知时间', () => {
    expect(formatDate(null)).toBe('未知时间');
    expect(formatDate(undefined)).toBe('未知时间');
  });

  it('默认格式化为 YYYY-MM-DD HH:mm:ss', () => {
    const result = formatDate('2026-07-03T08:00:00Z');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('支持自定义 format', () => {
    expect(formatDate('2026-07-03T08:00:00Z', 'YYYY年MM月DD日')).toBe(
      '2026年07月03日',
    );
  });

  it('仅日期格式', () => {
    expect(formatDate('2026-07-03T08:00:00Z', 'YYYY-MM-DD')).toBe('2026-07-03');
  });
});
