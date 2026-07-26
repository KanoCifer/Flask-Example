<script setup lang="ts">
// 配色工坊 — 展示 4 个 scheme 的真实渲染、token 解析值、当前激活态。
//
// 行为：
// - 顶部 hero 区跟随当前激活 scheme（用真实 token 渲染，与全局一致）
// - 下方 4 张预览卡各嵌套 [data-color-scheme]，互不干扰
// - 点击「应用此配色」→ 调用 useThemeStore.setScheme
// - 暗色态跟随全局主题切换
import { computed } from 'vue';
import { useHead } from '@vueuse/head';
import { COLOR_SCHEMES, useThemeStore, type ColorScheme } from '@/stores';
import { SCHEME_META } from './lib/schemeMeta';
import SchemePreviewCard from './components/SchemePreviewCard.vue';

const themeStore = useThemeStore();

useHead({
  title: '配色工坊 — Kuroome Blog',
  meta: [
    {
      name: 'description',
      content: '展示并切换博客的 4 套配色方案（paper / sage / mist / blush）。',
    },
  ],
});

const activeScheme = computed<ColorScheme>(() => themeStore.scheme);

const apply = (scheme: ColorScheme) => {
  themeStore.setScheme(scheme);
};

type ThemeChoice = 'light' | 'dark' | 'system';
const themeChoices: { value: ThemeChoice; label: string; icon: string }[] = [
  { value: 'light', label: 'Light', icon: '☀' },
  { value: 'dark', label: 'Dark', icon: '☾' },
  { value: 'system', label: 'System', icon: '◐' },
];
const currentTheme = computed<ThemeChoice>(() => themeStore.theme);
const setTheme = (value: ThemeChoice) => themeStore.setTheme(value);

// 顶部 hero 复刻当前 scheme 的核心装饰
const heroStyle = computed(() => ({
  background: `linear-gradient(135deg,
    var(--gradient-decorative-from),
    var(--gradient-decorative-to))`,
}));
</script>

<template>
  <div class="text-ink bg-page min-h-screen pb-24">
    <!-- Hero：跟随当前 scheme 的真实 token -->
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
          Color Scheme Lab · 配色工坊
        </div>
        <h1
          class="text-ink font-serif text-4xl font-bold tracking-tight md:text-6xl"
        >
          四个方案 · 同一套语义
        </h1>
        <p
          class="text-muted mt-4 max-w-2xl text-base leading-relaxed md:text-lg"
        >
          每个配色都共享同一组 CSS 变量（<code
            class="bg-surface rounded px-1.5 py-0.5 font-mono text-sm"
            >--ink --page --accent --chart-1..5</code
          >）。
          切换的是基色与饱和度，组件代码无需改动。下面四张卡分别嵌套了对应的
          <code class="bg-surface rounded px-1.5 py-0.5 font-mono text-sm"
            >[data-color-scheme]</code
          >，点击「应用此配色」即可全站生效。
        </p>

        <!-- 当前状态 -->
        <div class="mt-8 flex flex-wrap items-center gap-3">
          <span
            class="bg-accent text-contrast rounded-full px-3 py-1 text-xs font-semibold tracking-wider uppercase shadow-sm"
          >
            {{ activeScheme }} · 当前
          </span>
          <span class="text-muted text-sm">
            ·
            {{ SCHEME_META.find((s) => s.id === activeScheme)?.description }}
          </span>
        </div>

        <!-- 主题切换器：light / dark / system -->
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
                  ? 'bg-accent text-contrast shadow-sm'
                  : 'text-muted hover:text-ink',
              ]"
              @click="setTheme(opt.value)"
            >
              <span aria-hidden="true">{{ opt.icon }}</span>
              <span>{{ opt.label }}</span>
            </button>
          </div>
          <span class="text-muted text-xs">
            · 切换后全站生效，可在浅/深两态对比 4 个配色
          </span>
        </div>
      </div>
    </header>

    <!-- 主体：4 张预览卡 -->
    <section class="mx-auto max-w-6xl px-6 pt-10 md:px-10 md:pt-14">
      <div class="text-muted mb-5 flex items-baseline justify-between">
        <h2 class="text-ink text-xl font-semibold">Schemes · 配色清单</h2>
        <span class="font-mono text-xs">
          {{ COLOR_SCHEMES.length }} 个 · sources:
          <code>packages/brand/themes/</code>
        </span>
      </div>

      <div class="grid gap-6 xl:grid-cols-2">
        <SchemePreviewCard
          v-for="scheme in COLOR_SCHEMES"
          :key="scheme"
          :scheme="scheme"
          :active="scheme === activeScheme"
          @apply="apply"
        />
      </div>
    </section>

    <!-- 提示：暗色态 -->
    <section class="mx-auto mt-12 max-w-6xl px-6 md:px-10">
      <div
        class="bg-card/40 text-muted rounded-lg border px-5 py-4 text-sm leading-relaxed backdrop-blur"
      >
        💡
        <strong class="text-ink">暗色态预览</strong>
        来自根元素的
        <code class="bg-surface rounded px-1 font-mono text-xs">.dark</code>
        类 + scheme 的
        <code class="bg-surface rounded px-1 font-mono text-xs"
          >[data-color-scheme='x'].dark</code
        >
        选择器。切到 dark 模式时，4 张卡的 token
        都会切换到对应暗色调，可在同一屏对比深浅。
      </div>
    </section>
  </div>
</template>
