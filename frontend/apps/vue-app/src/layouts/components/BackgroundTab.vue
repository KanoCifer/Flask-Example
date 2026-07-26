<script setup lang="ts">
import { useBackgroundStore } from '@/stores';
import { useThemeStore } from '@/stores';
import ImageGrid from './ImageGrid.vue';
import { computed, onBeforeUnmount } from 'vue';

const themeStore = useThemeStore();
const backgroundStore = useBackgroundStore();

// Debounced localStorage writes: update reactive ref immediately for live preview,
// but batch localStorage writes to avoid blocking main thread on every slider pixel.
const debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};
const debouncedSet = (key: string, value: string, ms = 150) => {
  if (debounceTimers[key]) clearTimeout(debounceTimers[key]);
  debounceTimers[key] = setTimeout(() => {
    localStorage.setItem(key, value);
    delete debounceTimers[key];
  }, ms);
};

const onInputBlur = (e: Event) => {
  const val = Number((e.target as HTMLInputElement).value);
  themeStore.bgBlur = val;
  debouncedSet('bg-blur', String(val));
};

const onInputBrightness = (e: Event) => {
  const val = Number((e.target as HTMLInputElement).value) / 100;
  themeStore.bgBrightness = val;
  debouncedSet('bg-brightness', String(val));
};

const onInputScale = (e: Event) => {
  const val = Number((e.target as HTMLInputElement).value) / 100;
  themeStore.bgScale = val;
  debouncedSet('bg-scale', String(val));
};

/*
 * 滑块填充百分比（0–100）— 驱动 CSS 渐变实现"已填充段"。
 * 语义令牌 via color‑mix，跟随主题。
 */
const fillPct = (val: number, min: number, max: number) =>
  `${((val - min) / (max - min)) * 100}%`;

const sliderFill = (val: number, min: number, max: number) =>
  `linear-gradient(to right, var(--accent) 0%, var(--accent) ${fillPct(val, min, max)}, var(--secondary) ${fillPct(val, min, max)}, var(--secondary) 100%)`;

/*
 * 重置背景参数到默认值。
 * blur=0, brightness=1.0, scale=1.05 — 与 theme store 初始一致。
 */
const BG_DEFAULTS = { blur: 0, brightness: 1.0, scale: 1.05 } as const;
const resetBackground = () => {
  themeStore.bgBlur = BG_DEFAULTS.blur;
  themeStore.bgBrightness = BG_DEFAULTS.brightness;
  themeStore.bgScale = BG_DEFAULTS.scale;
  debouncedSet('bg-blur', String(BG_DEFAULTS.blur));
  debouncedSet('bg-brightness', String(BG_DEFAULTS.brightness));
  debouncedSet('bg-scale', String(BG_DEFAULTS.scale));
};

const blurFill = computed(() => sliderFill(themeStore.bgBlur, 5, 70));
const brightnessFill = computed(() =>
  sliderFill(Math.round(themeStore.bgBrightness * 100), 30, 100),
);
const scaleFill = computed(() =>
  sliderFill(Math.round(themeStore.bgScale * 100), 100, 130),
);

onBeforeUnmount(() => {
  Object.values(debounceTimers).forEach(clearTimeout);
});

const autoSwitchOptions = [
  { label: '关闭', value: 0 },
  { label: '10s', value: 10 },
  { label: '30s', value: 30 },
  { label: '60s', value: 60 },
  { label: '120s', value: 120 },
];

/*
 * 共享卡片 class：与 AppearanceTab 保持一致的小卡片样式。
 * !shadow-sm 覆盖全局 :where([class~='border']) 硬阴影,给出 active 高度。
 */
const smallCardBase =
  'flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors';
const smallCardDefault = ' bg-page hover:border-accent';
const smallCardActive = 'border-accent bg-accent/5 !shadow-sm';
</script>

