<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <section
    aria-label="NoonTool trust signals"
    class="border-border/60 border-y py-4"
  >
    <p
      class="text-muted text-center text-xs font-medium tracking-widest uppercase md:text-sm"
    >
      {{ t('noonTool.trust.motto') }}
    </p>
  </section>
</template>
