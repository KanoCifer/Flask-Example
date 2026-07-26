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

// 路由 → 顶栏导航可见性：首页不显示，其他页显示
watch(
  () => route.path,
  (newPath) => {
    showBasicNav.value = newPath === '/' ? false : true;
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
