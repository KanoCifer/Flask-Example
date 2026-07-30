<template>
  <!-- Cookie consent (顶层 Teleport 到 body) -->
  <Teleport to="body">
    <CookieConsent />
  </Teleport>

  <!-- Toast container -->
  <Teleport to="body">
    <ToastContainer />
  </Teleport>

  <!-- Feature overlays -->
  <Teleport to="body">
    <DynamicIsland />
  </Teleport>
</template>

<script setup lang="ts">
import CookieConsent from '@/layouts/components/CookieConsent.vue';
import ToastContainer from '@/layouts/components/ToastContainer.vue';
import DynamicIsland from '@/layouts/components/DynamicIsland.vue';
</script>
