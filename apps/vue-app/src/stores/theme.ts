import { playThemeTransition } from '@/lib';
import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export type Theme = 'light' | 'dark' | 'system';
export type ColorScheme = 'paper' | 'sage' | 'mist' | 'blush';

export const COLOR_SCHEMES = ['paper', 'sage', 'mist', 'blush'] as const;

export const isColorScheme = (v: unknown): v is ColorScheme =>
  typeof v === 'string' && (COLOR_SCHEMES as readonly string[]).includes(v);
export type FontFamily = 'default' | 'harmonyos';
export const useThemeStore = defineStore('theme', () => {
  const theme = ref<Theme>(
    (localStorage.getItem('theme') as Theme) || 'system',
  );

  const stored = localStorage.getItem('color-scheme');
  const scheme = ref<ColorScheme>(isColorScheme(stored) ? stored : 'paper');

  const showFooter = ref<string>(localStorage.getItem('show-footer') || 'true');

  const font = ref<FontFamily>(
    (localStorage.getItem('font') as FontFamily) || 'default',
  );

  // 背景模糊值（px），兼容旧版 blur-* 字符串存储
  const storedBlur = localStorage.getItem('bg-blur');
  const bgBlur = ref<number>(
    storedBlur && !storedBlur.startsWith('blur-') ? Number(storedBlur) : 0,
  );

  const saveBgBlur = (newBlur: number) => {
    bgBlur.value = newBlur;
    localStorage.setItem('bg-blur', String(newBlur));
  };

  const bgBrightness = ref<number>(
    Number(localStorage.getItem('bg-brightness') || 1.0),
  );

  const saveBgBrightness = (val: number) => {
    bgBrightness.value = val;
    localStorage.setItem('bg-brightness', String(val));
  };

  const bgScale = ref<number>(Number(localStorage.getItem('bg-scale') || 1.05));

  const saveBgScale = (val: number) => {
    bgScale.value = val;
    localStorage.setItem('bg-scale', String(val));
  };

  const toggleFooter = () => {
    showFooter.value = showFooter.value === 'true' ? 'false' : 'true';
    localStorage.setItem('show-footer', showFooter.value);
  };

  const applyFont = (newFont: FontFamily) => {
    font.value = newFont;
    const root = document.documentElement;
    if (newFont === 'harmonyos') {
      root.setAttribute('data-font', 'harmonyos');
    } else {
      root.removeAttribute('data-font');
    }
    localStorage.setItem('font', newFont);
  };

  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement;
    const isDark =
      newTheme === 'dark' ||
      (newTheme === 'system' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    if (newTheme === 'system') {
      localStorage.removeItem('theme');
    } else {
      localStorage.setItem('theme', newTheme);
    }
  };

  const applyScheme = (newScheme: ColorScheme) => {
    if (!isColorScheme(newScheme)) return;
    document.documentElement.setAttribute('data-color-scheme', newScheme);
    localStorage.setItem('color-scheme', newScheme);
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