<template>
  <div class="space-y-6">
    <!-- 滑块组 — 统一卡式外观，跟随切换 -->
    <div>
      <h2 class="text-ink mb-1 font-serif text-lg font-semibold">背景调整</h2>
      <p class="text-muted mb-4 text-xs italic">Adjust background appearance</p>

      <div class="/60 bg-page rounded-xl border p-5">
        <!-- 滑块行 -->
        <div class="relative space-y-5">
          <!-- 背景模糊 -->
          <div>
            <div class="mb-2 flex items-center justify-between">
              <span
                class="text-ink flex items-center gap-1.5 text-sm font-medium"
              >
                <!-- 模糊图标 -->
                <svg
                  class="text-muted h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2a15 15 0 0 1 0 20" opacity="0.4" />
                  <path d="M12 2a15 15 0 0 0 0 20" opacity="0.4" />
                </svg>
                背景模糊
              </span>
              <span
                class="bg-surface text-ink rounded-full px-2 py-0.5 font-mono text-xs font-medium tabular-nums"
              >
                {{ themeStore.bgBlur }} px
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="70"
              step="1"
              :value="themeStore.bgBlur"
              @input="onInputBlur"
              class="slider w-full cursor-pointer"
              :style="{ '--track-fill': blurFill }"
            />
          </div>

          <!-- 背景亮度 -->
          <div>
            <div class="mb-2 flex items-center justify-between">
              <span
                class="text-ink flex items-center gap-1.5 text-sm font-medium"
              >
                <!-- 亮度图标 -->
                <svg
                  class="text-muted h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="12" cy="12" r="4" />
                  <path
                    d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
                  />
                </svg>
                背景亮度
              </span>
              <span
                class="bg-surface text-ink rounded-full px-2 py-0.5 font-mono text-xs font-medium tabular-nums"
              >
                {{ Math.round(themeStore.bgBrightness * 100) }} %
              </span>
            </div>
            <input
              type="range"
              min="30"
              max="100"
              step="5"
              :value="Math.round(themeStore.bgBrightness * 100)"
              @input="onInputBrightness"
              class="slider w-full cursor-pointer"
              :style="{ '--track-fill': brightnessFill }"
            />
          </div>

          <!-- 背景缩放 -->
          <div>
            <div class="mb-2 flex items-center justify-between">
              <span
                class="text-ink flex items-center gap-1.5 text-sm font-medium"
              >
                <!-- 缩放图标 -->
                <svg
                  class="text-muted h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                </svg>
                背景缩放
              </span>
              <span
                class="bg-surface text-ink rounded-full px-2 py-0.5 font-mono text-xs font-medium tabular-nums"
              >
                {{ Math.round(themeStore.bgScale * 100) }} %
              </span>
            </div>
            <input
              type="range"
              min="100"
              max="130"
              step="1"
              :value="Math.round(themeStore.bgScale * 100)"
              @input="onInputScale"
              class="slider w-full cursor-pointer"
              :style="{ '--track-fill': scaleFill }"
            />
          </div>
        </div>
      </div>

      <!-- 重置为默认 -->
      <button
        @click="resetBackground"
        class="text-muted hover:text-ink hover:bg-surface mt-3 flex w-full items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
      >
        <svg
          class="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
          <path d="M3 3v5h5" />
        </svg>
        重置为默认
      </button>
    </div>

    <!-- 背景模式 -->
    <div>
      <h2 class="text-ink mb-1 font-serif text-lg font-semibold">背景模式</h2>
      <p class="text-muted mb-4 text-xs italic">Background mode</p>

      <div class="grid grid-cols-2 gap-3">
        <button
          @click="backgroundStore.randomize()"
          :class="[
            smallCardBase,
            backgroundStore.mode === 'random'
              ? smallCardActive
              : smallCardDefault,
          ]"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            :class="backgroundStore.mode === 'random' ? 'text-ink' : 'text-ink'"
          >
            <polyline points="16 3 21 3 21 8" />
            <line x1="4" y1="20" x2="21" y2="3" />
            <polyline points="21 16 21 21 16 21" />
            <line x1="15" y1="15" x2="21" y2="21" />
            <line x1="4" y1="4" x2="9" y2="9" />
          </svg>
          <span
            class="text-sm font-medium"
            :class="backgroundStore.mode === 'random' ? 'text-ink' : 'text-ink'"
          >
            随机切换
          </span>
        </button>
        <button
          @click="backgroundStore.mode = 'fixed'"
          :class="[
            smallCardBase,
            backgroundStore.mode === 'fixed'
              ? smallCardActive
              : smallCardDefault,
          ]"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            :class="backgroundStore.mode === 'fixed' ? 'text-ink' : 'text-ink'"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <span
            class="text-sm font-medium"
            :class="backgroundStore.mode === 'fixed' ? 'text-ink' : 'text-ink'"
          >
            固定背景
          </span>
        </button>
      </div>
    </div>

    <!-- 自动切换间隔（仅 random 模式） -->
    <div v-if="backgroundStore.mode === 'random'">
      <h2 class="text-ink mb-1 font-serif text-lg font-semibold">自动切换</h2>
      <p class="text-muted mb-4 text-xs italic">Auto-switch interval</p>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="opt in autoSwitchOptions"
          :key="opt.value"
          @click="backgroundStore.saveAutoSwitch(opt.value)"
          class="rounded-lg border px-3.5 py-1.5 text-sm transition-colors"
          :class="
            backgroundStore.autoSwitchInterval === opt.value
              ? 'border-accent bg-accent/5 text-ink font-medium !shadow-sm'
              : 'bg-page text-ink hover:border-accent'
          "
        >
          {{ opt.label }}
        </button>
      </div>
    </div>

    <!-- 固定背景选择（仅 fixed 模式） -->
    <div v-if="backgroundStore.mode === 'fixed'">
      <h2 class="text-ink mb-1 font-serif text-lg font-semibold">选择背景</h2>
      <p class="text-muted mb-4 text-xs italic">Choose a fixed background</p>
      <ImageGrid
        :images="backgroundStore.backgrounds"
        :selected="backgroundStore.fixedIndex"
        @select="backgroundStore.selectFixed($event)"
      />
    </div>
  </div>
