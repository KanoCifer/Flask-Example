<template>
  <motion.nav aria-label="主导航" class="nav liquid-glass px-12 py-1">
    <ul class="flex items-center gap-2 font-medium">
      <!-- Brand: avatar + 文字 logo -->
      <li class="ml-1 flex shrink-0 items-center gap-2 pr-2">
        <RouterLink to="/" class="shrink-0">
          <img
            v-if="auth.isAuthenticated && auth.user?.photo"
            :src="avatarUrl"
            :alt="currentUserName"
            class="h-10 w-10 rounded-full object-cover ring-2 ring-white/50 outline -outline-offset-1 outline-black/10 transition-[transform] duration-150 ease-out active:scale-[0.96] dark:ring-gray-700/50 dark:outline-white/10"
          />
          <img
            v-else
            src="/images/about-thumb.webp"
            alt="Default Avatar"
            class="h-10 w-10 rounded-full object-cover ring-2 ring-white/50 outline -outline-offset-1 outline-black/10 transition-[transform] duration-150 ease-out active:scale-[0.96] dark:ring-gray-700/50 dark:outline-white/10"
          />
        </RouterLink>
        <RouterLink
          to="/"
          class="nav-text font-family-averia text-xl leading-none tracking-wide whitespace-nowrap"
        >
          Kuroome <br />Blog
        </RouterLink>
      </li>
      <!-- Navigation Labels (圆中文字) -->
      <li ref="navStripRef" class="relative ml-16 flex items-center gap-2 px-5">
        <!-- Indicator pill: position + width are measured from the
             active tab's offsetLeft / offsetWidth (Transitions.dev
             sliding tabs pattern). Both properties tween via CSS. -->
        <span
          ref="indicatorRef"
          class="indicator liquid-glass-button absolute top-1/2 left-0 z-1 h-11 -translate-y-1/2 rounded-full"
        />
        <!-- Nav Items: icon + 英文标签 -->
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          :aria-label="item.ariaLabel"
          :aria-current="isActive(item.to) ? 'page' : undefined"
          class="nav-text nav-link relative z-10 flex h-11 flex-col items-center justify-center gap-1 px-4 text-[13px] leading-none transition-[transform,background-color,color,opacity] duration-150 ease-out active:scale-[0.96]"
          :class="{ 'opacity-40 hover:opacity-70': !isActive(item.to) }"
        >
          <component :is="item.icon" :size="20" stroke-width="1.75" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </li>
      <!-- Others: hover dropdown — routes not shown in the pill strip -->
      <li>
        <HoverDropdown
          panel-class="bg-page/80 absolute top-full right-0 z-50 mt-2 w-52 rounded-2xl p-1 ring-1 ring-black/5 backdrop-blur-xs dark:ring-white/10"
          class="flex items-center"
        >
          <template #trigger="{ isOpen }">
            <button
              type="button"
              :aria-expanded="isOpen || undefined"
              aria-haspopup="true"
              class="nav-text nav-link liquid-glass-button relative flex h-11 items-center gap-1.5 rounded-full px-1 text-[13px] leading-none transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.96]"
              :class="{
                'opacity-100': isOthersActive,
                'opacity-40 hover:opacity-70': !isOthersActive,
              }"
            >
              <Ellipsis :size="18" stroke-width="1.75" />
              <span>Others</span>
              <ChevronDown
                :size="12"
                class="transition-transform duration-150"
                :class="{ 'rotate-180': isOpen }"
              />
            </button>
          </template>
          <template #default="{ close }">
            <RouterLink
              v-for="item in othersRouteItems"
              :key="item.to"
              :to="item.to"
              @click="close"
              class="nav-text flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors duration-150 hover:bg-black/5 dark:hover:bg-white/10"
            >
              <component :is="item.icon" :size="16" stroke-width="1.75" />
              <span>{{ item.label }}</span>
            </RouterLink>
            <button
              v-for="item in othersActionItems"
              :key="item.label"
              type="button"
              @click="item.action"
              class="nav-text flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors duration-150 hover:bg-black/5 dark:hover:bg-white/10"
            >
              <component :is="item.icon" :size="16" stroke-width="1.75" />
              <span>{{ item.label }}</span>
            </button>
          </template>
        </HoverDropdown>
      </li>
    </ul>
  </motion.nav>
</template>

<script setup lang="ts">
import { HoverDropdown } from '@/components';
import { useAuthStore } from '@/features/auth';
import {
  BookOpenText,
  ChevronDown,
  Ellipsis,
  CreditCard,
  Globe,
  House,
  Images,
  Info,
  Link,
  ListChecks,
  Map,
  MessageCircleHeart,
  Newspaper,
  Rss,
  ScrollText,
  Shield,
  Smartphone,
  Palette,
  Wrench,
} from '@lucide/vue';
import { motion } from 'motion-v';
import type { Component } from 'vue';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

