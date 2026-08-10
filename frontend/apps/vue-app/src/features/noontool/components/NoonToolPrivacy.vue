<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t, tm } = useI18n()

const columns = [
  { key: 'local', labelKey: 'colLocal', accent: 'bg-card text-ink' },
  { key: 'egress', labelKey: 'colEgress', accent: 'bg-accent/10 text-ink' },
  { key: 'never', labelKey: 'colNever', accent: 'bg-card text-ink' },
] as const

function lines(key: string): string[] {
  return tm(`noonTool.privacy.${key}`) as string[]
}
</script>

<template>
  <section aria-labelledby="privacy-heading" class="space-y-6">
    <header class="space-y-2 text-center">
      <h2 id="privacy-heading" class="text-2xl font-semibold text-ink md:text-3xl">
        {{ t('noonTool.privacy.sectionTitle') }}
      </h2>
      <p class="text-sm text-muted md:text-base">{{ t('noonTool.privacy.sectionSubtitle') }}</p>
    </header>

    <div class="overflow-hidden rounded-2xl border border-border/60 shadow-sm">
      <div class="grid grid-cols-1 md:grid-cols-3">
        <div
          v-for="col in columns"
          :key="col.key"
          :class="['flex flex-col gap-3 p-5 md:p-6', col.accent]"
        >
          <h3 class="text-sm font-semibold uppercase tracking-wider text-accent">
            {{ t(`noonTool.privacy.${col.labelKey}`) }}
          </h3>
          <ul class="space-y-2 text-sm leading-relaxed">
            <li
              v-for="(line, i) in lines(col.key)"
              :key="i"
              class="flex gap-2"
            >
              <span aria-hidden="true" class="mt-1 inline-block size-1.5 shrink-0 rounded-full bg-accent/60" />
              <span>{{ line }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>