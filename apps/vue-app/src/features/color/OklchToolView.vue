<script setup lang="ts">
// OKLCH 色彩预览 / 生成器 —— 在页面内拖 L/C/H、看 hex、试主题对比度、生成和谐配色。
//
// 设计要点：
// - 顶部 hero 跟随全局 scheme（与 ColorShowcaseView 一致）
// - 主体 2 列：左 controls，右 preview；下方放对比矩阵、和谐、网格
// - 主题切换器复用 ColorShowcaseView 的形态
// - 初始 OKLCH 取自当前 scheme 的 --accent
import { computed, onMounted, ref } from 'vue';
import { useHead } from '@vueuse/head';
import { COLOR_SCHEMES, useThemeStore, type ColorScheme } from '@/stores';
import { useOklch, type Rgb } from './composables/useOklch';
import OklchControls from './components/OklchControls.vue';
import OklchPreviewCard from './components/OklchPreviewCard.vue';
import OklchContrastMatrix from './components/OklchContrastMatrix.vue';
import OklchHarmonyPalette from './components/OklchHarmonyPalette.vue';
import OklchLightnessChromaMap from './components/OklchLightnessChromaMap.vue';

useHead({
  title: 'OKLCH 工具 — Kuroome Blog',
  meta: [
    {
      name: 'description',
      content:
        'OKLCH 颜色预览 / 生成器：实时调 L/C/H、对比度测试、和谐配色与亮饱网格。',
    },
  ],
});

const themeStore = useThemeStore();

const state = useOklch({ initial: { L: 0.65, C: 0.16, H: 250 } });

// 当前 scheme 的 --page 与 --accent 解析值：
// - paper 作为默认对比端
// - accent 作为初始主色
const activeScheme = computed<ColorScheme>(() => themeStore.scheme);
const paperRgb = ref<Rgb | null>(null);

onMounted(() => {
  const probe = document.createElement('div');
  probe.setAttribute('data-color-scheme', activeScheme.value);
  probe.classList.remove('dark');
  probe.style.position = 'absolute';
  probe.style.left = '-9999px';
  probe.style.width = '1px';
  probe.style.height = '1px';
  probe.style.pointerEvents = 'none';
  document.body.appendChild(probe);

  const readRgb = (token: string): Rgb => {
    const raw = window.getComputedStyle(probe).getPropertyValue(token).trim();
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return { r: 255, g: 255, b: 255 };
    ctx.fillStyle = '#000';
    try {
      ctx.fillStyle = raw;
    } catch {
      return { r: 255, g: 255, b: 255 };
    }
    const out = ctx.fillStyle as string;
    if (!out.startsWith('#') || out.length !== 7) {
      return { r: 255, g: 255, b: 255 };
    }
    return {
      r: parseInt(out.slice(1, 3), 16),
      g: parseInt(out.slice(3, 5), 16),
      b: parseInt(out.slice(5, 7), 16),
    };
  };

  // 仅在 mount 后用当前 active scheme 的 paper；scheme 切换不重读（用户已选定主色）
  paperRgb.value = readRgb('--page');

  // 用 --accent 起始（只在用户没改过的时候）
  // 简化：直接覆盖；用户随时可以从 OklchControls 的 presets 重选
  const accentRaw = window
    .getComputedStyle(probe)
    .getPropertyValue('--accent')
    .trim();
  if (accentRaw) {
    // 通过同步文本喂给 useOklch 的解析
    state.setFromOklch(`oklch(${accentRaw})`);
  }

  probe.remove();
});

const heroStyle = computed(() => ({
  background: `linear-gradient(135deg,
    var(--gradient-decorative-from),
    var(--gradient-decorative-to))`,
}));

// 主题切换器
type ThemeChoice = 'light' | 'dark' | 'system';
const themeChoices: { value: ThemeChoice; label: string; icon: string }[] = [
  { value: 'light', label: 'Light', icon: '☀' },
  { value: 'dark', label: 'Dark', icon: '☾' },
  { value: 'system', label: 'System', icon: '◐' },
];
const currentTheme = computed<ThemeChoice>(() => themeStore.theme);
const setTheme = (value: ThemeChoice) => themeStore.setTheme(value);
</script>

