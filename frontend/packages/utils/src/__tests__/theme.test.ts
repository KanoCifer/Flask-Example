import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  applyThemeToDocument,
  applyFontToDocument,
  applySchemeToDocument,
  STORAGE_KEYS,
  type Theme,
} from '../theme';

describe('theme DOM-application functions', () => {
  let root: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    root = document.documentElement;
    root.className = '';
    root.removeAttribute('data-font');
    root.removeAttribute('data-color-scheme');
  });

  describe('applyThemeToDocument', () => {
    it('dark 模式添加 dark class', () => {
      applyThemeToDocument('dark');
      expect(root.classList.contains('dark')).toBe(true);
    });

    it('light 模式移除 dark class', () => {
      root.classList.add('dark');
      applyThemeToDocument('light');
      expect(root.classList.contains('dark')).toBe(false);
    });

    it('system 模式根据 matchMedia 判定（暗色系统)', () => {
      vi.stubGlobal('matchMedia', () =>
        ({
          matches: true,
          media: '(prefers-color-scheme: dark)',
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
          onchange: null,
          dispatchEvent: () => false,
        }) as unknown as MediaQueryList,
      );

      applyThemeToDocument('system');
      expect(root.classList.contains('dark')).toBe(true);
    });

    it('system 模式根据 matchMedia 判定（亮色系统)', () => {
      vi.stubGlobal('matchMedia', () =>
        ({
          matches: false,
          media: '(prefers-color-scheme: dark)',
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
          onchange: null,
          dispatchEvent: () => false,
        }) as unknown as MediaQueryList,
      );

      root.classList.add('dark');
      applyThemeToDocument('system');
      expect(root.classList.contains('dark')).toBe(false);
    });
  });

  describe('applyFontToDocument', () => {
    it('harmonyos 设置 data-font 属性', () => {
      applyFontToDocument('harmonyos');
      expect(root.getAttribute('data-font')).toBe('harmonyos');
    });

    it('default 移除 data-font 属性', () => {
      root.setAttribute('data-font', 'harmonyos');
      applyFontToDocument('default');
      expect(root.hasAttribute('data-font')).toBe(false);
    });
  });

  describe('applySchemeToDocument', () => {
    it('合法 scheme 设置 data-color-scheme 属性', () => {
      applySchemeToDocument('sage');
      expect(root.getAttribute('data-color-scheme')).toBe('sage');
    });

    it('非法 scheme 不操作 DOM', () => {
      applySchemeToDocument('invalid-scheme' as Theme & 'invalid-scheme');
      expect(root.hasAttribute('data-color-scheme')).toBe(false);
    });
  });

  describe('STORAGE_KEYS', () => {
    it('包含预期的 key 集合', () => {
      expect(STORAGE_KEYS).toEqual({
        theme: 'theme',
        scheme: 'color-scheme',
        font: 'font',
        bgBlur: 'bg-blur',
        bgBrightness: 'bg-brightness',
        bgScale: 'bg-scale',
      });
    });
  });
});
