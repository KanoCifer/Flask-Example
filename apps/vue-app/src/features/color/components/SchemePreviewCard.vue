<script setup lang="ts">
// 单个 scheme 的预览卡 —— 通过嵌套 data-color-scheme 让卡片内部 token
// 与全局解耦，从而能在同一页面同时看到 4 个 scheme 的真实渲染。
//
// 暗色态：跟随当前 store.theme（root .dark），让用户能在浅/深间对比。
import { computed, ref, watch } from 'vue';
import { COLOR_SCHEMES, useThemeStore } from '@/stores';
import type { ColorScheme } from '@/stores';
import { SCHEME_META, TOKEN_GROUPS, TOKEN_META } from '../lib/schemeMeta';
import { useSchemeTokens } from '../composables/useSchemeTokens';
import TokenSwatch from './TokenSwatch.vue';

const props = defineProps<{
  scheme: ColorScheme;
  /** 是否为当前激活的 scheme（影响「当前」徽标） */
  active?: boolean;
}>();

const emit = defineEmits<{
  (e: 'apply', scheme: ColorScheme): void;
}>();

const themeStore = useThemeStore();

const meta = computed(
  () => SCHEME_META.find((s) => s.id === props.scheme) ?? SCHEME_META[0],
);

const schemeRef = computed(() => props.scheme);
const tokens = useSchemeTokens(schemeRef);

// 暗色徽标 —— 同时覆盖 'dark' 与 'system' + 系统暗色偏好两种情形，
// 因为 CSS 暗色选择器是 `[data-color-scheme='x'].dark`，必须把 .dark
// 显式加到 card 上（class 选择器不沿 DOM 继承，只有自定义属性才会）。
const isDark = computed(() => {
  if (themeStore.theme === 'dark') return true;
  if (themeStore.theme === 'system') {
    return (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    );
  }
  return false;
});

const tokensByGroup = computed(() =>
  TOKEN_GROUPS.map((g) => ({
    ...g,
    items: TOKEN_META.filter((t) => t.group === g.key),
  })),
);

const swatchHint = ref('');
const showCopied = (label: string) => {
  swatchHint.value = label;
  setTimeout(() => {
    if (swatchHint.value === label) swatchHint.value = '';
  }, 1200);
};
watch(swatchHint, () => {});

const apply = () => emit('apply', props.scheme);

const isCurrent = computed(() => props.active);
const isOther = computed(
  () => !props.active && COLOR_SCHEMES.includes(props.scheme),
);
</script>

<template>
  <article
    :data-color-scheme="scheme"
    :class="[
      'bg-card/80 text-ink relative flex flex-col overflow-hidden rounded-xl border shadow-sm backdrop-blur',
      isDark ? 'dark' : '',
      isCurrent
        ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--page)]'
        : '',
    ]"
  >
    <!-- 头部：scheme 名 + 描述 + 当前徽标 + 应用按钮 -->
    <header
      class="relative flex items-start gap-3 from-[var(--gradient-decorative-from)] to-[var(--gradient-decorative-to)] px-5 pt-5 pb-4"
    >
      <span
        class="mt-1 inline-block h-10 w-1.5 shrink-0 rounded-full"
        :style="{ background: `oklch(0.65 0.12 ${meta.hue})` }"
        aria-hidden="true"
      />
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <h3 class="text-ink text-lg font-semibold">
            {{ meta.name }}
          </h3>
          <span
            v-if="isCurrent"
            class="bg-accent text-contrast rounded-full px-2 py-0.5 text-xs font-semibold tracking-wider uppercase"
          >
            current
          </span>
          <span
            v-if="isDark"
            class="text-muted rounded-full border bg-[var(--card-bg)] px-2 py-0.5 text-xs tracking-wider uppercase"
          >
            dark
          </span>
        </div>
        <p class="text-muted mt-1 text-xs leading-relaxed">
          {{ meta.description }}
        </p>
      </div>
    </header>

    <!-- mini demo：按钮 + 卡片 + 输入框 -->
    <div class="space-y-3 px-5 pb-4">
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="bg-accent text-contrast rounded-md px-3 py-1.5 text-xs font-semibold shadow-sm"
        >
          Primary
        </button>
        <button
          type="button"
          class="text-ink rounded-md border px-3 py-1.5 text-xs"
        >
          Secondary
        </button>
        <span
          class="text-ink rounded-md bg-[var(--surface)] px-2 py-1 text-xs backdrop-blur"
        >
          surface
        </span>
      </div>
      <div class="rounded-md border bg-[var(--card-bg)] p-3 text-xs">
        <div class="text-ink font-medium">卡片标题</div>
        <div class="text-muted-text mt-1">
          muted text 用作正文段落，warm-gray 与 secondary 做底面分层。
        </div>
      </div>
      <div class="flex gap-1.5">
        <span
          v-for="n in 5"
          :key="n"
          class="/40 h-3 flex-1 rounded-full border"
          :style="{ background: `var(--chart-${n})` }"
          :aria-label="`chart-${n}`"
        />
      </div>
    </div>

    <!-- 分组 token 列表 -->
    <div
      class="space-y-3 border-t px-5 py-4"
      @click="showCopied(($event.target as HTMLElement)?.textContent ?? '')"
    >
      <div v-for="g in tokensByGroup" :key="g.key">
        <div
          class="text-muted mb-1.5 text-xs font-semibold tracking-wider uppercase"
        >
          {{ g.label }}
        </div>
        <div class="grid grid-cols-1 gap-1.5">
          <TokenSwatch
            v-for="t in g.items"
            :key="t.name"
            :name="t.name"
            :label="t.label"
            :value="tokens[t.name] ?? ''"
            @click="showCopied(t.label)"
          />
        </div>
      </div>
    </div>

    <!-- footer：应用按钮 -->
    <footer
      class="flex items-center justify-between gap-3 border-t bg-[var(--secondary)] px-5 py-3"
    >
      <span class="text-muted text-xs">
        {{ isCurrent ? '正在使用此配色' : '点击应用切换全局配色' }}
      </span>
      <button
        type="button"
        :disabled="isCurrent"
        :class="[
          'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
          isCurrent
            ? 'text-muted cursor-default border border-[var(--border-color)] bg-[var(--card-bg)]'
            : 'bg-accent text-contrast hover:opacity-90',
        ]"
        @click="apply"
      >
        {{ isCurrent ? '已应用' : '应用此配色' }}
      </button>
    </footer>

    <span
      v-if="swatchHint"
      class="bg-accent text-contrast pointer-events-none absolute right-3 bottom-16 rounded-full px-2 py-0.5 text-xs font-semibold shadow"
    >
      已复制 {{ swatchHint }}
    </span>
  </article>
</template>
