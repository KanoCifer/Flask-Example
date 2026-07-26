<script setup lang="ts">
// OKLCH 三分量滑杆 + hex 输入 + 一组预设按钮。
//
// 滑杆直接绑 useOklch 的 ref；hex 失焦或回车后反算 L/C/H。
// 预设取自 4 个 scheme 的 --accent 解析值，用于把当前主题的强调色拉进工具。
import { computed, ref, watch } from 'vue';
import { COLOR_SCHEMES, type ColorScheme } from '@/stores';
import {
  oklchToRgb,
  parseOklch,
  rgbToHex,
  type Oklch,
} from '../composables/useOklch';
import type { UseOklchReturn } from '../composables/useOklch';

const props = defineProps<{
  state: UseOklchReturn;
}>();

const { L, C, H, setFromHex, setOklch } = props.state;

// ---------- sliders ----------
const L_PCT = computed({
  get: () => Math.round(L.value * 100),
  set: (v: number) => {
    L.value = Math.max(0, Math.min(1, v / 100));
  },
});
const C_NUM = computed({
  get: () => Number(C.value.toFixed(3)),
  set: (v: number) => {
    C.value = Math.max(0, Math.min(0.4, v));
  },
});
const H_NUM = computed({
  get: () => Number(H.value.toFixed(1)),
  set: (v: number) => {
    H.value = ((v % 360) + 360) % 360;
  },
});

const sliders = computed(() => [
  {
    key: 'L' as const,
    label: 'L · 亮度',
    min: 0,
    max: 100,
    step: 1,
    model: L_PCT,
    suffix: '%',
    hint: '0 黑 ↔ 1 白',
  },
  {
    key: 'C' as const,
    label: 'C · 饱和度',
    min: 0,
    max: 0.4,
    step: 0.005,
    model: C_NUM,
    suffix: '',
    hint: '越大越鲜艳，>0.4 多数 hue 已超 sRGB',
  },
  {
    key: 'H' as const,
    label: 'H · 色相',
    min: 0,
    max: 360,
    step: 1,
    model: H_NUM,
    suffix: '°',
    hint: '0 红 / 120 绿 / 240 蓝',
  },
]);

// ---------- hex input ----------
const hexDraft = ref(props.state.hex.value);
const hexError = ref<string | null>(null);

watch(
  () => props.state.hex.value,
  (next) => {
    hexDraft.value = next;
  },
);

function commitHex() {
  const ok = setFromHex(hexDraft.value);
  if (!ok) {
    hexError.value = '请输入 6 位 hex（#rrggbb 或 #rgb）';
  } else {
    hexError.value = null;
  }
}

function onHexKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault();
    commitHex();
    (e.target as HTMLInputElement).blur();
  }
}

// ---------- presets ----------
// 取 4 个 scheme 的 --accent 解析值，转成 OKLCH 作为预设。
// 用 ref 数组保存，scheme 切换或主题变化时重算。
interface PresetItem {
  scheme: ColorScheme;
  label: string;
  oklch: Oklch;
  hex: string;
}

const presets = ref<PresetItem[]>([]);

function computePresets() {
  if (typeof document === 'undefined') return;
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.position = 'absolute';
  probe.style.left = '-9999px';
  probe.style.top = '0';
  probe.style.width = '1px';
  probe.style.height = '1px';
  probe.style.pointerEvents = 'none';
  document.body.appendChild(probe);

  try {
    const next: PresetItem[] = [];
    for (const scheme of COLOR_SCHEMES) {
      // 浅色态值
      probe.setAttribute('data-color-scheme', scheme);
      probe.classList.remove('dark');
      const raw = window
        .getComputedStyle(probe)
        .getPropertyValue('--accent')
        .trim();
      const oklch = parseOklch(`oklch(${raw})`);
      if (!oklch) continue;
      // 同步给出 hex 预览（基于显示 sRGB，可能裁剪 C）
      const { r, g, b } = oklchToRgb(oklch);
      next.push({
        scheme,
        label: scheme,
        oklch,
        hex: rgbToHex({ r, g, b }),
      });
    }
    presets.value = next;
  } finally {
    probe.remove();
  }
}

// 在 mount 后取一次；scheme/theme 变化时由监听触发
let observer: MutationObserver | null = null;
if (typeof window !== 'undefined') {
  // 初始取一次
  queueMicrotask(computePresets);
  observer = new MutationObserver(() => computePresets());
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-color-scheme'],
  });
}

