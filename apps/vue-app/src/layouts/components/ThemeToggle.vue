<script setup lang="ts">
import { DropdownTransition } from '@/components';
import { useThemeStore, type Theme, type ColorScheme } from '@/stores';
import { computed, onMounted, onUnmounted, ref } from 'vue';

const themeStore = useThemeStore();
const isOpen = ref(false);
const isSchemeOpen = ref(false);
const dropdownRef = ref<HTMLElement | null>(null);

const themes: { value: Theme; label: string; icon: string }[] = [
  {
    value: 'system',
    label: 'System',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  },
  {
    value: 'light',
    label: 'Light',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
  },
];

const schemes: { value: ColorScheme; label: string; colors: string[] }[] = [
  { value: 'paper', label: 'Paper', colors: ['#a87649', '#7a8e6b', '#5a6b7a'] },
  { value: 'sage', label: 'Sage', colors: ['#6e8d6e', '#a89968', '#7d8a9b'] },
  { value: 'mist', label: 'Mist', colors: ['#6c8aa4', '#7d9d8a', '#b09878'] },
  { value: 'blush', label: 'Blush', colors: ['#a87180', '#7d9080', '#8a7474'] },
];

const currentTheme = computed(
  (): { value: Theme; label: string; icon: string } => {
    const found = themes.find((t) => t.value === themeStore.theme);
    return found || themes[0]!;
  },
);

let closeTimeout: ReturnType<typeof setTimeout> | null = null;

const toggleDropdown = () => {
  isOpen.value = !isOpen.value;
};

const openDropdown = () => {
  if (closeTimeout) {
    clearTimeout(closeTimeout);
    closeTimeout = null;
  }
  isOpen.value = true;
};

const closeDropdown = () => {
  closeTimeout = setTimeout(() => {
    isOpen.value = false;
  }, 150);
};

const selectTheme = (theme: Theme, event: MouseEvent) => {
  themeStore.setThemeWithAnimation(event, theme);
  isOpen.value = false;
};

const selectScheme = (newScheme: ColorScheme) => {
  themeStore.setScheme(newScheme);
  isSchemeOpen.value = false;
};

const handleClickOutside = (event: MouseEvent) => {
  if (dropdownRef.value && dropdownRef.value.contains(event.target as Node)) {
    return;
  }
  isOpen.value = false;
  isSchemeOpen.value = false;
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <div ref="dropdownRef" class="flex items-center gap-1">
    <!-- Color Scheme Selector -->
    <div class="relative">
      <button
        @click.stop="isSchemeOpen = !isSchemeOpen"
        class="text-ink hover:bg-surface focus:ring-ring dark:text-ink dark:hover:bg-surface flex cursor-pointer items-center gap-1 rounded-lg px-2 py-2 text-sm font-medium transition-all focus:ring-2 focus:outline-none"
        aria-label="Select color scheme"
        title="Color Scheme"
      >
        <div class="flex gap-0.5">
          <span
            v-for="(color, i) in schemes.find(
              (s) => s.value === themeStore.scheme,
            )?.colors || []"
            :key="i"
            class="h-3 w-3 rounded-full"
            :style="{ backgroundColor: color }"
          ></span>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="transition-transform duration-200"
          :class="{ 'rotate-180': isSchemeOpen }"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      <DropdownTransition>
        <div
          v-if="isSchemeOpen"
          class="bg-page dark: dark:bg-page absolute top-full right-0 z-9999 mt-2 w-40 rounded-lg shadow-lg"
          @click.stop
        >
          <button
            v-for="(schemeItem, index) in schemes"
            :key="schemeItem.value"
            @click="selectScheme(schemeItem.value)"
            class="text-ink hover:bg-surface dark:text-ink dark:hover:bg-surface flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-sm transition-colors"
            :class="{
              'bg-surface dark:bg-surface':
                themeStore.scheme === schemeItem.value,
              'rounded-t-lg': index === 0,
              'rounded-b-lg': index === schemes.length - 1,
            }"
          >
            <div class="flex gap-0.5">
              <span
                v-for="(color, i) in schemeItem.colors"
                :key="i"
                class="h-3.5 w-3.5 rounded-full"
                :style="{ backgroundColor: color }"
              ></span>
            </div>
            <span>{{ schemeItem.label }}</span>
            <svg
              v-if="themeStore.scheme === schemeItem.value"
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="text-ink ml-auto"
            >
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </button>
        </div>
      </DropdownTransition>
    </div>

    <!-- Light/Dark Mode Toggle -->
    <div
      class="relative"
      @mouseenter="openDropdown"
      @mouseleave="closeDropdown"
    >
      <button
        @click.stop="toggleDropdown"
        class="text-ink hover:bg-surface focus:ring-ring dark:text-ink dark:hover:bg-surface flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all focus:ring-2 focus:outline-none"
        aria-label="Toggle theme"
      >
        <span v-html="currentTheme.icon"></span>
        <span class="hidden sm:inline">{{ currentTheme.label }}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="transition-transform duration-200"
          :class="{ 'rotate-180': isOpen }"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      <DropdownTransition>
        <div
          v-if="isOpen"
          class="bg-page dark: dark:bg-page absolute top-full right-0 z-9999 mt-2 w-36 rounded-lg shadow-lg"
          @click.stop
        >
          <button
            v-for="(theme, index) in themes"
            :key="theme.value"
            @click="selectTheme(theme.value, $event)"
            class="text-ink hover:bg-surface dark:text-ink dark:hover:bg-surface flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-sm transition-colors"
            :class="{
              'bg-surface dark:bg-surface': themeStore.theme === theme.value,
              'rounded-t-lg': index === 0,
              'rounded-b-lg': index === themes.length - 1,
            }"
          >
            <span v-html="theme.icon"></span>
            <span>{{ theme.label }}</span>
            <svg
              v-if="themeStore.theme === theme.value"
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="text-ink ml-auto"
            >
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </button>
        </div>
      </DropdownTransition>
    </div>
  </div>
</template>
