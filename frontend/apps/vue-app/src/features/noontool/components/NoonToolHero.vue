<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { motion } from 'motion-v';
import NoonToolLocaleSwitch from './NoonToolLocaleSwitch.vue';
import NoonToolScreenshot from './NoonToolScreenshot.vue';

const { t } = useI18n();
</script>

<template>
  <section aria-labelledby="hero-heading" class="relative">
    <div class="absolute top-0 right-0 z-10">
      <NoonToolLocaleSwitch />
    </div>

    <motion.div
      :initial="{ opacity: 0, y: 12 }"
      :animate="{ opacity: 1, y: 0 }"
      :transition="{ duration: 0.4, ease: 'easeOut' }"
      class="grid gap-10 pt-16 md:grid-cols-[1.1fr_1fr] md:gap-12 md:pt-12"
    >
      <div class="flex flex-col gap-5">
        <div class="flex items-center gap-3">
          <img
            src="/logo/logo.png"
            alt="NoonTool logo"
            width="40"
            height="40"
            class="size-10 rounded-lg object-contain"
          />
          <span class="text-muted text-xs font-medium tracking-wider uppercase">
            {{ t('noonTool.hero.eyebrow') }}
          </span>
        </div>

        <h1
          id="hero-heading"
          class="text-ink text-4xl leading-tight font-semibold md:text-5xl"
        >
          {{ t('noonTool.hero.headline') }}
        </h1>

        <p class="text-muted max-w-xl text-sm leading-relaxed md:text-base">
          {{ t('noonTool.hero.subheadline') }}
        </p>

        <div class="flex flex-wrap items-center gap-3 pt-2">
          <a
            href="#"
            aria-disabled="true"
            :title="t('noonTool.hero.ctaPrimaryHint')"
            class="bg-accent text-contrast focus-visible:ring-ring inline-flex cursor-not-allowed items-center justify-center rounded-xl px-5 py-2.5 text-sm font-medium opacity-60 shadow-sm transition-opacity focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none motion-safe:hover:opacity-70"
            @click.prevent
          >
            {{ t('noonTool.hero.ctaPrimary') }}
          </a>
          <a
            href="#how-it-works"
            class="border-border bg-card text-ink motion-safe:hover:bg-surface focus-visible:ring-ring inline-flex items-center justify-center rounded-xl border px-5 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {{ t('noonTool.hero.ctaSecondary') }}
          </a>
        </div>
      </div>

      <div>
        <NoonToolScreenshot
          videoSrc="/noontool-screens/01-hero.mp4"
          :alt="t('noonTool.hero.screenshotAlt')"
          aspect="16/10"
          :caption="t('noonTool.hero.screenshotCaption')"
        />
      </div>
    </motion.div>
  </section>
</template>