function applyPreset(preset: PresetItem) {
  setOklch(preset.oklch);
}

defineOptions({
  name: 'OklchControls',
});
</script>

<template>
  <div
    class="bg-card/70 text-ink space-y-6 rounded-xl border p-5 shadow-sm backdrop-blur"
  >
    <div>
      <h3 class="text-ink text-sm font-semibold tracking-wider uppercase">
        Controls · 调节
      </h3>
      <p class="text-muted mt-1 text-xs leading-relaxed">
        拖动滑杆或在 hex 输入框粘贴颜色，右侧预览实时更新。
      </p>
    </div>

    <!-- sliders -->
    <div class="space-y-4">
      <div v-for="s in sliders" :key="s.key" class="space-y-1.5">
        <div class="flex items-baseline justify-between gap-2">
          <label
            :for="`oklch-${s.key}`"
            class="text-ink text-xs font-semibold tracking-wider uppercase"
          >
            {{ s.label }}
          </label>
          <span class="text-muted font-mono text-xs tabular-nums">
            {{ s.model.value }}{{ s.suffix }}
          </span>
        </div>
        <input
          :id="`oklch-${s.key}`"
          type="range"
          :min="s.min"
          :max="s.max"
          :step="s.step"
          v-model.number="s.model.value"
          class="border-input bg-secondary/30 ring-ring/30 [&::-webkit-slider-thumb]:border-accent [&::-webkit-slider-thumb]:bg-on-accent [&::-moz-range-thumb]:border-accent [&::-moz-range-thumb]:bg-on-accent h-1.5 w-full cursor-pointer appearance-none rounded-full outline-none focus-visible:ring-2 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:shadow-sm [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:hover:ring-4 [&::-webkit-slider-thumb]:focus-visible:ring-4"
        />
        <p class="text-muted/80 text-[11px] leading-tight">{{ s.hint }}</p>
      </div>
    </div>

    <!-- hex input -->
    <div class="space-y-1.5">
      <label
        for="oklch-hex"
        class="text-ink text-xs font-semibold tracking-wider uppercase"
      >
        Hex · 输入
      </label>
      <div class="flex gap-2">
        <input
          id="oklch-hex"
          v-model="hexDraft"
          type="text"
          spellcheck="false"
          autocomplete="off"
          placeholder="#rrggbb"
          :aria-invalid="hexError ? 'true' : 'false'"
          :aria-describedby="hexError ? 'oklch-hex-error' : undefined"
          class="border-input bg-secondary/30 text-ink placeholder:text-muted/60 focus:border-ring focus:ring-ring/40 flex-1 rounded-md border px-3 py-1.5 font-mono text-sm outline-none focus:ring-2"
          @blur="commitHex"
          @keydown="onHexKeydown"
        />
        <button
          type="button"
          class="bg-accent text-on-accent hover:bg-accent/90 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
          @click="commitHex"
        >
          应用
        </button>
      </div>
      <p
        v-if="hexError"
        id="oklch-hex-error"
        class="text-destructive text-[11px] leading-tight"
      >
        {{ hexError }}
      </p>
      <p v-else class="text-muted/80 text-[11px] leading-tight">
        回车或失焦自动反算 L/C/H
      </p>
    </div>

    <!-- presets -->
    <div class="space-y-1.5">
      <div class="text-ink text-xs font-semibold tracking-wider uppercase">
        Presets · 来自主题
      </div>
      <p class="text-muted/80 text-[11px] leading-tight">
        4 个 scheme 的 <code>--accent</code> 解析值，浅色态快照。
      </p>
      <div class="grid grid-cols-2 gap-2 pt-1">
        <button
          v-for="p in presets"
          :key="p.scheme"
          type="button"
          class="bg-card/40 hover:bg-card/70 group flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition-colors"
          :title="`应用 ${p.scheme} 主题的 --accent`"
          @click="applyPreset(p)"
        >
          <span
            class="/60 h-5 w-5 shrink-0 rounded border shadow-inner"
            :style="{ background: p.hex }"
            aria-hidden="true"
          />
          <span class="min-w-0 flex-1">
            <span
              class="text-ink block truncate text-xs font-semibold capitalize"
              >{{ p.scheme }}</span
            >
            <span
              class="text-muted block truncate font-mono text-[10px] leading-tight"
              >{{ p.hex }}</span
            >
          </span>
        </button>
      </div>
    </div>
  </div>
</template>
