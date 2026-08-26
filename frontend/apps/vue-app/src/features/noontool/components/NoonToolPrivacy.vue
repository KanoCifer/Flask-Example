<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import * as LucideIcons from '@lucide/vue';
import { icons } from '../icons';

const { t, tm } = useI18n();

const columns = [
  { key: 'local', labelKey: 'colLocal', icon: 'privacy' },
  { key: 'egress', labelKey: 'colEgress', icon: 'cta' },
  { key: 'never', labelKey: 'colNever', icon: 'faq' },
] as const;

function lines(key: string): string[] {
  return tm(`noonTool.privacy.${key}`) as string[];
}
</script>

<template>
  <section aria-labelledby="privacy-heading" class="space-y-6">
    <header class="max-w-3xl space-y-3">
      <p class="text-muted text-xs font-medium tracking-widest uppercase">
        {{ t('noonTool.privacy.eyebrow') }}
      </p>
      <h2
        id="privacy-heading"
        class="text-ink text-2xl font-semibold md:text-4xl"
      >
        {{ t('noonTool.privacy.sectionTitle') }}
      </h2>
      <p class="text-muted max-w-xl text-sm leading-relaxed md:text-base">
        {{ t('noonTool.privacy.sectionSubtitle') }}
      </p>
    </header>

    <div class="border-border/60 grid grid-cols-1 border-y md:grid-cols-3">
      <div
        v-for="(col, idx) in columns"
        :key="col.key"
        :class="[
          'flex flex-col gap-3 py-5 md:px-6',
          idx > 0 ? 'border-border/60 border-t md:border-t-0 md:border-l' : '',
        ]"
      >
        <h3
          class="text-accent flex items-center gap-2 text-sm font-semibold tracking-wide uppercase"
        >
          <span class="inline-flex size-4 shrink-0 items-center justify-center">
            <component :is="(LucideIcons as any)[icons[col.icon]]" :size="14" />
          </span>
          {{ t(`noonTool.privacy.${col.labelKey}`) }}
        </h3>
        <ul class="space-y-2 text-sm leading-relaxed">
          <li
            v-for="(line, i) in lines(col.key)"
            :key="i"
            class="text-ink flex gap-2"
          >
            <span
              aria-hidden="true"
              class="bg-accent mt-[0.55rem] inline-block size-1.5 shrink-0 rounded-full"
            />
            <span>{{ line }}</span>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
