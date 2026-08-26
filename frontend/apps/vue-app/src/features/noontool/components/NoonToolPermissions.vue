<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Card } from '@/components/ui/card';

const { t } = useI18n();

const topKeys = ['tabs', 'storage', 'sidePanel', 'cookies'] as const;
const allPerms = ['tabs', 'storage', 'sidePanel', 'cookies'] as const;
const hostKeys = [
  'noon',
  'noonPartners',
  'noonCdn',
  'cdn1688',
  'alicom',
  'alibabaCdn',
  'backend',
] as const;

const showFull = ref(false);
</script>

<template>
  <section aria-labelledby="permissions-heading" class="space-y-6">
    <header class="space-y-2 text-center">
      <h2
        id="permissions-heading"
        class="text-ink text-2xl font-semibold md:text-3xl"
      >
        {{ t('noonTool.permissions.sectionTitle') }}
      </h2>
      <p class="text-muted text-sm md:text-base">
        {{ t('noonTool.permissions.sectionSubtitle') }}
      </p>
    </header>

    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Card
        v-for="key in topKeys"
        :key="key"
        class="border-border/60 bg-card/70 gap-1 p-4"
      >
        <span class="text-accent text-sm font-semibold">{{
          t(`noonTool.permissions.top.${key}.name`)
        }}</span>
        <p class="text-muted text-xs leading-relaxed">
          {{ t(`noonTool.permissions.top.${key}.reason`) }}
        </p>
      </Card>
    </div>

    <div
      class="bg-card/40 border-border/60 text-ink overflow-hidden rounded-xl border text-sm"
    >
      <button
        type="button"
        class="text-muted hover:text-ink hover:bg-surface/30 flex w-full items-center gap-2 px-4 py-4 text-left font-medium transition-colors"
        :aria-expanded="showFull"
        aria-controls="full-permissions-panel"
        @click="showFull = !showFull"
      >
        <svg
          class="text-muted h-4 w-4 shrink-0 transition-transform"
          :class="{ 'rotate-180': showFull }"
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
        <span>{{ t('noonTool.permissions.fullTitle') }}</span>
      </button>
      <div
        id="full-permissions-panel"
        class="grid transition-[grid-template-rows] duration-200 ease-out"
        :class="[showFull ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]']"
      >
        <div class="min-h-0 overflow-hidden">
          <div class="grid gap-6 p-4 md:grid-cols-2">
            <div>
              <h4
                class="text-accent mb-2 text-xs font-semibold tracking-wider uppercase"
              >
                {{ t('noonTool.permissions.sectionTitle') }}
              </h4>
              <dl class="space-y-2">
                <div v-for="p in allPerms" :key="p" class="flex gap-2">
                  <dt class="text-ink shrink-0 text-xs font-semibold">
                    {{ t(`noonTool.permissions.full.permissions.${p}.name`) }}
                  </dt>
                  <dd class="text-muted text-xs leading-relaxed">
                    {{ t(`noonTool.permissions.full.permissions.${p}.reason`) }}
                  </dd>
                </div>
              </dl>
            </div>
            <div>
              <h4
                class="text-accent mb-2 text-xs font-semibold tracking-wider uppercase"
              >
                {{ t('noonTool.permissions.full.hostsTitle') }}
              </h4>
              <dl class="space-y-2">
                <div v-for="h in hostKeys" :key="h" class="flex gap-2">
                  <dt class="text-ink shrink-0 text-xs font-semibold">
                    {{ t(`noonTool.permissions.full.hosts.${h}.name`) }}
                  </dt>
                  <dd class="text-muted text-xs leading-relaxed">
                    {{ t(`noonTool.permissions.full.hosts.${h}.reason`) }}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
