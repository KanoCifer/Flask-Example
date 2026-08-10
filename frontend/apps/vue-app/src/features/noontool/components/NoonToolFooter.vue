<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const year = new Date().getFullYear()
</script>

<template>
  <footer class="border-t border-border/40 pt-6 text-xs text-muted">
    <div class="flex flex-col items-center justify-between gap-3 md:flex-row">
      <p>{{ t('noonTool.footer.tagline') }}</p>
      <nav class="flex gap-4">
        <a href="#" class="transition-colors hover:text-ink" @click.prevent>
          {{ t('noonTool.footer.links.privacy') }}
        </a>
        <a href="#" class="transition-colors hover:text-ink" @click.prevent>
          {{ t('noonTool.footer.links.source') }}
        </a>
        <a href="#" class="transition-colors hover:text-ink" @click.prevent>
          {{ t('noonTool.footer.links.contact') }}
        </a>
      </nav>
      <p>{{ t('noonTool.footer.license') }} · © {{ year }}</p>
    </div>
  </footer>
</template>