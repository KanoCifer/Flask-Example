<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const claims = ['claim1', 'claim2', 'claim3'] as const;
</script>

<template>
  <section
    aria-label="NoonTool positioning"
    class="border-border/60 border-y py-3"
  >
    <ul
      class="text-muted flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium tracking-wide md:text-sm"
    >
      <li
        v-for="(c, i) in claims"
        :key="c"
        class="inline-flex items-center gap-3"
      >
        <span class="flex items-center gap-2">
          <span class="text-accent inline-block size-1.5 rounded-full" />
          {{ t(`noonTool.positioning.${c}`) }}
        </span>
        <span
          v-if="i < claims.length - 1"
          aria-hidden="true"
          class="text-muted/40"
        >·</span>
      </li>
    </ul>
  </section>
</template>