<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import * as LucideIcons from '@lucide/vue';
import { icons, type IconKey } from '../icons';

const { t } = useI18n();

type RoadmapKey = Extract<
  IconKey,
  'roadmapSources' | 'roadmapEgypt' | 'roadmapTemplates' | 'roadmapBatch'
>;

const itemKeys: RoadmapKey[] = [
  'roadmapSources',
  'roadmapEgypt',
  'roadmapTemplates',
  'roadmapBatch',
];

const iconForKey: Record<RoadmapKey, IconKey> = {
  roadmapSources: 'roadmapSources',
  roadmapEgypt: 'roadmapEgypt',
  roadmapTemplates: 'roadmapTemplates',
  roadmapBatch: 'roadmapBatch',
};

const titleForKey: Record<RoadmapKey, string> = {
  roadmapSources: 'sources',
  roadmapEgypt: 'egypt',
  roadmapTemplates: 'templates',
  roadmapBatch: 'batchEdit',
};
</script>

<template>
  <section aria-labelledby="roadmap-heading" class="space-y-10">
    <header class="max-w-3xl space-y-3">
      <p class="text-muted text-xs font-medium tracking-widest uppercase">
        {{ t('noonTool.roadmap.eyebrow') }}
      </p>
      <h2
        id="roadmap-heading"
        class="text-ink text-3xl leading-tight font-semibold md:text-5xl"
      >
        {{ t('noonTool.roadmap.sectionTitle') }}
      </h2>
      <p class="text-muted max-w-xl text-sm leading-relaxed md:text-base">
        {{ t('noonTool.roadmap.sectionSubtitle') }}
      </p>
    </header>

    <ul
      class="divide-border/60 border-border/60 grid grid-cols-1 divide-y border-y sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4"
    >
      <li
        v-for="key in itemKeys"
        :key="key"
        class="border-border/60 flex flex-col gap-3 py-6 sm:border-b sm:last:border-b-0 md:px-6 lg:[&:not(:nth-child(4n+1))]:border-l lg:[&:nth-child(-n+4)]:border-b-0"
      >
        <div class="flex items-center gap-2.5">
          <span
            class="text-accent bg-accent/10 inline-flex size-7 shrink-0 items-center justify-center rounded-md"
          >
            <component
              :is="(LucideIcons as any)[icons[iconForKey[key]]]"
              :size="14"
              :stroke-width="1.75"
            />
          </span>
          <h3 class="text-ink text-base font-semibold">
            {{ t(`noonTool.roadmap.items.${titleForKey[key]}.title`) }}
          </h3>
        </div>
        <p class="text-muted text-sm leading-relaxed">
          {{ t(`noonTool.roadmap.items.${titleForKey[key]}.body`) }}
        </p>
        <span
          class="text-muted mt-auto inline-flex w-fit items-center gap-1.5 text-xs font-medium tracking-wide uppercase"
        >
          <span class="bg-muted/40 inline-block size-1.5 rounded-full" />
          {{ t('noonTool.roadmap.status') }}
        </span>
      </li>
    </ul>
  </section>
</template>