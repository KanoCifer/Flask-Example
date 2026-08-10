<script setup lang="ts">
/**
 * Story-style usage:
 *   <NoonToolScreenshot src="/noontool-screens/01-hero.png" alt="..." aspect="16/10" />
 *   <NoonToolScreenshot src="..." alt="..." aspect="3/2" caption="..." />
 *   <NoonToolScreenshot src="..." alt="..." aspect="2/1" />
 *
 * Renders a fixed-aspect-ratio figure with a real screenshot.
 * Click (or Enter / Space) the figure to open a larger preview in a modal.
 * When the image fails to load, the slot is empty (silently blank) per design.
 */
import { ref } from 'vue';
import { Modal } from '@/components/ui/modal';

type Aspect = '16/10' | '3/2' | '2/1';

const props = withDefaults(
  defineProps<{
    src: string;
    alt: string;
    aspect?: Aspect;
    caption?: string;
  }>(),
  {
    aspect: '16/10',
    caption: '',
  },
);

const aspectClass = {
  '16/10': 'aspect-[16/10]',
  '3/2': 'aspect-[3/2]',
  '2/1': 'aspect-[2/1]',
}[props.aspect];

const previewOpen = ref(false);

function openPreview() {
  previewOpen.value = true;
}

function closePreview() {
  previewOpen.value = false;
}

function onFigureKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    openPreview();
  }
}
</script>

<template>
  <figure :class="aspectClass">
    <div
      role="button"
      tabindex="0"
      :aria-label="alt"
      class="group/zoom border-border bg-card/40 focus-visible:ring-ring relative block h-full w-full cursor-zoom-in overflow-hidden rounded-2xl border shadow-[0_8px_24px_-12px_oklch(0.7_0.13_95/0.35)] transition-shadow focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none motion-safe:hover:shadow-[0_12px_32px_-12px_oklch(0.7_0.13_95/0.5)]"
      @click="openPreview"
      @keydown="onFigureKeydown"
    >
      <img
        :src="props.src"
        :alt="props.alt"
        loading="lazy"
        decoding="async"
        class="absolute inset-0 h-full w-full object-cover transition-transform duration-300 motion-safe:group-hover/zoom:scale-[1.02]"
      />

      <span
        class="bg-card/80 text-ink/70 pointer-events-none absolute top-3 right-3 inline-flex items-center justify-center rounded-full p-1.5 opacity-0 shadow-sm backdrop-blur transition-opacity group-hover/zoom:opacity-100 group-focus-visible/zoom:opacity-100"
        aria-hidden="true"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="11" y1="8" x2="11" y2="14" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </span>

      <figcaption
        v-if="caption"
        class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-3 py-2 text-xs text-white"
      >
        {{ caption }}
      </figcaption>
    </div>
  </figure>

  <Modal :open="previewOpen" size="lg" @close="closePreview">
    <div class="bg-card/0 flex max-h-[85vh] w-full flex-col">
      <div
        class="bg-card/0 relative flex min-h-0 flex-1 items-center justify-center p-3 sm:p-4"
      >
        <img
          :src="props.src"
          :alt="props.alt"
          class="max-h-[80vh] w-full rounded-lg object-contain"
        />
      </div>
      <div
        v-if="caption"
        class="border-border/60 text-muted shrink-0 border-t px-5 py-3 text-sm"
      >
        {{ caption }}
      </div>
    </div>
  </Modal>
</template>
