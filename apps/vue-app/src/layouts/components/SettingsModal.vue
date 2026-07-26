<template>
  <!--
   * SettingsModal · 书房主面板 — v3.9
   *
   * 右侧抽屉内缩为一张"书房纸卡"，四层阴影（右+顶反光）跟随主题，
   * 横向胶囊分段控件替代下划线 Tab。全部颜色走 Tailwind v4 @theme
   * 语义令牌，无任何硬编码色值。
   *
   * 圆角: rounded-3xl (Tailwind v4 默认 1.5rem / 24px)
   * 阴影: inline style + color‑mix 覆盖全局 :where([class~='border']) 的硬阴影
   * 动效: motion‑v spring（与 project modal 定式同），抽屉自右滑入
   * 动效降级: prefers‑reduced‑motion → opacity 切换
   -->
  <Teleport to="body">
    <AnimatePresence>
      <motion.div
        v-if="modelValue"
        :initial="{ opacity: 0, x: 40 }"
        :animate="{ opacity: 1, x: 0 }"
        :exit="{ opacity: 0, x: 40 }"
        :transition="SPRING_SNUG"
        class="fixed inset-0 z-9999 flex justify-end"
        @click.self="close"
      >
        <!--
          Drawer 面板 — 书房化
          · 不再 h-full 贴顶贴底，左右留有呼吸
          · rounded-3xl 给出"书房家具"的圆润感
          · shadow-* 用 inline 覆盖全局 :where([class~='border']) 的硬阴影
        -->
        <div
          class="bg-page /60 relative z-10 mx-4 my-6 flex w-full max-w-[480px] flex-col overflow-hidden rounded-3xl border"
          :style="DRAWER_SHADOW"
          role="dialog"
          aria-modal="true"
          aria-label="偏好设置"
        >
          <!-- 标题区 -->
          <header class="relative px-8 pt-12 pb-5 text-center">
            <!-- 关闭按钮 — 保留圆形 -->
            <button
              @click="close"
              class="text-muted hover:bg-surface hover:text-ink absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full transition-colors active:scale-[0.96]"
              aria-label="关闭"
            >
              <IconClose class="h-5 w-5" />
            </button>

            <h1
              class="text-ink font-serif text-[28px] leading-tight font-semibold"
            >
              偏好设置
            </h1>

            <p class="text-muted mt-1.5 font-serif text-sm italic">
              Customize your reading experience
            </p>

            <!-- 书签式装饰：两侧小色点 + 中间梯度短横 -->
            <div class="mt-5 flex items-center gap-2 px-16">
              <span class="bg-accent/70 h-1 w-1 rounded-full" />
              <span
                class="from-gradient-decorative-from to-gradient-decorative-to h-px flex-1 bg-gradient-to-r"
              />
              <span class="bg-accent/70 h-1 w-1 rounded-full" />
            </div>
          </header>

          <!--
            章节 Tab — 横向胶囊分段控件
            底托 bg-surface + 激活项 bg-page 给出"高度差"指示
          -->
          <nav
            ref="navRef"
            aria-label="设置分组"
            class="bg-surface relative mx-8 flex items-stretch justify-between gap-1 rounded-xl p-1"
          >
            <!-- Sliding pill indicator (transitions translateX + width). -->
            <span ref="pillRef" class="settings-tab-pill" aria-hidden="true" />
            <button
              v-for="tab in tabs"
              :key="tab.key"
              @click="activeTab = tab.key"
              class="relative flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ease-out active:scale-[0.97]"
              :class="
                activeTab === tab.key
                  ? 'bg-page text-ink shadow-sm'
                  : 'hover:text-ink text-[color-mix(in_oklch,var(--ink)_55%,transparent)]'
              "
            >
              {{ tab.label }}
            </button>
          </nav>

          <!-- 内容区 — 内部切换用淡入淡出 -->
          <div class="flex-1 overflow-y-auto px-8 py-5">
            <ModalFadeTransition mode="out-in">
              <AppearanceTab
                v-if="activeTab === 'appearance'"
                key="appearance"
              />
              <BackgroundTab
                v-else-if="activeTab === 'background'"
                key="background"
              />
              <CardTab v-else key="card" />
            </ModalFadeTransition>
          </div>

          <!--
            品牌签名 — 用居中渐变细线替代 border-t
          -->
          <div class="-mb-px px-8 pt-3">
            <div
              class="via-border h-px w-1/3 bg-gradient-to-r from-transparent to-transparent"
            />
          </div>
          <footer
            class="flex items-center justify-between px-8 pt-2 pb-4 font-mono text-[11px]"
          >
            <span class="text-muted font-sans">Settings</span>
            <span class="text-muted font-serif italic">ka·no·ci·fer</span>
          </footer>
        </div>
      </motion.div>
    </AnimatePresence>
  </Teleport>