<template>
  <div class="text-ink bg-page min-h-screen pb-24">
    <header
      class="from-page/40 via-page/5 to-page/40 relative overflow-hidden"
      :style="heroStyle"
    >
      <div
        class="mx-auto max-w-6xl px-6 pt-16 pb-12 md:px-10 md:pt-24 md:pb-16"
      >
        <div
          class="text-muted mb-3 font-mono text-xs tracking-widest uppercase"
        >
          OKLCH · Color Lab
        </div>
        <h1
          class="text-ink font-serif text-4xl font-bold tracking-tight md:text-6xl"
        >
          OKLCH 预览 / 生成器
        </h1>
        <p
          class="text-muted mt-4 max-w-2xl text-base leading-relaxed md:text-lg"
        >
          感知均匀的 OKLCH 色彩空间：拖动
          <code class="bg-secondary rounded px-1.5 py-0.5 font-mono text-sm"
            >L · C · H</code
          >
          看实时 hex 预览，跑一遍
          <code class="bg-secondary rounded px-1.5 py-0.5 font-mono text-sm"
            >4 scheme × 2 theme</code
          >
          的对比度，再生成一组和谐配色。
        </p>

        <div class="mt-8 flex flex-wrap items-center gap-3">
          <span
            class="text-on-accent bg-accent rounded-full px-3 py-1 text-xs font-semibold tracking-wider uppercase shadow-sm"
          >
            {{ activeScheme }} · {{ currentTheme }}
          </span>
          <span class="text-muted text-sm">
            · 初始取自当前 scheme 的
            <code class="bg-secondary rounded px-1 font-mono text-xs"
              >--accent</code
            >
          </span>
        </div>

        <div class="mt-5 flex flex-wrap items-center gap-3">
          <span class="text-muted font-mono text-xs tracking-wider uppercase">
            Theme
          </span>
          <div
            class="bg-card/50 inline-flex items-center gap-1 rounded-lg border p-1 backdrop-blur"
            role="tablist"
            aria-label="切换主题"
          >
            <button
              v-for="opt in themeChoices"
              :key="opt.value"
              type="button"
              role="tab"
              :aria-selected="currentTheme === opt.value"
              :class="[
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                currentTheme === opt.value
                  ? 'bg-accent text-on-accent shadow-sm'
                  : 'text-muted hover:text-ink',
              ]"
              @click="setTheme(opt.value)"
            >
              <span aria-hidden="true">{{ opt.icon }}</span>
              <span>{{ opt.label }}</span>
            </button>
          </div>
        </div>
      </div>
    </header>

    <section class="mx-auto max-w-6xl px-6 pt-10 md:px-10 md:pt-14">
      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <OklchControls :state="state" />
        <OklchPreviewCard
          :state="state"
          :contrast-bg="paperRgb"
          :contrast-bg-label="`${activeScheme} --page`"
        />
      </div>
    </section>

    <section class="mx-auto mt-10 max-w-6xl px-6 md:px-10">
      <OklchContrastMatrix :state="state" />
    </section>

    <section class="mx-auto mt-10 max-w-6xl px-6 md:px-10">
      <OklchHarmonyPalette :state="state" />
    </section>

    <section class="mx-auto mt-10 max-w-6xl px-6 md:px-10">
      <OklchLightnessChromaMap :state="state" />
    </section>

    <section class="mx-auto mt-12 max-w-6xl px-6 md:px-10">
      <div
        class="bg-card/40 text-muted rounded-lg border px-5 py-4 text-sm leading-relaxed backdrop-blur"
      >
        💡
        <strong class="text-ink">怎么用</strong>
        三个区域是串联的：改滑杆 → 右侧大色块与 hex 实时刷新 → 下方矩阵展示在 4
        个 scheme 的 paper 底色上的对比度。 想换一个主色可以：
        <code class="bg-secondary rounded px-1 font-mono text-xs"
          >点 Controls 里的 Preset</code
        >
        拉取主题当前的
        <code class="bg-secondary rounded px-1 font-mono text-xs">--accent</code
        >，或直接
        <code class="bg-secondary rounded px-1 font-mono text-xs"
          >点 Harmony 网格的色块</code
        >
        跳到变体上。所有 OKLCH 输入若超出 sRGB 色域，会自动二分降 C 直至可显示。
      </div>
    </section>
  </div>
</template>
