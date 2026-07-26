<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  BackdropLayer,
  FooterToggle,
  GlobalOverlays,
  Header,
} from './components';
import { RouteTransition } from './components';

const route = useRoute();
const router = useRouter();
const isEntryView = computed(() => route.path === '/');

function handleRequestLogin() {
  router.push('/login');
}
</script>

<template>
  <div
    class="relative isolate"
    :class="
      isEntryView
        ? 'flex min-h-dvh flex-col'
        : 'grid min-h-dvh grid-rows-[auto_1fr_auto]'
    "
  >
    <BackdropLayer :is-entry-view="isEntryView" />
    <Header />
    <main class="relative flex-1 scroll-smooth">
      <RouteTransition />
    </main>
    <FooterToggle :is-entry-view="isEntryView" />
    <GlobalOverlays @requestLogin="handleRequestLogin" />
  </div>
</template>