interface NavItem {
  to: string;
  label: string;
  icon: Component;
  ariaLabel: string;
}

const auth = useAuthStore();
const route = useRoute();

// Navigation items config
// icon + 英文标签 + 完整 ariaLabel 给屏幕阅读器
const navItems: NavItem[] = [
  { to: '/', label: 'Home', icon: House, ariaLabel: 'Home' },
  { to: '/blog', label: 'Blog', icon: Newspaper, ariaLabel: 'Blog' },
  {
    to: '/moments',
    label: 'Moments',
    icon: MessageCircleHeart,
    ariaLabel: 'Moments',
  },
  {
    to: '/bookshelf',
    label: 'Bookshelf',
    icon: BookOpenText,
    ariaLabel: 'Bookshelf',
  },
  { to: '/gallery', label: 'Gallery', icon: Images, ariaLabel: 'Gallery' },
  {
    to: '/version-log',
    label: 'Log',
    icon: ScrollText,
    ariaLabel: 'Changelog',
  },
];

// Others dropdown: orphan routes + utility entries not given a pill in the strip.
// `to` = 路由链接；`action` = 按钮行为（如外部跳转移动版）
interface OthersItem {
  label: string;
  icon: Component;
  to?: string;
  action?: () => void;
}

const othersItems: OthersItem[] = [
  { to: '/about', label: 'About', icon: Info },
  { to: '/websites', label: 'Websites', icon: Globe },
  { to: '/friend-links', label: 'Friends', icon: Link },
  { to: '/privacy', label: 'Privacy', icon: Shield },
  { to: '/toolbox/image-toolbox', label: 'Image Tool', icon: Wrench },
  { to: '/status', label: 'Status', icon: ListChecks },
  { to: '/todos', label: 'Dev Tasks', icon: ListChecks },
  { to: '/fishing-map', label: 'Fishing', icon: Map },
  { to: '/rss', label: 'RSS', icon: Rss },
  { to: '/subscription', label: 'Subscription', icon: CreditCard },
  { to: '/color', label: 'Schemes', icon: Palette },
  { label: 'Mobile', icon: Smartphone, action: switchToMobile },
];

// Refs for DOM-measured indicator positioning (Transitions.dev sliding
// pill pattern). The indicator's translateX + width are read from the
// active tab's own offsetLeft / offsetWidth — resilient to any future
// sizing changes, no hardcoded math.
const navStripRef = ref<HTMLElement | null>(null);
const indicatorRef = ref<HTMLElement | null>(null);

/* Move the pill to `index`.
   `animate=false` suspends the CSS transition (set → force reflow →
   restore) so the pill snaps into position without a tween. Used on
   first paint and on resize — we never want a stray slide on load. */
function positionIndicator(index: number, animate = true) {
  const strip = navStripRef.value;
  const pill = indicatorRef.value;
  if (!strip || !pill) return;

  const tab = strip.children[index + 1] as HTMLElement | undefined;
  // children[0] is the pill span itself; tabs start at index 1
  if (!tab) return;

  if (!animate) {
    pill.style.transition = 'none';
    pill.style.width = `${tab.offsetWidth}px`;
    pill.style.transform = `translateX(${tab.offsetLeft}px)`;
    // Force reflow so the "none" write is committed before we restore.
    void pill.offsetHeight;
    pill.style.transition = '';
    return;
  }

  pill.style.width = `${tab.offsetWidth}px`;
  pill.style.transform = `translateX(${tab.offsetLeft}px)`;
}

// Others dropdown state (open/close 委托给 HoverDropdown,此处只关心 active 高亮)
const isOthersActive = computed(() =>
  othersItems.some((item) => item.to && isActive(item.to)),
);

const othersRouteItems = computed(() =>
  othersItems.filter((item): item is OthersItem & { to: string } => !!item.to),
);

const othersActionItems = computed(() =>
  othersItems.filter(
    (item): item is OthersItem & { action: () => void } => !!item.action,
  ),
);

// 切换到移动版：写 device_force=react cookie 后跳转到 m.kanocifer.chat
// 与 FloatingActionButtons.switchToMobile 保持同源逻辑
function switchToMobile() {
  const expires = new Date();
  expires.setTime(expires.getTime() + 30 * 24 * 60 * 60 * 1000);
  document.cookie = `device_force=react;expires=${expires.toUTCString()};path=/;domain=.kanocifer.chat`;
  window.location.href = 'https://m.kanocifer.chat';
}

// Check if route is active
const isActive = (path: string) => {
  if (path === '/') {
    return route.path === '/';
  }

  return route.path === path || route.path.startsWith(`${path}/`);
};

/* Active index — kept in sync with the route so the pill always lands
   on the right tab even on direct navigation (back/forward, link). */
const activeIndex = ref(0);

// Update pill position when route changes (animated tween).
watch(
  () => route.path,
  () => {
    const index = navItems.findIndex((item) => isActive(item.to));
    if (index !== -1) {
      activeIndex.value = index;
    }
    void nextTick(() => positionIndicator(activeIndex.value));
  },
  { immediate: true },
);

