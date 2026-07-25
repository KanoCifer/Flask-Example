import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** 仅 mock CSS 变量读取；颜色解析交给 culori 真实执行。 */
function mockCssVar(value: string) {
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({
    getPropertyValue: () => value,
  } as unknown as CSSStyleDeclaration);
}

describe('resolveCssColor (culori)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockCssVar('');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('CSS 变量为空时返回 fallback', async () => {
    const { resolveCssColor } = await import('./color');
    expect(resolveCssColor('--primary', '#3b82f6')).toBe('#3b82f6');
  });

  it('culori 解析 oklch 后返回 rgb 字符串', async () => {
    mockCssVar('oklch(60% 0.2 250)');
    const { resolveCssColor } = await import('./color');
    expect(resolveCssColor('--primary', '#3b82f6')).toBe('rgb(0, 129, 241)');
  });

  it('无法解析的颜色返回 fallback，绝不泄露原字符串', async () => {
    mockCssVar('invalid-color');
    const { resolveCssColor } = await import('./color');
    const result = resolveCssColor('--primary', '#3b82f6');
    expect(result).toBe('#3b82f6');
    expect(result).not.toContain('invalid-color');
  });

  it('黑色 #000 正确解析为 rgb(0, 0, 0)', async () => {
    mockCssVar('#000');
    const { resolveCssColor } = await import('./color');
    expect(resolveCssColor('--primary', '#3b82f6')).toBe('rgb(0, 0, 0)');
  });

  it('命名色可解析', async () => {
    mockCssVar('red');
    const { resolveCssColor } = await import('./color');
    expect(resolveCssColor('--primary', '#3b82f6')).toBe('rgb(255, 0, 0)');
  });
});
