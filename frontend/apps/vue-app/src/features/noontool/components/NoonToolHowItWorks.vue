<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { Card } from '@/components/ui/card';
import NoonToolScreenshot from './NoonToolScreenshot.vue';

const { t } = useI18n();

const steps = ['capture', 'confirm', 'publish'] as const;
</script>

<template>
  <section
    :id="$attrs.id as string"
    aria-labelledby="how-heading"
    class="space-y-6"
  >
    <header class="text-center">
      <h2 id="how-heading" class="text-ink text-2xl font-semibold md:text-3xl">
        {{ t('noonTool.how.sectionTitle') }}
      </h2>
    </header>

    <ol class="grid gap-4 md:grid-cols-3">
      <Card
        v-for="(step, idx) in steps"
        :key="step"
        class="border-border/60 bg-card/70 gap-3 p-5"
      >
        <span class="text-muted text-xs tracking-wider uppercase">{{
          String(idx + 1).padStart(2, '0')
        }}</span>
        <h3 class="text-ink text-lg font-semibold">
          {{ t(`noonTool.how.steps.${step}.title`) }}
        </h3>
        <p class="text-muted text-sm leading-relaxed">
          {{ t(`noonTool.how.steps.${step}.body`) }}
        </p>
      </Card>
    </ol>

    <NoonToolScreenshot
      video-src="/noontool-screens/01-hero.mp4"
      :alt="t('noonTool.how.imageAlt')"
      aspect="2/1"
      :caption="t('noonTool.hero.screenshotCaption')"
    />
  </section>
</template>

<script lang="ts">
export default { inheritAttrs: false };
</script>
