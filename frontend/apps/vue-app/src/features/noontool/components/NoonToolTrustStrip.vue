<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Card } from '@/components/ui/card'

const { t } = useI18n()

const stats = [
  { labelKey: 'item1Label', valueKey: 'item1Value', noteKey: 'item1Note' },
  { labelKey: 'item2Label', valueKey: 'item2Value', noteKey: 'item2Note' },
  { labelKey: 'item3Label', valueKey: 'item3Value', noteKey: 'item3Note' },
] as const
</script>

<template>
  <section aria-label="NoonTool trust signals" class="grid gap-4 sm:grid-cols-3">
    <Card
      v-for="s in stats"
      :key="s.labelKey"
      class="items-center gap-1 border-border/60 bg-card/60 px-5 py-5 text-center"
    >
      <span class="text-xs uppercase tracking-wider text-muted">{{ t(`noonTool.trust.${s.labelKey}`) }}</span>
      <span class="text-3xl font-semibold text-accent">{{ t(`noonTool.trust.${s.valueKey}`) }}</span>
      <span class="text-xs text-muted">{{ t(`noonTool.trust.${s.noteKey}`) }}</span>
    </Card>
  </section>
</template>