</template>

<script setup lang="ts">
import { AnimatePresence, motion } from 'motion-v';
import { SPRING_SNUG } from '@/constants';
import { IconClose } from '@/components';
import { ModalFadeTransition } from '@/components';
import AppearanceTab from './AppearanceTab.vue';
import BackgroundTab from './BackgroundTab.vue';
import CardTab from './CardTab.vue';
import {
  nextTick,
  onMounted,
  onUnmounted,
  useTemplateRef,
  ref,
  watch,
} from 'vue';

defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const close = () => {
  emit('update:modelValue', false);
};

const activeTab = ref('appearance');

const tabs = [
  { key: 'appearance', label: '外观' },
  { key: 'background', label: '背景' },
  { key: 'card', label: '卡片' },
];

const navRef = useTemplateRef<HTMLElement>('navRef');
const pillRef = useTemplateRef<HTMLElement>('pillRef');

function activeTabIndex(): number {
  return tabs.findIndex((t) => t.key === activeTab.value);
}

/* Position the pill over the active button.
   animate=false → suspend the transition, write values, force reflow,
   restore → pill snaps with no tween (used on mount + resize). */
function positionPill(animate = true) {
  const nav = navRef.value;
  const pill = pillRef.value;
  if (!nav || !pill) return;

  const idx = activeTabIndex();
  if (idx === -1) return;
  // children[0] is the pill; buttons start at index 1
  const btn = nav.children[idx + 1] as HTMLElement | undefined;
  if (!btn) return;

  if (!animate) {
    pill.style.transition = 'none';
  }
  pill.style.width = `${btn.offsetWidth}px`;
  pill.style.transform = `translateX(${btn.offsetLeft}px)`;
  if (!animate) {
    void pill.offsetHeight; // commit before restoring transition
    pill.style.transition = '';
  }
}

// Reposition on tab change (animated).
watch(activeTab, () => void nextTick(() => positionPill(true)));

let resizeObserver: ResizeObserver | null = null;
onMounted(() => {
  positionPill(false); // snap into place on first paint
  resizeObserver = new ResizeObserver(() => positionPill(false));
  if (navRef.value) resizeObserver.observe(navRef.value);
});

onUnmounted(() => resizeObserver?.disconnect());

/*
 * 抽屉入场 spring — 与 project modal 定式（DESIGN.md）一致。
 * 从 motionPresets 导入 SPRING_SNUG。
 */

/*
 * Drawer 面板阴影 — 三层向右 ambient + 顶部 inset 纸面反光。
 * color-mix 让明暗主题自动追踪，遵守 No-Fixed-RGBA Rule。
 * 用 inline style 覆盖全局 :where([class~='border']) 的硬阴影。
 */
const DRAWER_SHADOW = [
  '0 -1px 1px color-mix(in oklch, var(--ink) 6%, transparent)',
  '0 -8px 18px color-mix(in oklch, var(--ink) 8%, transparent)',
  '0 -24px 40px color-mix(in oklch, var(--ink) 5%, transparent)',
  'inset 0 1px 0 0 oklch(from var(--page) l c h / 0.6)',
].join(', ');
</script>

<style scoped>
/* Sliding tab pill — transitions translateX + width to track the active
   button. Same curve + snap idiom as BasicNav's indicator. */
.settings-tab-pill {
  position: absolute;
  top: 4px; /* match nav padding (p-1 = 4px) */
  left: 0;
  height: calc(100% - 8px); /* fill nav minus vertical padding */
  z-index: 0;
  background: var(--page);
  border-radius: 0.5rem; /* rounded-lg, matches the buttons */
  box-shadow: 0 1px 2px color-mix(in oklch, var(--ink) 8%, transparent);
  transform: translateX(0);
  transition:
    transform 250ms cubic-bezier(0.32, 0.72, 0, 1),
    width 250ms cubic-bezier(0.32, 0.72, 0, 1);
  will-change: transform, width;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .settings-tab-pill {
    transition: none;
  }
}
</style>
