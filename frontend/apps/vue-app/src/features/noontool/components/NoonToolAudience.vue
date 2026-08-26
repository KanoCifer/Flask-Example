<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <section
    aria-labelledby="audience-heading"
    class="border-border/60 border-y py-4"
  >
    <p
      id="audience-heading"
      class="text-muted text-center text-xs font-medium tracking-widest uppercase md:text-sm"
    >
      {{ t('noonTool.audience.motto') }}
    </p>
  </section>
</template>
