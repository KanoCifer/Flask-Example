import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import {
  playThemeTransition,
  applyThemeToDocument,
  applyFontToDocument,
  applySchemeToDocument,
  isColorScheme,
  STORAGE_KEYS,
} from '@readinglist/utils';
import type { ColorScheme, Theme as UtilsTheme, FontFamily as UtilsFontFamily } from '@readinglist/utils';

// 供仍从 @/stores 导入的模块保持兼容
export { COLOR_SCHEMES, isColorScheme } from '@readinglist/utils';

export type Theme = UtilsTheme;
export type FontFamily = UtilsFontFamily;
export type { ColorScheme };

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<Theme>(
    (localStorage.getItem(STORAGE_KEYS.theme) as Theme) || 'system',
  );

  const stored = localStorage.getItem(STORAGE_KEYS.scheme);
  const scheme = ref<ColorScheme>(isColorScheme(stored) ? stored : 'paper');

  const showFooter = ref<string>(localStorage.getItem('show-footer') || 'true');

  const font = ref<FontFamily>(
    (localStorage.getItem(STORAGE_KEYS.font) as FontFamily) || 'default',
  );

  // 背景模糊值（px），兼容旧版 blur-* 字符串存储
  const storedBlur = localStorage.getItem(STORAGE_KEYS.bgBlur);
  const bgBlur = ref<number>(
    storedBlur && !storedBlur.startsWith('blur-') ? Number(storedBlur) : 0,
  );

  const saveBgBlur = (newBlur: number) => {
    bgBlur.value = newBlur;
    localStorage.setItem(STORAGE_KEYS.bgBlur, String(newBlur));
  };

  const bgBrightness = ref<number>(
    Number(localStorage.getItem(STORAGE_KEYS.bgBrightness) || 1.0),
  );

  const saveBgBrightness = (val: number) => {
    bgBrightness.value = val;
    localStorage.setItem(STORAGE_KEYS.bgBrightness, String(val));
  };

  const bgScale = ref<number>(Number(localStorage.getItem(STORAGE_KEYS.bgScale) || 1.05));

  const saveBgScale = (val: number) => {
    bgScale.value = val;
    localStorage.setItem(STORAGE_KEYS.bgScale, String(val));
  };

  const toggleFooter = () => {
    showFooter.value = showFooter.value === 'true' ? 'false' : 'true';
    localStorage.setItem('show-footer', showFooter.value);
  };

  const applyFont = (newFont: FontFamily) => {
    font.value = newFont;
    applyFontToDocument(newFont);
    localStorage.setItem(STORAGE_KEYS.font, newFont);
  };

  const applyTheme = (newTheme: Theme) => {
    applyThemeToDocument(newTheme);

    if (newTheme === 'system') {
      localStorage.removeItem(STORAGE_KEYS.theme);
    } else {
      localStorage.setItem(STORAGE_KEYS.theme, newTheme);
    }
  };

  const applyScheme = (newScheme: ColorScheme) => {
    applySchemeToDocument(newScheme);
    localStorage.setItem(STORAGE_KEYS.scheme, newScheme);
  };

  // Watch for theme changes
  watch(theme, (newTheme) => {
    applyTheme(newTheme);
  });

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleSystemChange = () => {
    if (theme.value === 'system') {
      applyTheme('system');
    }
  };

  // Apply theme, scheme, and font immediately
  applyTheme(theme.value);
  applyScheme(scheme.value);
  applyFont(font.value);
  mediaQuery.addEventListener('change', handleSystemChange);

  const setTheme = (newTheme: Theme) => {
    theme.value = newTheme;
  };

  const setThemeWithAnimation = (event: MouseEvent, newTheme: Theme) => {
    playThemeTransition(event, newTheme, scheme.value, () => {
      setTheme(newTheme);
    });
  };

  const setScheme = (newScheme: ColorScheme) => {
    scheme.value = newScheme;
    applyScheme(newScheme);
  };

  const toggleTheme = () => {
    if (theme.value === 'light') {
      setTheme('dark');
    } else if (theme.value === 'dark') {
      setTheme('light');
    } else {
      // If system, toggle based on current system preference
      const isCurrentlyDark = window.matchMedia(
        '(prefers-color-scheme: dark)',
      ).matches;
      setTheme(isCurrentlyDark ? 'light' : 'dark');
    }
  };

  return {
    theme,
    scheme,
    font,
    showFooter,
    bgBlur,
    saveBgBlur,
    bgBrightness,
    saveBgBrightness,
    bgScale,
    saveBgScale,
    setTheme,
    setScheme,
    toggleTheme,
    toggleFooter,
    setThemeWithAnimation,
    applyFont,
  };
});
