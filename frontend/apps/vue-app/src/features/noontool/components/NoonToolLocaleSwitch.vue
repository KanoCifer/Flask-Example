<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { motion } from 'motion-v';

const { t, locale, availableLocales } = useI18n();

const options = computed(() =>
  availableLocales.map((l) => ({
    code: l,
    label:
      l === 'zh-CN' ? t('noonTool.hero.localeZh') : t('noonTool.hero.localeEn'),
  })),
);

// observer-driven indicator: measure each option's actual rendered position
// and width, so the indicator follows perfectly even when labels reflow.
const trackRef = ref<HTMLElement | null>(null);
const optionRefs = ref<Record<string, HTMLElement | null>>({});
const indicator = ref({ x: 0, width: 0 });

function setOptionRef(code: string) {
  return (el: Element | null) => {
    if (el) optionRefs.value[code] = el as HTMLElement;
    else delete optionRefs.value[code];
  };
}

function measure() {
  const track = trackRef.value;
  const active = optionRefs.value[locale.value];
  if (!track || !active) return;
  const trackRect = track.getBoundingClientRect();
  const activeRect = active.getBoundingClientRect();
  indicator.value = {
    x: activeRect.left - trackRect.left,
    width: activeRect.width,
  };
}

let resizeObserver: ResizeObserver | null = null;
let mutationObserver: MutationObserver | null = null;

function startObservers() {
  const track = trackRef.value;
  if (!track) return;

  resizeObserver?.disconnect();
  resizeObserver = new ResizeObserver(() => measure());
  resizeObserver.observe(track);
  for (const el of Object.values(optionRefs.value)) {
    if (el) resizeObserver.observe(el);
  }

  // locale label switch is just a re-render — listen for that too
  mutationObserver?.disconnect();
  mutationObserver = new MutationObserver(() => measure());
  mutationObserver.observe(track, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  measure();
}

watch(
  () => [locale.value, options.value] as const,
  () => {
    // wait one tick for v-for to mount the new refs
    requestAnimationFrame(() => measure());
  },
  { immediate: false },
);

onMounted(() => {
  startObservers();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  mutationObserver?.disconnect();
});

function pick(code: string) {
  locale.value = code as typeof locale.value;
}
</script>

<template>
  <div
    role="group"
    :aria-label="
      t('noonTool.hero.localeZh') + ' / ' + t('noonTool.hero.localeEn')
    "
    class="border-border/60 bg-card/70 relative inline-flex items-center gap-1 rounded-full border p-1 shadow-sm backdrop-blur"
  >
    <div ref="trackRef" class="relative inline-flex items-center gap-1">
      <button
        v-for="opt in options"
        :key="opt.code"
        :ref="setOptionRef(opt.code)"
        type="button"
        :aria-pressed="locale === opt.code"
        class="focus-visible:ring-ring relative z-10 rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
        :class="
          locale === opt.code ? 'text-contrast' : 'text-muted hover:text-ink'
        "
        @click="pick(opt.code)"
      >
        {{ opt.label }}
      </button>

      <motion.span
        aria-hidden="true"
        class="bg-accent absolute top-0 left-0 z-0 h-full rounded-full shadow-sm"
        :animate="{
          x: indicator.x,
          width: indicator.width,
        }"
        :transition="{
          type: 'spring',
          duration: 0.3,
          bounce: 0,
        }"
      />
    </div>
  </div>
</template>
