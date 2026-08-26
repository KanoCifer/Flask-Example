<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useHead } from '@vueuse/head';
import NoonToolHero from './components/NoonToolHero.vue';
import NoonToolPositioning from './components/NoonToolPositioning.vue';
import NoonToolFeatureGrid from './components/NoonToolFeatureGrid.vue';
import NoonToolPrivacy from './components/NoonToolPrivacy.vue';
import NoonToolHowItWorks from './components/NoonToolHowItWorks.vue';
import NoonToolSupport from './components/NoonToolSupport.vue';
import NoonToolPermissions from './components/NoonToolPermissions.vue';
import NoonToolRoadmap from './components/NoonToolRoadmap.vue';
import NoonToolFaq from './components/NoonToolFaq.vue';
import NoonToolFinalCta from './components/NoonToolFinalCta.vue';
import NoonToolFooter from './components/NoonToolFooter.vue';

const { t, tm } = useI18n();

const meta = computed(() => ({
  title: t('noonTool.meta.title'),
  description: t('noonTool.meta.description'),
  keywords: (tm('noonTool.meta.keywords') as string[]).join(', '),
}));

useHead({
  title: () => meta.value.title,
  meta: () => [
    { name: 'description', content: meta.value.description },
    { name: 'keywords', content: meta.value.keywords },
    { property: 'og:title', content: meta.value.title },
    { property: 'og:description', content: meta.value.description },
    { property: 'og:type', content: 'website' },
  ],
});
</script>

<template>
  <div class="bg-page">
    <div class="mx-auto max-w-6xl space-y-20 px-4 py-12 md:space-y-28 md:px-8 md:py-20">
      <NoonToolHero />
      <NoonToolPositioning />
      <NoonToolFeatureGrid id="features" />
      <NoonToolPrivacy />
      <NoonToolHowItWorks id="how-it-works" />
      <NoonToolSupport id="support" />
      <NoonToolPermissions />
      <NoonToolRoadmap />
      <NoonToolFaq />
      <NoonToolFinalCta />
      <NoonToolFooter />
    </div>
  </div>
</template>
