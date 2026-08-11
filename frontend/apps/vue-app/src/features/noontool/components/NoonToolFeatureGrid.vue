<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import * as LucideIcons from '@lucide/vue';
import { Card } from '@/components/ui/card';
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
    class="space-y-6"
  >
    <header class="space-y-2 text-center">
      <h2
        id="features-heading"
        class="text-ink text-2xl font-semibold md:text-3xl"
      >
        {{ t('noonTool.features.sectionTitle') }}
      </h2>
      <p class="text-muted text-sm md:text-base">
        {{ t('noonTool.features.sectionSubtitle') }}
      </p>
    </header>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Card
        v-for="key in featureKeys"
        :key="key"
        class="border-border/60 bg-card/70 gap-4 p-5 shadow-sm transition-shadow motion-safe:hover:shadow-md"
      >
        <div class="flex items-start gap-3">
          <span
            class="bg-accent/15 text-accent inline-flex size-9 shrink-0 items-center justify-center rounded-lg"
          >
            <component :is="(LucideIcons as any)[icons[key]]" :size="18" />
          </span>
          <h3 class="text-ink text-base font-semibold">
            {{ t(`noonTool.features.items.${key}.title`) }}
          </h3>
        </div>
        <p class="text-muted text-sm leading-relaxed">
          {{ t(`noonTool.features.items.${key}.body`) }}
        </p>
        <NoonToolScreenshot
          :src="featureImages[key]"
          :video-src="featureVideos[key]"
          :alt="t('noonTool.features.items.' + key + '.imageAlt')"
          aspect="3/2"
        />
      </Card>
    </div>
  </section>
</template>

<script lang="ts">
export default { inheritAttrs: false };
</script>
