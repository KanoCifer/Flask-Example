<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Card } from '@/components/ui/card'

const { t } = useI18n()
</script>

<template>
  <section aria-labelledby="audience-heading">
    <Card class="gap-3 border-accent/30 bg-accent/5 p-6 md:p-8">
      <h2 id="audience-heading" class="text-xl font-semibold text-ink md:text-2xl">
        {{ t('noonTool.audience.title') }}
      </h2>
      <p class="max-w-3xl text-sm leading-relaxed text-muted md:text-base">
        {{ t('noonTool.audience.body') }}
      </p>
    </Card>
  </section>
</template>