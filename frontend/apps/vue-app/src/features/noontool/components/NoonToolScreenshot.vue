<script setup lang="ts">
/**
 * Story-style usage:
 *   <NoonToolScreenshot src="/noontool-screens/01-hero.png" alt="..." aspect="16/10" />
 *   <NoonToolScreenshot videoSrc="/noontool-screens/hero.mp4" alt="..." aspect="16/10" />
 *   <NoonToolScreenshot src="..." alt="..." aspect="3/2" caption="..." />
 *   <NoonToolScreenshot src="..." alt="..." aspect="2/1" />
 *
 * Renders a fixed-aspect-ratio figure with a screenshot or a looping video.
 * Pass `videoSrc` to show a muted, looping video instead of an image; it plays
 * only while scrolled into view (≥25% visible), with no controls.
 * Click (or Enter / Space) the figure to open a larger preview in a modal.
 * When the media fails to load, the slot is empty (silently blank) per design.
 */
import { onMounted, onUnmounted, ref } from 'vue';
import { Modal } from '@/components/ui/modal';

type Aspect = '16/10' | '3/2' | '2/1';

const props = withDefaults(
  defineProps<{
    src?: string;
    videoSrc?: string;
    alt: string;
    aspect?: Aspect;
    caption?: string;
  }>(),
  {
    src: '',
    videoSrc: '',
    aspect: '16/10',
    caption: '',
  },
);

const isVideo = () => Boolean(props.videoSrc);

const aspectClass = {
  '16/10': 'aspect-[16/10]',
  '3/2': 'aspect-[3/2]',
  '2/1': 'aspect-[2/1]',
}[props.aspect];

const previewOpen = ref(false);

// 视口内才播放：卡片视频去掉 autoplay，由 IntersectionObserver 控制
// 进入视口（≥25% 可见）即播放、离开即暂停，避免视口外空耗资源。
const videoRef = ref<HTMLVideoElement | null>(null);
let observer: IntersectionObserver | null = null;

function onVideoIntersect(entries: IntersectionObserverEntry[]) {
  const video = videoRef.value;
  if (!video) return;
  const visible = entries.some((e) => e.isIntersecting);
  if (visible) {
    video.play().catch(() => {});
  } else {
    video.pause();
  }
}

onMounted(() => {
  if (!isVideo() || !videoRef.value) return;
  observer = new IntersectionObserver(onVideoIntersect, { threshold: 0.25 });
  observer.observe(videoRef.value);
});

onUnmounted(() => {
  observer?.disconnect();
  observer = null;
});

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
      class="group/zoom border-border bg-card/40 focus-visible:ring-ring relative block h-full w-full cursor-zoom-in overflow-hidden rounded-2xl border shadow-md transition-shadow focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none motion-safe:hover:shadow-lg"
      @click="openPreview"
      @keydown="onFigureKeydown"
    >
      <video
        v-if="isVideo()"
        ref="videoRef"
        :src="props.videoSrc"
        class="absolute inset-0 h-full w-full object-cover"
        muted
        loop
        playsinline
        preload="metadata"
      />
      <img
        v-else
        :src="props.src"
        :alt="props.alt"
        loading="lazy"
        decoding="async"
        class="absolute inset-0 h-full w-full object-cover transition-transform duration-300 motion-safe:group-hover/zoom:scale-[1.02]"
      />

      <span
        class="bg-card/80 text-ink/70 pointer-events-none absolute top-3 right-3 inline-flex items-center justify-center rounded-full p-1.5 opacity-0 shadow-sm backdrop-blur transition-opacity duration-150 ease-[cubic-bezier(0.2,0,0,1)] group-hover/zoom:opacity-100 group-focus-visible/zoom:opacity-100"
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
        <video
          v-if="isVideo()"
          :src="props.videoSrc"
          class="max-h-[80vh] w-full rounded-lg object-contain"
          autoplay
          muted
          loop
          playsinline
          controls
        />
        <img
          v-else
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
