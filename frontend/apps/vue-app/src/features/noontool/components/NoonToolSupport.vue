<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import * as LucideIcons from '@lucide/vue';
import { icons } from '../icons';

const { t } = useI18n();

// 文档站（VitePress），base 为 /docs/
const DOCS_URL = 'https://kanocifer.chat/docs/';

const channelKeys = ['wechat', 'docs', 'github'] as const;
</script>

<template>
  <section
    :id="$attrs.id as string"
    aria-labelledby="support-heading"
    class="space-y-6"
  >
    <header class="max-w-3xl space-y-3">
      <p class="text-muted text-xs font-medium tracking-widest uppercase">
        {{ t('noonTool.support.eyebrow') }}
      </p>
      <h2
        id="support-heading"
        class="text-ink text-3xl leading-tight font-semibold md:text-5xl"
      >
        {{ t('noonTool.support.sectionTitle') }}
      </h2>
      <p class="text-muted max-w-xl text-sm leading-relaxed md:text-base">
        {{ t('noonTool.support.sectionSubtitle') }}
      </p>
    </header>

    <ul
      class="divide-border/60 border-border/60 grid grid-cols-1 divide-y border-y md:grid-cols-3"
    >
      <li
        v-for="(key, idx) in channelKeys"
        :key="key"
        class="flex flex-col gap-3 py-6 md:px-6"
        :class="idx > 0 ? 'md:border-border/60 md:border-l' : ''"
      >
        <span
          class="text-accent bg-accent/10 inline-flex size-7 shrink-0 items-center justify-center rounded-md"
        >
          <component :is="(LucideIcons as any)[icons[key]]" :size="14" :stroke-width="1.75" />
        </span>
        <h3 class="text-ink text-base font-semibold">
          {{ t(`noonTool.support.channels.${key}.title`) }}
        </h3>
        <p class="text-muted text-sm leading-relaxed">
          {{ t(`noonTool.support.channels.${key}.body`) }}
        </p>
        <!-- 微信渠道跳到文档站的获取支持页（二维码只放文档站） -->
        <a
          v-if="key === 'wechat'"
          :href="DOCS_URL + 'guide/support'"
          class="text-accent inline-flex items-center gap-1 text-sm font-medium hover:underline"
        >
          {{ t('noonTool.support.viewQr') }}
          <component :is="(LucideIcons as any)[icons.footerLink]" :size="14" />
        </a>
      </li>
    </ul>
  </section>
</template>

<script lang="ts">
export default { inheritAttrs: false };
</script>