/* ResizeObserver keeps the pill aligned if layout shifts (font load,
   breakpoint, etc.). Snaps without animation. */
let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  // First-paint snap: no animation on initial position.
  positionIndicator(activeIndex.value, false);

  resizeObserver = new ResizeObserver(() => {
    positionIndicator(activeIndex.value, false);
  });
  if (navStripRef.value) {
    resizeObserver.observe(navStripRef.value);
  }
});

onUnmounted(() => {
  resizeObserver?.disconnect();
});

// Computed
const currentUserName = computed(() => auth.user?.name || '未登录');
const avatarUrl = computed(() => {
  if (auth.user?.photo?.startsWith('http')) {
    return auth.user.photo;
  }
  if (auth.user?.photo) {
    return `/v3/media/${auth.user.photo}`;
  }
  return '/images/about-thumb.webp';
});
</script>

<style scoped>
.indicator {
  pointer-events: none;
  /* Tween both position and size — the pill slides AND stretches to the
     next tab's measured bounds (Transitions.dev sliding tabs). */
  transition:
    transform 0.28s cubic-bezier(0.32, 0.72, 0, 1),
    width 0.28s cubic-bezier(0.32, 0.72, 0, 1);
  will-change: transform, width;
}

.nav-text {
  color: black;
  font-weight: 600;
}

/* 键盘焦点环：项目标准 3px ring-ring，仅 focus-visible 时出现 */
.nav-link:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--ring);
  border-radius: 999px;
}

@media (prefers-reduced-motion: reduce) {
  .indicator {
    transition: none;
  }
}

.dark .nav-text {
  color: white;
}

/* 选中指示器：玻璃凸起的"按键"，与父容器 liquid-glass 同质但层次更亮
   半透白底 + 上侧内侧高光(玻璃受光面) + 下侧环境阴影(浮起投影) */
.liquid-glass-button {
  background: rgb(255 255 255 / 0.28);
  border: 1px solid rgb(255 255 255 / 0.4);
  box-shadow:
    inset 0 1px 1px rgb(255 255 255 / 0.6),
    inset 0 -1px 2px rgb(0 0 0 / 0.04),
    0 2px 6px rgb(0 0 0 / 0.06),
    0 1px 2px rgb(0 0 0 / 0.04);
}

.dark .liquid-glass-button {
  background: rgb(255 255 255 / 0.1);
  border-color: rgb(255 255 255 / 0.12);
  box-shadow:
    inset 0 1px 1px rgb(255 255 255 / 0.12),
    inset 0 -1px 2px rgb(0 0 0 / 0.1),
    0 2px 6px rgb(0 0 0 / 0.2),
    0 1px 2px rgb(0 0 0 / 0.15);
}

/* 液态玻璃效果：SVG 色散 + 毛玻璃 + 饱和度补偿 + 双层内阴影模拟玻璃厚度
   详见 index.html 中 #nav-liquid-glass filter 定义
   浅色模式用半透白做光雾，深色模式切到半透 paper (var(--page)/40) 透出深色背景
   — 跟随主题自动切基色，深/浅都通透 */

.liquid-glass {
  border-radius: 999px;
  background: rgb(255 255 255 / 0.06);
  -webkit-backdrop-filter: url(#nav-liquid-glass) blur(7px) saturate(1.4);
  backdrop-filter: url(#nav-liquid-glass) blur(4px) saturate(1.4);
  border: 1px solid rgb(21 20 15 / 0.08);
  /* 内侧高光(玻璃正面反光) + 外侧散射光(玻璃壁厚) + 环境阴影(浮起) */
  box-shadow:
    inset 0 0 2px 1px rgb(255 255 255 / 0.55),
    inset 0 0 10px 4px rgb(255 255 255 / 0.22),
    0 6px 24px rgb(17 17 26 / 0.06),
    0 12px 40px rgb(17 17 26 / 0.05);
}
/* Safari 不支持 backdrop-filter: url(...) ，降级为纯毛玻璃 + 偏亮阴影 */
@supports not (backdrop-filter: url(#nav-liquid-glass)) {
  .liquid-glass {
    -webkit-backdrop-filter: blur(12px) saturate(1.4);
    backdrop-filter: blur(12px) saturate(1.4);
  }
}

/* 深色模式：基底由"白色光雾"换成"深色玻璃"，
   边框翻转为浅色高光边，浮起阴影换成发光晕 */
.dark .liquid-glass {
  backdrop-filter: url(#nav-liquid-glass) blur(1px) saturate(1.4);
  background: rgba(255 255 255 / 0.01);
  border-color: rgb(255 255 255 / 0.08);
  box-shadow:
    0 6px 24px rgb(17 17 26 / 0.06),
    0 12px 40px rgb(17 17 26 / 0.05);
}
</style>
