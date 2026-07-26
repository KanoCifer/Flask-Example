import { describe, it, expect } from 'vitest';
import { isColorScheme, COLOR_SCHEMES, type ColorScheme } from '../theme';

describe('theme utils', () => {
  describe('isColorScheme', () => {
    it('接受合法的 scheme 值', () => {
      const valid: ColorScheme[] = ['paper', 'sage', 'mist', 'blush'];
      valid.forEach((v) => {
        expect(isColorScheme(v)).toBe(true);
      });
    });

    it('拒绝非法字符串', () => {
      expect(isColorScheme('invalid')).toBe(false);
      expect(isColorScheme('blue')).toBe(false);
      expect(isColorScheme('')).toBe(false);
    });

    it('拒绝非字符串类型', () => {
      expect(isColorScheme(null)).toBe(false);
      expect(isColorScheme(undefined)).toBe(false);
      expect(isColorScheme(123)).toBe(false);
      expect(isColorScheme({})).toBe(false);
      expect(isColorScheme([])).toBe(false);
    });

    it('COLOR_SCHEMES 常量包含 4 个合法值', () => {
      expect(COLOR_SCHEMES).toEqual(['paper', 'sage', 'mist', 'blush']);
    });
  });
});
