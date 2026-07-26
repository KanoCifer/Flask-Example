<script setup lang="ts">
import { useThemeStore, type Theme, type ColorScheme } from '@/stores';
import { Laptop, Moon, Sun } from '@lucide/vue';
import type { Component } from 'vue';

const themeStore = useThemeStore();

const selectTheme = (theme: Theme, event: MouseEvent) => {
  themeStore.setThemeWithAnimation(event, theme);
};

const themes: { value: Theme; label: string; icon: Component }[] = [
  {
    value: 'system',
    label: '系统',
    icon: Laptop,
  },
  {
    value: 'light',
    label: '浅色',
    icon: Sun,
  },
  {
    value: 'dark',
    label: '深色',
    icon: Moon,
  },
];

const schemes: {
  value: ColorScheme;
  label: string;
  colors: string[];
  desc: string;
}[] = [
  {
    value: 'paper',
    label: 'Paper · 纸',
    colors: [
      'oklch(0.5 0.08 50)',
      'oklch(0.97 0.013 50)',
      'oklch(0.92 0.022 50)',
    ],
    desc: '落纸烟云 · 3 色',
  },
  {
    value: 'sage',
    label: 'Sage',
    colors: [
      'oklch(0.5 0.08 145)',
      'oklch(0.97 0.013 145)',
      'oklch(0.92 0.022 145)',
    ],
    desc: '清隽素雅 · 3 色',
  },
  {
    value: 'mist',
    label: 'Mist',
    colors: [
      'oklch(0.5 0.06 225)',
      'oklch(0.97 0.01 225)',
      'oklch(0.92 0.018 225)',
    ],
    desc: '烟岚氤氲 · 3 色',
  },
  {
    value: 'blush',
    label: 'Blush',
    colors: [
      'oklch(0.55 0.09 355)',
      'oklch(0.97 0.013 355)',
      'oklch(0.92 0.022 355)',
    ],
    desc: '桃夭未央 · 3 色',
  },
];

/*
 * 共享卡片 class：border-2 → border、rounded-md → rounded-xl、
 * active 态用 shadow-sm 给出高度差而非加粗边框。
 * !shadow-sm 覆盖全局 :where([class~='border']) 硬阴影。
 */
const cardBase =
  'flex w-full cursor-pointer items-stretch overflow-hidden rounded-xl border transition-colors';
const cardDefault = ' bg-page hover:border-accent';
const cardActive = 'border-accent bg-accent/5 !shadow-sm';

const smallCardBase =
  'flex flex-col items-center gap-2 rounded-xl border p-3 transition-colors';
</script>

<template>
  <div class="space-y-6">
    <!-- 页面元素 -->
    <div>
      <h2 class="text-ink mb-1 font-serif text-lg font-semibold">页面元素</h2>
      <p class="text-muted mb-4 text-xs italic">Display the page footer</p>

      <button
        @click="themeStore.toggleFooter()"
        class="bg-page hover:border-accent flex w-full cursor-pointer items-center justify-between rounded-xl border px-4 py-3 transition-colors"
      >
        <div class="text-left">
          <div class="text-ink text-sm font-medium">显示页脚</div>
          <div class="text-muted mt-0.5 text-xs">Show footer on every page</div>
        </div>
        <div
          class="h-6 w-11 rounded-full p-0.5 transition-colors"
          :class="themeStore.showFooter === 'true' ? 'bg-accent' : 'bg-surface'"
        >
          <div
            class="bg-page h-5 w-5 rounded-full shadow-md transition-transform"
            :class="
              themeStore.showFooter === 'true'
                ? 'translate-x-5'
                : 'translate-x-0'
            "
          />
        </div>
      </button>
    </div>

    <!-- 主题模式 -->
    <div>
      <h2 class="text-ink mb-1 font-serif text-lg font-semibold">主题模式</h2>
      <p class="text-muted mb-4 text-xs italic">Theme mode</p>

      <div class="grid grid-cols-3 gap-3">
        <button
          v-for="theme in themes"
          :key="theme.value"
          @click="selectTheme(theme.value as Theme, $event)"
          :class="[
            smallCardBase,
            themeStore.theme === theme.value
              ? cardActive
              : 'bg-page hover:border-accent',
          ]"
        >
          <component
            :is="theme.icon"
            :class="themeStore.theme === theme.value ? 'text-ink' : 'text-ink'"
          />
          <span
            class="text-xs"
            :class="
              themeStore.theme === theme.value
                ? 'text-ink font-semibold'
                : 'text-ink'
            "
          >
            {{ theme.label }}
          </span>
        </button>
      </div>
    </div>

    <!-- 字体 -->
    <div>
      <h2 class="text-ink mb-1 font-serif text-lg font-semibold">字体</h2>
      <p class="text-muted mb-4 text-xs italic">Reading font</p>

      <div class="grid grid-cols-2 gap-3">
        <button
          @click="themeStore.applyFont('default')"
          :class="[
            smallCardBase,
            themeStore.font === 'default'
              ? cardActive
              : 'bg-page hover:border-accent',
          ]"
        >
          <span
            class="text-sm font-semibold"
            :class="themeStore.font === 'default' ? 'text-ink' : 'text-ink'"
          >
            默认字体
          </span>
          <span class="text-muted font-mono text-[10px]"> PingFang SC </span>
        </button>
        <button
          @click="themeStore.applyFont('harmonyos')"
          :class="[
            smallCardBase,
            themeStore.font === 'harmonyos'
              ? cardActive
              : 'bg-page hover:border-accent',
          ]"
        >
          <span
            class="text-sm font-semibold"
            :class="themeStore.font === 'harmonyos' ? 'text-ink' : 'text-ink'"
            style="font-family: 'Noto Sans SC', sans-serif; font-weight: 500"
          >
            HarmonyOS Sans
          </span>
          <span class="text-muted font-mono text-[10px]">鸿蒙字体</span>
        </button>
      </div>
    </div>

    <!-- 配色方案 -->
    <div>
      <h2 class="text-ink mb-1 font-serif text-lg font-semibold">配色方案</h2>
      <p class="text-muted mb-4 text-xs italic">Color scheme · 四种调性</p>

      <div class="space-y-2">
        <button
          v-for="scheme in schemes"
          :key="scheme.value"
          @click="themeStore.setScheme(scheme.value)"
          :class="[
            cardBase,
            themeStore.scheme === scheme.value ? cardActive : cardDefault,
          ]"
        >
          <div
            v-if="scheme.colors.length > 1"
            class="flex w-[72px] flex-col overflow-hidden"
          >
            <div
              v-for="(color, i) in scheme.colors"
              :key="i"
              class="flex-1"
              :style="{ backgroundColor: color }"
            />
          </div>
          <div
            v-else
            class="w-[72px]"
            :style="{
              background: `linear-gradient(180deg, ${scheme.colors[0]} 0%, ${scheme.colors[0]}cc 100%)`,
            }"
          />
          <div class="flex-1 px-4 py-3 text-left">
            <div class="text-ink text-sm font-semibold">
              {{ scheme.label }}
            </div>
            <div class="text-muted mt-0.5 text-[11px] italic">
              {{ scheme.desc }}
            </div>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>
