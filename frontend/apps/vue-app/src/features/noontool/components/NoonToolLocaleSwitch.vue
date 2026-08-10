<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'

const { t, locale, availableLocales } = useI18n()

const options = computed(() =>
  availableLocales.map((l) => ({
    code: l,
    label: l === 'zh-CN' ? t('noonTool.hero.localeZh') : t('noonTool.hero.localeEn'),
  })),
)

function pick(code: string) {
  locale.value = code as typeof locale.value
}
</script>

<template>
  <div
    role="group"
    :aria-label="t('noonTool.hero.localeZh') + ' / ' + t('noonTool.hero.localeEn')"
    class="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/70 p-1 shadow-sm backdrop-blur"
  >
    <Button
      v-for="opt in options"
      :key="opt.code"
      variant="ghost"
      size="sm"
      :class="[
        '!rounded-full !px-3 !py-1 !text-xs',
        locale === opt.code
          ? '!bg-accent !text-contrast shadow-sm'
          : '!bg-transparent !text-muted hover:!text-ink',
      ]"
      :aria-pressed="locale === opt.code"
      @click="pick(opt.code)"
    >
      {{ opt.label }}
    </Button>
  </div>
</template>