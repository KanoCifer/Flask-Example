import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TRANSITION_NAME,
  TRANSITION_NAMES,
  isRouteTransitionName,
  resolveTransitionName,
} from '../../route-transition';

// ── TRANSITION_NAMES ─────────────────────────────────────────────────────

describe('TRANSITION_NAMES', () => {
  it('包含所有已注册的动画名', () => {
    expect(TRANSITION_NAMES.size).toBe(2);
    expect(TRANSITION_NAMES.has('fade')).toBe(true);
    expect(TRANSITION_NAMES.has('slide-up')).toBe(true);
  });
});

// ── isRouteTransitionName ────────────────────────────────────────────────

describe('isRouteTransitionName', () => {
  it.each(['fade', 'slide-up'] as const)('接受合法值 %s', (name) => {
    expect(isRouteTransitionName(name)).toBe(true);
  });

  it.each([undefined, null, '', 'none', 'SLIDE-UP', 0, {}, []])(
    '拒绝非法值 %p',
    (value) => {
      expect(isRouteTransitionName(value)).toBe(false);
    },
  );
});

// ── resolveTransitionName ────────────────────────────────────────────────

describe('resolveTransitionName', () => {
  it('缺失 meta → 使用默认 slide-up', () => {
    expect(resolveTransitionName(undefined)).toBe(DEFAULT_TRANSITION_NAME);
  });

  it.each(['fade', 'slide-up'] as const)('合法值 %s → 返回自身', (name) => {
    expect(resolveTransitionName(name)).toBe(name);
  });

  it.each(['', 'none', 'SLIDE-UP', 0, null, {}])(
    '未知 / 非字符串值 %p → 降级到默认',
    (value) => {
      expect(resolveTransitionName(value)).toBe(DEFAULT_TRANSITION_NAME);
    },
  );
});
