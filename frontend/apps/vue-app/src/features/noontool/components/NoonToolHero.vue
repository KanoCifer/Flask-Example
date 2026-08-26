<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { motion } from 'motion-v';
import * as LucideIcons from '@lucide/vue';
import { icons } from '../icons';
import NoonToolLocaleSwitch from './NoonToolLocaleSwitch.vue';
import NoonToolScreenshot from './NoonToolScreenshot.vue';

const { t } = useI18n();

// 线上文档站（VitePress），base 为 /docs/
const DOCS_URL = 'https://kanocifer.chat/docs/';

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
      class="space-y-5 pt-16 md:max-w-3xl md:pt-20"
    >
      <img
        src="/logo/logo.png"
        alt="Nomu"
        width="64"
        height="64"
        class="rounded-2xl shadow-sm"
      />

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
        <a
          :href="downloadHref"
          download
          class="bg-accent text-contrast focus-visible:ring-ring inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium shadow-sm transition-transform focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.98]"
        >
          <component :is="(LucideIcons as any)[icons.cta]" :size="16" />
          {{ t('noonTool.hero.ctaPrimary') }}
        </a>
        <a
          href="#features"
          class="border-border bg-card text-ink focus-visible:ring-ring motion-safe:hover:bg-surface inline-flex items-center justify-center rounded-xl border px-5 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.98]"
        >
          {{ t('noonTool.hero.ctaSecondary') }}
        </a>
        <a
          :href="DOCS_URL"
          target="_blank"
          rel="noopener"
          class="text-muted focus-visible:ring-ring motion-safe:hover:text-ink inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <component :is="(LucideIcons as any)[icons.docs]" :size="16" />
          {{ t('noonTool.hero.ctaTertiary') }}
        </a>
      </div>

      <p class="text-muted pt-1 text-xs">{{ t('noonTool.hero.trustLine') }}</p>
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
