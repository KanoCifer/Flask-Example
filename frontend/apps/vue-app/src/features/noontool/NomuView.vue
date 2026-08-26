<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useHead } from '@vueuse/head';
import NoonToolHero from './components/NoonToolHero.vue';
import NoonToolTrustStrip from './components/NoonToolTrustStrip.vue';
import NoonToolFeatureGrid from './components/NoonToolFeatureGrid.vue';
import NoonToolHowItWorks from './components/NoonToolHowItWorks.vue';
import NoonToolAudience from './components/NoonToolAudience.vue';
import NoonToolPrivacy from './components/NoonToolPrivacy.vue';
import NoonToolPermissions from './components/NoonToolPermissions.vue';
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
    <div class="mx-auto max-w-6xl space-y-16 px-4 py-25 md:space-y-24 md:px-8">
      <NoonToolHero />
      <NoonToolTrustStrip />
      <NoonToolPrivacy />
      <NoonToolFeatureGrid id="features" />
      <NoonToolHowItWorks id="how-it-works" />
      <NoonToolAudience />
      <NoonToolPermissions />
      <NoonToolFaq />
      <NoonToolFinalCta />
      <NoonToolFooter />
    </div>
  </div>
</template>
