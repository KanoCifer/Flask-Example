<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { motion } from 'motion-v';
import * as LucideIcons from '@lucide/vue';
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

const pipelineSteps = [
  'capture',
  'translate',
  'image',
  'category',
  'publish',
] as const;
</script>

<template>
  <section aria-labelledby="hero-heading" class="relative overflow-hidden">
    <div class="absolute top-0 right-0 z-10">
      <NoonToolLocaleSwitch />
    </div>

    <div
      class="relative grid grid-cols-1 gap-10 pt-16 md:grid-cols-12 md:items-center md:gap-12 md:pt-20"
    >
      <motion.div
        :initial="{ opacity: 0, y: 12 }"
        :animate="{ opacity: 1, y: 0 }"
        :transition="{ duration: 0.4, ease: 'easeOut' }"
        class="space-y-6 md:col-span-7"
      >
        <div class="flex items-center gap-2">
          <img src="/icon/512.png" alt="Nomu" class="h-6 w-6 rounded-md" />
          <span class="text-ink text-base font-semibold tracking-tight"
            >Nomu</span
          >
        </div>

        <p class="text-muted text-xs font-medium tracking-widest uppercase">
          {{ t('noonTool.hero.eyebrow') }}
        </p>

        <h1
          id="hero-heading"
          class="text-ink text-5xl leading-[1.05] font-semibold md:text-7xl md:leading-[1.02]"
        >
          {{ t('noonTool.hero.headline') }}<br />
          <span class="text-accent">{{ t('noonTool.hero.headlineTail') }}</span>
        </h1>

        <p class="text-muted max-w-xl text-sm leading-relaxed md:text-base">
          {{ t('noonTool.hero.subheadline') }}
        </p>

        <!-- Pipeline-as-promise：六条工作流步骤作为品牌承诺的形状 -->
        <ol
          class="flex flex-wrap items-center gap-x-1.5 gap-y-2 text-xs md:text-sm"
          :aria-label="t('noonTool.hero.eyebrow')"
        >
          <li
            v-for="(step, i) in pipelineSteps"
            :key="step"
            class="text-muted inline-flex items-center gap-1.5 font-medium tracking-wide"
          >
            <span
              class="text-accent inline-flex size-4 shrink-0 items-center justify-center rounded-sm border border-current/30 font-mono text-[10px] tabular-nums"
            >
              {{ String(i + 1).padStart(2, '0') }}
            </span>
            <span>{{ t(`noonTool.hero.pipeline.${step}`) }}</span>
            <span
              v-if="i < pipelineSteps.length - 1"
              aria-hidden="true"
              class="text-muted/40 ml-1"
              >·</span
            >
          </li>
        </ol>

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
            href="https://kanocifer.chat/docs/"
            target="_blank"
            rel="noopener"
            class="text-muted focus-visible:ring-ring motion-safe:hover:text-ink inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <component :is="(LucideIcons as any)[icons.docs]" :size="14" />
            {{ t('noonTool.hero.ctaDocs') }}
          </a>
        </div>
      </motion.div>

      <motion.div
        :initial="{ opacity: 0, y: 16 }"
        :animate="{ opacity: 1, y: 0 }"
        :transition="{ duration: 0.4, ease: 'easeOut', delay: 0.1 }"
        class="md:col-span-5"
      >
        <NoonToolScreenshot
          videoSrc="/noontool-screens/01-hero.mp4"
          :alt="t('noonTool.hero.screenshotAlt')"
          aspect="16/10"
          :caption="t('noonTool.hero.screenshotCaption')"
        />
      </motion.div>
    </div>
  </section>
</template>
