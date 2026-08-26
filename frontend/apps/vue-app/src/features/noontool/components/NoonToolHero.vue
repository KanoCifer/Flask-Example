<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { motion } from 'motion-v';
import * as LucideIcons from '@lucide/vue';
import { Button as UiButton } from '@/components';
import { icons } from '../icons';
import NoonToolLocaleSwitch from './NoonToolLocaleSwitch.vue';
import NoonToolScreenshot from './NoonToolScreenshot.vue';

const { t } = useI18n();

// public/nomu-*.zip 由扩展仓库构建产物拷入，文件名带版本号
const modules = import.meta.glob('/public/nomu-*.zip', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const downloadHref = Object.values(modules)[0] ?? '#';
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
      class="relative space-y-5 pt-16 md:max-w-3xl md:pt-20"
    >
      <div class="flex items-center gap-2">
        <img src="/icon/512.png" alt="Nomu" class="h-7 w-7 rounded-md" />
        <span class="text-ink text-base font-semibold tracking-tight"
          >Nomu</span
        >
      </div>

      <p class="text-muted text-xs font-medium tracking-wider uppercase">
        {{ t('noonTool.hero.eyebrow') }}
      </p>

      <h1
        id="hero-heading"
        class="text-ink text-4xl leading-snug font-semibold md:text-6xl md:leading-tight"
      >
        {{ t('noonTool.hero.headline') }}<br />
        <span class="text-accent">{{ t('noonTool.hero.headlineTail') }}</span>
      </h1>

      <p class="text-muted max-w-xl text-sm leading-relaxed md:text-base">
        {{ t('noonTool.hero.subheadline') }}
      </p>

      <div class="flex flex-wrap items-center gap-3 pt-2">
        <UiButton
          as="a"
          variant="default"
          :href="downloadHref"
          download
          class="gap-2 px-5 py-2.5 shadow-sm"
        >
          <component :is="(LucideIcons as any)[icons.cta]" :size="16" />
          {{ t('noonTool.hero.ctaPrimary') }}
        </UiButton>
        <UiButton
          as="a"
          variant="outline"
          href="#features"
          class="px-5 py-2.5"
        >
          {{ t('noonTool.hero.ctaSecondary') }}
        </UiButton>
        <UiButton
          as="a"
          variant="ghost"
          href="https://kanocifer.chat/docs/"
          target="_blank"
          rel="noopener"
          class="gap-1.5 px-2 py-2.5"
        >
          <component :is="(LucideIcons as any)[icons.docs]" :size="14" />
          {{ t('noonTool.hero.ctaDocs') }}
        </UiButton>
      </div>

      <p class="text-muted pt-1 text-xs">{{ t('noonTool.trust.motto') }}</p>

      <img
        src="/icon/512.png"
        alt="Nomu logo"
        class="absolute top-3/5 -right-70 size-64 -translate-y-1/2 transform"
      />
    </motion.div>

    <div class="mt-10 md:mt-14">
      <NoonToolScreenshot
        videoSrc="/noontool-screens/01-hero.mp4"
        :alt="t('noonTool.hero.screenshotAlt')"
        aspect="16/10"
        :caption="t('noonTool.hero.screenshotCaption')"
      />
    </div>
  </section>
</template>
