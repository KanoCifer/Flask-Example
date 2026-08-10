<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const items = [
  'free',
  'apiKey',
  'regions',
  'sources',
  'data',
  'translation',
  'failure',
] as const;

const openKeys = ref<string[]>([]);

function toggle(key: string) {
  openKeys.value = openKeys.value.includes(key)
    ? openKeys.value.filter((k) => k !== key)
    : [...openKeys.value, key];
}
</script>

<template>
  <section aria-labelledby="faq-heading" class="space-y-6">
    <header class="text-center">
      <h2 id="faq-heading" class="text-ink text-2xl font-semibold md:text-3xl">
        {{ t('noonTool.faq.sectionTitle') }}
      </h2>
    </header>

    <div class="mx-auto max-w-3xl space-y-3">
      <div
        v-for="key in items"
        :key="key"
        class="bg-card/40 border-border/60 overflow-hidden rounded-xl border transition-colors"
        :class="{ 'bg-card/70': openKeys.includes(key) }"
      >
        <button
          type="button"
          class="hover:bg-surface/30 text-ink flex w-full items-center gap-2 px-4 py-4 text-left font-medium transition-colors"
          :aria-expanded="openKeys.includes(key)"
          :aria-controls="`faq-${key}-panel`"
          @click="toggle(key)"
        >
          <svg
            class="text-muted h-4 w-4 shrink-0 transition-transform"
            :class="{ 'rotate-180': openKeys.includes(key) }"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
          <span>{{ t(`noonTool.faq.items.${key}.q`) }}</span>
        </button>
        <div
          :id="`faq-${key}-panel`"
          class="grid transition-[grid-template-rows] duration-200 ease-out"
          :class="[
            openKeys.includes(key) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          ]"
        >
          <div class="min-h-0 overflow-hidden">
            <p class="text-muted px-4 pb-4 leading-relaxed">
              {{ t(`noonTool.faq.items.${key}.a`) }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