</template>

<style scoped>
/*
 * 自定义滑块样式。
 * 用 `--track-fill` 行内属性驱动渐变填充"已取值段"，
 * 跟随主题 — track 基色 = var(--secondary), fill 色 = var(--accent)。
 */

/* ---- reset ---- */
.slider {
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  height: 24px;
}

/* ---- Webkit track (Chrome / Safari / Edge) ---- */
.slider::-webkit-slider-runnable-track {
  height: 6px;
  border-radius: 9999px;
  background: var(--track-fill);
}

/* ---- Webkit thumb ---- */
.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  margin-top: -6px;
  border-radius: 9999px;
  background: var(--page);
  border: 2px solid var(--accent);
  box-shadow:
    0 1px 2px color-mix(in oklch, var(--ink) 12%, transparent),
    0 0 0 0 color-mix(in oklch, var(--accent) 0%, transparent);
  transition:
    box-shadow 150ms ease-out,
    transform 150ms ease-out;
  cursor: pointer;
}

.slider::-webkit-slider-thumb:hover {
  transform: scale(1.12);
  box-shadow:
    0 2px 6px color-mix(in oklch, var(--ink) 16%, transparent),
    0 0 0 4px color-mix(in oklch, var(--accent) 15%, transparent);
}

.slider::-webkit-slider-thumb:active {
  transform: scale(1.05);
}

/* ---- Firefox track ---- */
.slider::-moz-range-track {
  height: 6px;
  border-radius: 9999px;
  background: var(--track-fill);
}

/* ---- Firefox thumb ---- */
.slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 9999px;
  background: var(--page);
  border: 2px solid var(--accent);
  box-shadow: 0 1px 2px color-mix(in oklch, var(--ink) 12%, transparent);
  transition:
    box-shadow 150ms ease-out,
    transform 150ms ease-out;
  cursor: pointer;
}

.slider::-moz-range-thumb:hover {
  transform: scale(1.12);
  box-shadow:
    0 2px 6px color-mix(in oklch, var(--ink) 16%, transparent),
    0 0 0 4px color-mix(in oklch, var(--accent) 15%, transparent);
}

/* ---- Focus ring ---- */
.slider:focus-visible {
  outline: none;
}

.slider:focus-visible::-webkit-slider-thumb {
  box-shadow:
    0 2px 6px color-mix(in oklch, var(--ink) 16%, transparent),
    0 0 0 4px color-mix(in oklch, var(--accent) 30%, transparent);
}

.slider:focus-visible::-moz-range-thumb {
  box-shadow:
    0 2px 6px color-mix(in oklch, var(--ink) 16%, transparent),
    0 0 0 4px color-mix(in oklch, var(--accent) 30%, transparent);
}
</style>
