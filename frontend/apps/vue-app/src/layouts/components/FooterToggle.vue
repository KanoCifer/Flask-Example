<script setup lang="ts">
import Footer from '@/layouts/components/Footer.vue';
import BackToTop from '@/layouts/components/BackToTop.vue';
import BasicNav from '@/layouts/components/BasicNav.vue';
import { AnimatePresence } from 'motion-v';
import { SPRING_BOUNCE } from '@/constants';
import { useThemeStore } from '@/stores';
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';

defineProps<{ isEntryView: boolean }>();

const themeStore = useThemeStore();
const route = useRoute();
const showBasicNav = ref<boolean | null>(null);

// 自带顶栏的路由：首页是全屏 bento，钓点图鉴页有专属顶栏（FishingTopBar），
// 两者都不再叠加全局导航。
const SELF_NAVIGATED_ROUTES = new Set(['/', '/fishing-map']);

// 路由 → 顶栏导航可见性
watch(
  () => route.path,
  (newPath) => {
    showBasicNav.value = !SELF_NAVIGATED_ROUTES.has(newPath);
  },
  { immediate: true },
);
</script>

<template>
  <!-- Footer -->
  <Footer
    v-if="themeStore.showFooter === 'true' && !isEntryView"
    :is-entry-view="isEntryView"
  />

  <!-- Back to Top Button -->
  <BackToTop />

  <!-- Navigation -->
  <AnimatePresence>
    <BasicNav
      v-if="showBasicNav === true"
      :animate="{ opacity: 1, y: 0, left: '50%', filter: 'blur(0px)' }"
      :initial="{ opacity: 0, y: -40, left: '50%', filter: 'blur(2px)' }"
      :exit="{ opacity: 0, y: -40, filter: 'blur(2px)' }"
      :transition="SPRING_BOUNCE"
      class="group fixed top-12 z-9999 -translate-x-1/2 -translate-y-1/2"
    />
  </AnimatePresence>
</template>
