import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGreeting } from '../useGreeting';

describe('useGreeting', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function mockHour(hour: number) {
    vi.spyOn(Date.prototype, 'getHours').mockImplementation(() => hour);
  }

  it('早晨 (6:00-12:00) 返回 Good Morning', () => {
    mockHour(9);
    const { greeting, isDay, changelogHint } = useGreeting();
    expect(greeting.value).toBe('Good Morning');
    expect(isDay.value).toBe(true);
    expect(changelogHint.value).toContain("what's new today");
  });

  it('下午 (12:00-18:00) 返回 Good Afternoon', () => {
    mockHour(14);
    const { greeting, isDay, changelogHint } = useGreeting();
    expect(greeting.value).toBe('Good Afternoon');
    expect(isDay.value).toBe(true);
    expect(changelogHint.value).toContain('afternoon');
  });

  it('晚上 (18:00+) 返回 Good Evening', () => {
    mockHour(20);
    const { greeting, isDay, changelogHint } = useGreeting();
    expect(greeting.value).toBe('Good Evening');
    expect(isDay.value).toBe(false);
    expect(changelogHint.value).toContain('tonight');
  });

  it('凌晨 0 点到 6 点：isDay=false，greeting=Good Morning（<12 分支）', () => {
    mockHour(5);
    const { isDay, greeting } = useGreeting();
    // 代码逻辑：hour < 12 先命中第一个分支 → Good Morning
    // isDay 单独看 6≤h<18 → false
    expect(isDay.value).toBe(false);
    expect(greeting.value).toBe('Good Morning');
  });
});
