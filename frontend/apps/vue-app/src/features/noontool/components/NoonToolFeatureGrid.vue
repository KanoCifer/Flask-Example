<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import * as LucideIcons from '@lucide/vue';
import { icons, type IconKey } from '../icons';
import NoonToolScreenshot from './NoonToolScreenshot.vue';

const { t } = useI18n();

type FeatureKey = Extract<
  IconKey,
  'pipeline' | 'multiAccount' | 'translate' | 'image' | 'serial' | 'ai'
>;

const featureKeys: FeatureKey[] = [
  'pipeline',
  'multiAccount',
  'translate',
  'image',
  'serial',
  'ai',
];

const featureImages: Record<FeatureKey, string> = {
  pipeline: '/noontool-screens/02-feature-pipeline.png',
  multiAccount: '/noontool-screens/03-feature-multiAccount.png',
  translate: '/noontool-screens/04-feature-translate.png',
  image: '/noontool-screens/05-feature-image.png',
  serial: '/noontool-screens/06-feature-serial.png',
  ai: '/noontool-screens/07-feature-ai.png',
};

const featureVideos: Partial<Record<FeatureKey, string>> = {
  multiAccount: '/noontool-screens/03-feature-multiAccount.mov',
};
</script>

<template>
  <section
    :id="$attrs.id as string"
    aria-labelledby="features-heading"
    class="space-y-10"
  >
    <header class="max-w-3xl space-y-3">
      <p class="text-muted text-xs font-medium tracking-widest uppercase">
        {{ t('noonTool.features.eyebrow') }}
      </p>
      <h2
        id="features-heading"
        class="text-ink text-2xl font-semibold md:text-4xl"
      >
        {{ t('noonTool.features.sectionTitle') }}
      </h2>
      <p class="text-muted max-w-xl text-sm leading-relaxed md:text-base">
        {{ t('noonTool.features.sectionSubtitle') }}
      </p>
    </header>

    <ul
      class="divide-border/60 border-border/60 grid grid-cols-1 divide-y border-y sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-3"
    >
      <li
        v-for="(key, idx) in featureKeys"
        :key="key"
        class="border-border/60 flex flex-col gap-3 py-6 sm:border-b sm:last:border-b-0 md:px-6 lg:[&:not(:nth-child(3n+1))]:border-l lg:[&:nth-child(-n+3)]:border-b-0"
      >
        <div class="flex items-center gap-2.5">
          <span
            class="text-accent inline-flex size-5 shrink-0 items-center justify-center"
          >
            <component :is="(LucideIcons as any)[icons[key]]" :size="16" />
          </span>
          <h3 class="text-ink text-base font-semibold">
            {{ t(`noonTool.features.items.${key}.title`) }}
          </h3>
          <span class="text-muted ml-auto text-xs tabular-nums">
            {{ String(idx + 1).padStart(2, '0') }}
          </span>
        </div>
        <p class="text-muted text-sm leading-relaxed">
          {{ t(`noonTool.features.items.${key}.body`) }}
        </p>
        <NoonToolScreenshot
          class="mt-auto"
          :src="featureImages[key]"
          :video-src="featureVideos[key]"
          :alt="t('noonTool.features.items.' + key + '.imageAlt')"
          aspect="3/2"
        />
      </li>
    </ul>
  </section>
</template>

<script lang="ts">
export default { inheritAttrs: false };
</script>
