import { describe, expect, it } from 'vitest';

import { withAlpha } from '../useChartTheme';

describe('withAlpha (culori)', () => {
  it('空 / undefined / 非字符串输入回退到 safe rgba', () => {
    expect(withAlpha('', 0.18)).toBe('rgba(120, 134, 170, 0.18)');
    expect(withAlpha(undefined, 0.5)).toBe('rgba(120, 134, 170, 0.5)');
    expect(withAlpha(null, 0.3)).toBe('rgba(120, 134, 170, 0.3)');
  });

  it('rgb / rgba 输入设为指定 alpha', () => {
    expect(withAlpha('rgb(255, 0, 0)', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
    expect(withAlpha('rgba(0, 128, 255, 1)', 0.24)).toBe(
      'rgba(0, 128, 255, 0.24)',
    );
  });

  it('hex 输入解析后转 rgba', () => {
    expect(withAlpha('#5470c6', 0.18)).toBe('rgba(84, 112, 198, 0.18)');
  });

  // 回归：老正则实现遇到 oklch/hsl 直接丢弃走 fallback，culori 能真正解析。
  it('oklch / hsl 现代色彩空间转 rgba，绝不返回原字符串', () => {
    const oklch = withAlpha('oklch(60% 0.2 250)', 0.18);
    expect(oklch).toBe('rgba(0, 129, 241, 0.18)');
    expect(oklch).not.toContain('oklch');

    expect(withAlpha('hsl(0, 100%, 50%)', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
  });

  it('无法解析的输入回退到 safe rgba', () => {
    const result = withAlpha('not-a-real-color', 0.4);
    expect(result).toBe('rgba(120, 134, 170, 0.4)');
    expect(result).not.toContain('not-a-real-color');
  });

  it('返回值始终是合法 rgba 字符串（防御性 invariant）', () => {
    const inputs = [
      '',
      'oklch(60% 0.2 250)',
      'hsl(0, 100%, 50%)',
      'invalid-color',
      '#5470c6',
      'rgb(0, 0, 0)',
      'rgba(255, 255, 255, 1)',
      'red',
    ];
    for (const input of inputs) {
      const out = withAlpha(input, 0.5);
      expect(out).toMatch(/^rgba\(/);
      expect(out.endsWith(', 0.5)')).toBe(true);
    }
  });
});
