import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  playThemeTransition,
  applyThemeToDocument,
  applyFontToDocument,
  applySchemeToDocument,
  isColorScheme,
} from '@readinglist/utils';
import type { ColorScheme, Theme as UtilsTheme, FontFamily as UtilsFontFamily } from '@readinglist/utils';

type Theme = UtilsTheme;
type FontFamily = UtilsFontFamily;

interface ThemeState {
  theme: Theme;
  font: FontFamily;
  scheme: ColorScheme;
  bgBlur: number;
  bgBrightness: number;
  bgScale: number;
  cardIndex: number;
  setTheme: (theme: Theme) => void;
  setFont: (font: FontFamily) => void;
  setScheme: (scheme: ColorScheme) => void;
  setBgBlur: (val: number) => void;
  setBgBrightness: (val: number) => void;
  setBgScale: (val: number) => void;
  setCardIndex: (val: number) => void;
  resetBackground: () => void;
  toggleTheme: () => void;
  toggleThemeWithAnimation: (event: {
    clientX: number;
    clientY: number;
  }) => void;
}

const BG_DEFAULTS = { blur: 8, brightness: 1.0, scale: 1.05 } as const;

export type { Theme, FontFamily };
export type { ColorScheme } from '@readinglist/utils';

export const useThemeState = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      font: 'default',
      scheme: 'paper',
      bgBlur: Number(localStorage.getItem('bg-blur')) || BG_DEFAULTS.blur,
      bgBrightness:
        Number(localStorage.getItem('bg-brightness')) || BG_DEFAULTS.brightness,
      bgScale: Number(localStorage.getItem('bg-scale')) || BG_DEFAULTS.scale,
      cardIndex: Number(localStorage.getItem('card-image-index')) || 0,

      setTheme: (theme) => {
        applyThemeToDocument(theme);
        set({ theme });
      },

      setFont: (font) => {
        applyFontToDocument(font);
        set({ font });
      },

      setScheme: (scheme) => {
        if (!isColorScheme(scheme)) return;
        applySchemeToDocument(scheme);
        set({ scheme });
      },

      toggleTheme: () => {
        const currentTheme = get().theme;
        // 复用 setTheme
        get().setTheme(currentTheme === 'light' ? 'dark' : 'light');
      },

      toggleThemeWithAnimation: (event) => {
        const currentTheme = get().theme;
        const nextTheme = currentTheme === 'light' ? 'dark' : 'light';

        // playThemeTransition 签名: (event, targetTheme, scheme?, onComplete?)
        playThemeTransition(event, nextTheme, undefined, () => {
          get().setTheme(nextTheme);
        });
      },

      setBgBlur: (val) => {
        set({ bgBlur: val });
        localStorage.setItem('bg-blur', String(val));
      },
      setBgBrightness: (val) => {
        set({ bgBrightness: val });
        localStorage.setItem('bg-brightness', String(val));
      },
      setBgScale: (val) => {
        set({ bgScale: val });
        localStorage.setItem('bg-scale', String(val));
      },
      setCardIndex: (val) => {
        set({ cardIndex: val });
        localStorage.setItem('card-image-index', String(val));
      },
      resetBackground: () => {
        set({
          bgBlur: BG_DEFAULTS.blur,
          bgBrightness: BG_DEFAULTS.brightness,
          bgScale: BG_DEFAULTS.scale,
        });
        localStorage.setItem('bg-blur', String(BG_DEFAULTS.blur));
        localStorage.setItem('bg-brightness', String(BG_DEFAULTS.brightness));
        localStorage.setItem('bg-scale', String(BG_DEFAULTS.scale));
      },
    }),
    {
      name: 'theme-storage',

      onRehydrateStorage: () => (state) => {
        if (state?.theme) {
          applyThemeToDocument(state.theme);
        }
        if (state?.font) {
          applyFontToDocument(state.font);
        }
        if (state?.scheme) {
          applySchemeToDocument(state.scheme);
        }
      },

      partialize: (state) => ({
        theme: state.theme,
        font: state.font,
        scheme: state.scheme,
        bgBlur: state.bgBlur,
        bgBrightness: state.bgBrightness,
        bgScale: state.bgScale,
        cardIndex: state.cardIndex,
      }),
    },
  ),
);
