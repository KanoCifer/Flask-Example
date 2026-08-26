<script setup lang="ts">
import { useI18n } from 'vue-i18n';
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
    <header class="max-w-3xl space-y-3">
      <p class="text-muted text-xs font-medium tracking-widest uppercase">
        {{ t('noonTool.how.eyebrow') }}
      </p>
      <h2 id="how-heading" class="text-ink text-2xl font-semibold md:text-4xl">
        {{ t('noonTool.how.sectionTitle') }}
      </h2>
    </header>

    <ol
      class="divide-border/60 border-border/60 grid grid-cols-1 divide-y border-y md:grid-cols-3"
    >
      <li
        v-for="(step, idx) in steps"
        :key="step"
        class="flex flex-col gap-3 py-6 md:px-6"
        :class="idx > 0 ? 'md:border-border/60 md:border-l' : ''"
      >
        <span class="text-accent text-sm font-semibold tabular-nums">{{
          String(idx + 1).padStart(2, '0')
        }}</span>
        <h3 class="text-ink text-lg font-semibold">
          {{ t(`noonTool.how.steps.${step}.title`) }}
        </h3>
        <p class="text-muted text-sm leading-relaxed">
          {{ t(`noonTool.how.steps.${step}.body`) }}
        </p>
      </li>
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
