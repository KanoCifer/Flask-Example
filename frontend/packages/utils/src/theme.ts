// ── theme.ts ────────────────────────────────────────────────────────────────
// 主题 / 配色方案 / 字体应用到 DOM 的纯函数。框架无关，零 React/Vue 运行时依赖。
//
// 从 Vue 端 `stores/theme.ts` 与 React 端 `stores/themeState.ts` 迁入，
// 以 Vue 端为底本（toggle-dark-only 策略）。
//
// 上层（vue-app/stores/theme · react-app/stores/themeState）负责：
// 状态容器（Pinia ref / Zustand state）、持久化策略、matchMedia 监听。

import { isColorScheme } from './colorScheme';
import type { ColorScheme } from './colorScheme';

export type Theme = 'light' | 'dark' | 'system';
export type FontFamily = 'default' | 'harmonyos';

/** 双端共享的 localStorage key 常量 */
export const STORAGE_KEYS = {
  theme: 'theme',
  scheme: 'color-scheme',
  font: 'font',
  bgBlur: 'bg-blur',
  bgBrightness: 'bg-brightness',
  bgScale: 'bg-scale',
} as const;

/**
 * 应用主题到 DOM — 仅 toggle `dark` class，不添加 `light` class。
 * 与 Vue 端原实现一致：system 模式下根据 matchMedia 判定。
 */
export function applyThemeToDocument(theme: Theme): void {
  const root = document.documentElement;
  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

/** 应用字体到 DOM — 设置或移除 `data-font` 属性 */
export function applyFontToDocument(font: FontFamily): void {
  const root = document.documentElement;
  if (font === 'harmonyos') {
    root.setAttribute('data-font', 'harmonyos');
  } else {
    root.removeAttribute('data-font');
  }
}

/** 应用配色方案到 DOM — 设置 `data-color-scheme` 属性 */
export function applySchemeToDocument(scheme: ColorScheme): void {
  if (!isColorScheme(scheme)) return;
  document.documentElement.setAttribute('data-color-scheme', scheme);
}
