<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import * as LucideIcons from '@lucide/vue';
import { icons } from '../icons';

const { t } = useI18n();
const year = new Date().getFullYear();

// 与 Hero 同源：public/nomu-*.zip 构建产物，文件名带版本号
const modules = import.meta.glob('/public/nomu-*.zip', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const downloadHref = Object.values(modules)[0] ?? '#';
</script>

<template>
  <section aria-labelledby="final-cta-heading" class="text-center">
    <div class="mx-auto max-w-2xl space-y-4 py-10">
      <div class="flex items-center justify-center gap-2">
        <img src="/icon/512.png" alt="Nomu" class="h-8 w-8 rounded-md" />
        <span class="text-ink text-lg font-semibold tracking-tight">Nomu</span>
      </div>
      <h2
        id="final-cta-heading"
        class="text-ink text-2xl font-semibold md:text-4xl md:leading-tight"
      >
        {{ t('noonTool.finalCta.title') }}
      </h2>
      <p
        class="text-muted mx-auto max-w-xl text-sm leading-relaxed md:text-base"
      >
        {{ t('noonTool.finalCta.body') }}
      </p>
      <div class="flex justify-center pt-2">
        <a
          :href="downloadHref"
          download
          class="bg-accent text-contrast focus-visible:ring-ring inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-medium shadow-sm transition-transform focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.98]"
        >
          <component :is="(LucideIcons as any)[icons.cta]" :size="16" />
          {{ t('noonTool.finalCta.button') }}
        </a>
      </div>
      <p class="text-muted pt-1 text-xs">
        {{ t('noonTool.footer.license') }} · © {{ year }}
      </p>
    </div>
  </section>
</template>
