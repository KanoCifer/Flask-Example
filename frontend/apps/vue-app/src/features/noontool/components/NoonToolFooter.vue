<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import * as LucideIcons from '@lucide/vue';
import { icons } from '../icons';

const { t } = useI18n();

const year = new Date().getFullYear();

// 线上文档站（VitePress），base 为 /docs/
const DOCS_URL = 'https://kanocifer.chat/docs/';
</script>

<template>
  <footer class="border-border/40 text-muted border-t pt-6 text-xs">
    <div class="flex flex-col items-center justify-between gap-3 md:flex-row">
      <div class="flex items-center gap-2">
        <img src="/icon/512.png" alt="Nomu" class="h-4 w-4 rounded-sm" />
        <span>{{ t('noonTool.footer.tagline') }}</span>
      </div>
      <nav class="flex gap-4">
        <a
          :href="DOCS_URL + 'privacy/'"
          class="hover:text-ink inline-flex items-center gap-1 transition-colors"
        >
          <component :is="(LucideIcons as any)[icons.privacy]" :size="12" />
          {{ t('noonTool.footer.links.privacy') }}
        </a>
        <a
          :href="DOCS_URL + 'guide/changelog'"
          class="hover:text-ink inline-flex items-center gap-1 transition-colors"
        >
          <component :is="(LucideIcons as any)[icons.faq]" :size="12" />
          {{ t('noonTool.footer.links.changelog') }}
        </a>
        <a
          :href="DOCS_URL + 'guide/support'"
          class="hover:text-ink inline-flex items-center gap-1 transition-colors"
        >
          <component :is="(LucideIcons as any)[icons.support]" :size="12" />
          {{ t('noonTool.footer.links.support') }}
        </a>
        <a
          :href="DOCS_URL"
          class="hover:text-ink inline-flex items-center gap-1 transition-colors"
        >
          <component :is="(LucideIcons as any)[icons.docs]" :size="12" />
          {{ t('noonTool.footer.links.docs') }}
        </a>
      </nav>
      <p>{{ t('noonTool.footer.license') }} · © {{ year }}</p>
    </div>
  </footer>
</template>
