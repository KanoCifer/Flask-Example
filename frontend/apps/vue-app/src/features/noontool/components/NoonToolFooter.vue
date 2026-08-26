<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const year = new Date().getFullYear();

// 线上文档站（VitePress），base 为 /docs/
const DOCS_URL = 'https://kanocifer.chat/docs/';
</script>

<template>
  <footer class="border-border/40 text-muted border-t pt-6 text-xs">
    <div class="flex flex-col items-center justify-between gap-3 md:flex-row">
      <p>{{ t('noonTool.footer.tagline') }}</p>
      <nav class="flex gap-4">
        <a
          :href="DOCS_URL + 'privacy/'"
          class="hover:text-ink transition-colors"
        >
          {{ t('noonTool.footer.links.privacy') }}
        </a>
        <a
          :href="DOCS_URL + 'guide/changelog'"
          class="hover:text-ink transition-colors"
        >
          {{ t('noonTool.footer.links.changelog') }}
        </a>
        <a :href="DOCS_URL" class="hover:text-ink transition-colors">
          {{ t('noonTool.footer.links.docs') }}
        </a>
      </nav>
      <p>{{ t('noonTool.footer.license') }} · © {{ year }}</p>
    </div>
  </footer>
</template>
