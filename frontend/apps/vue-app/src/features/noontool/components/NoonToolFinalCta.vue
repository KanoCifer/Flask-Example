<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'

const { t } = useI18n()
</script>

<template>
  <section aria-labelledby="final-cta-heading" class="text-center">
    <div class="mx-auto max-w-2xl space-y-4 rounded-3xl border border-accent/30 bg-accent/5 p-8 md:p-12">
      <h2 id="final-cta-heading" class="text-2xl font-semibold text-ink md:text-3xl">
        {{ t('noonTool.finalCta.title') }}
      </h2>
      <p class="text-sm text-muted md:text-base">{{ t('noonTool.finalCta.body') }}</p>
      <div class="flex justify-center pt-2">
        <a
          href="#"
          aria-disabled="true"
          :title="t('noonTool.finalCta.hint')"
          class="inline-flex cursor-not-allowed items-center justify-center rounded-xl bg-accent px-6 py-3 text-sm font-medium text-contrast opacity-60 shadow-sm transition-opacity motion-safe:hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          @click.prevent
        >
          {{ t('noonTool.finalCta.button') }}
        </a>
      </div>
      <Button
        variant="ghost"
        size="sm"
        disabled
        class="!cursor-not-allowed"
        :aria-label="t('noonTool.finalCta.hint')"
      >
        {{ t('noonTool.finalCta.hint') }}
      </Button>
    </div>
  </section>
</template>