import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import Emerald from '@/assets/Emerald.svg';
import IridescentCloud from '@/assets/Iridescent cloud.svg';
import Lagoon from '@/assets/Lagoon.svg';

export type BackgroundMode = 'fixed' | 'random';

export interface BackgroundOption {
  /** 唯一标识 */
  id: string;
  /** 显示名 */
  name: string;
  /** SVG 图片 URL */
  url: string;
}

/** 背景图定义 —— 三个 SVG 背景图 */
export const BACKGROUNDS: BackgroundOption[] = [
  { id: 'emerald', name: 'Emerald', url: Emerald },
  { id: 'iridescent', name: 'Iridescent Cloud', url: IridescentCloud },
  { id: 'lagoon', name: 'Lagoon', url: Lagoon },
];

export const useBackgroundStore = defineStore('background', () => {
  const mode = ref<BackgroundMode>(
    (localStorage.getItem('readinglist_bg_mode') as BackgroundMode) || 'fixed',
  );

  const fixedIndex = ref<number>(
    (() => {
      const stored = localStorage.getItem('readinglist_bg_index');
      const n = stored ? Number.parseInt(stored, 10) : NaN;
      return Number.isFinite(n) && n >= 0 && n < BACKGROUNDS.length ? n : 0;
    })(),
  );

  const randomIndex = ref<number>(
    Math.floor(Math.random() * BACKGROUNDS.length),
  );

  const effectiveIndex = computed(() =>
    mode.value === 'random' ? randomIndex.value : fixedIndex.value,
  );

  /** 当前生效的背景图样式 */
  const backgroundStyle = computed(() => ({
    backgroundImage: `url(${BACKGROUNDS[effectiveIndex.value].url})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  }));

  const selectFixed = (index: number) => {
    fixedIndex.value = index;
    mode.value = 'fixed';
    localStorage.setItem('readinglist_bg_index', String(index));
    localStorage.setItem('readinglist_bg_mode', 'fixed');
  };

  const randomize = () => {
    randomIndex.value = Math.floor(Math.random() * BACKGROUNDS.length);
    mode.value = 'random';
    localStorage.setItem('readinglist_bg_mode', 'random');
  };

  const reroll = () => {
    if (mode.value === 'random') {
      randomIndex.value = Math.floor(Math.random() * BACKGROUNDS.length);
    }
  };

  const autoSwitchInterval = ref<number>(
    Number(localStorage.getItem('bg-auto-switch') || 0),
  );

  let autoSwitchTimer: ReturnType<typeof setInterval> | null = null;

  const startAutoSwitch = () => {
    if (autoSwitchTimer) {
      clearInterval(autoSwitchTimer);
      autoSwitchTimer = null;
    }
    if (mode.value === 'random' && autoSwitchInterval.value > 0) {
      autoSwitchTimer = setInterval(() => {
        randomIndex.value = Math.floor(Math.random() * BACKGROUNDS.length);
      }, autoSwitchInterval.value * 1000);
    }
  };

  const saveAutoSwitch = (seconds: number) => {
    autoSwitchInterval.value = seconds;
    localStorage.setItem('bg-auto-switch', String(seconds));
  };

  watch([mode, autoSwitchInterval], startAutoSwitch, { immediate: true });

  const handleVisibilityChange = () => {
    if (document.hidden) {
      if (autoSwitchTimer) {
        clearInterval(autoSwitchTimer);
        autoSwitchTimer = null;
      }
    } else {
      startAutoSwitch();
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

  return {
    backgrounds: BACKGROUNDS,
    mode,
    fixedIndex,
    randomIndex,
    effectiveIndex,
    backgroundStyle,
    selectFixed,
    randomize,
    reroll,
    autoSwitchInterval,
    saveAutoSwitch,
  };
});
