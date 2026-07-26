<script setup lang="ts">
/**
 * AnalysisPanel —— AI 智能分析(悬浮圆角卡片,desktop-only)。
 *
 * 取代原 AnalysisDrawer(h-screen 右侧抽屉 + backdrop 模糊):
 * - 桌面右侧浮动(mx-4 my-6 呼吸边)、rounded-3xl 书房纸卡
 * - 四层 color-mix 阴影(右 + 顶反光),遵守 No-Fixed-RGBA Rule
 * - 无背景模糊;点击遮罩不关闭(仅 header 触发按钮 + ✕ + Esc 关闭)
 * - 内容组件 WeatherAnalysis 原样复用,本组件只管容器与无障碍
 *
 * 桌面优先:与 SpotDetailPanel 并肩,构成右侧统一的书房纸卡语系。
 */
import WeatherAnalysis from '@/features/fishing/components/WeatherAnalysis.vue';
import type { WeatherAnalysisPayload } from '@/features/fishing/types';
import { X } from '@lucide/vue';
import { SlideFadeTransitionX } from '@/components';
import { nextTick, ref, watch } from 'vue';

const props = defineProps<{
  open: boolean;
  payload: WeatherAnalysisPayload | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

/*
 * 卡片阴影 —— 三层向右 ambient + 顶部 inset 纸面反光。
 * 与 SpotDetailPanel / SettingsModal 共用同一套书房阴影语系。
 * color-mix 让明暗主题自动追踪,遵守 No-Fixed-RGBA Rule。
 * inline style 覆盖全局 :where([class~='border']) 的硬阴影。
 */
const CARD_SHADOW = [
  '0 -1px 1px color-mix(in oklch, var(--ink) 6%, transparent)',
  '0 -8px 18px color-mix(in oklch, var(--ink) 8%, transparent)',
  '0 -24px 40px color-mix(in oklch, var(--ink) 5%, transparent)',
  'inset 0 1px 0 0 oklch(from var(--page) l c h / 0.6)',
].join(', ');

// ── 无障碍:focus trap + Esc + restore focus ──
const panelRef = ref<HTMLElement | null>(null);
let triggerEl: HTMLElement | null = null;
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

function trapFocus(e: KeyboardEvent): void {
  if (e.key !== 'Tab' || !panelRef.value) return;
  const nodes = panelRef.value.querySelectorAll<HTMLElement>(FOCUSABLE);
  if (nodes.length === 0) return;
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      triggerEl = (document.activeElement as HTMLElement) ?? null;
      await nextTick();
      const first = panelRef.value?.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    } else {
      triggerEl?.focus();
      triggerEl = null;
    }
  },
);
</script>

<template>
  <Teleport to="body">
    <!--
      AI 分析 —— 悬浮圆角卡片(对齐 SpotDetailPanel / SettingsModal 书房纸卡风格)。
      · 桌面右侧浮动,mx-4 my-6 留出呼吸边,rounded-3xl 家具感
      · 四层 color-mix 阴影(右 + 顶反光),遵守 No-Fixed-RGBA Rule
      · 无背景模糊;点击遮罩不关闭(仅 ✕ / Esc / header 按钮关闭)
    -->

    <SlideFadeTransitionX>
      <aside
        v-if="open"
        ref="panelRef"
        class="bg-page /60 fixed top-6 right-6 bottom-6 z-50 flex w-full max-w-[480px] flex-col overflow-hidden rounded-3xl border"
        :style="CARD_SHADOW"
        role="dialog"
        aria-modal="true"
        aria-label="AI 分析"
        @keydown="trapFocus"
        @keydown.esc="emit('close')"
      >
        <!-- 顶栏 -->
        <header
          class="border-border flex items-start justify-between gap-3 border-b px-6 pt-6 pb-5"
        >
          <div class="min-w-0">
            <h2 class="text-ink font-family-averia text-2xl leading-snug">
              AI 分析
            </h2>
            <p class="text-muted mt-0.5 text-xs">基于当前天气与潮汐综合判断</p>
          </div>
          <button
            type="button"
            class="text-muted hover:bg-surface hover:text-ink inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors"
            aria-label="关闭分析"
            @click="emit('close')"
          >
            <X class="h-4 w-4" />
          </button>
        </header>

        <!-- 可滚动主体 —— 原样复用 WeatherAnalysis -->
        <div class="flex-1 overflow-y-auto px-5 py-4">
          <WeatherAnalysis :weather_data="payload" :auto-analyze="open" />
        </div>
      </aside>
    </SlideFadeTransitionX>
  </Teleport>
</template>
