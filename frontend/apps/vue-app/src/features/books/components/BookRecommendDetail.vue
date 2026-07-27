<script setup lang="ts">
import type { BookRecommendItem } from '@/features/books/api';
import { AnimatePresence, Motion } from 'motion-v';
import { FADE, SPRING_BOUNCE } from '@/constants';
import { onMounted, onUnmounted, watch } from 'vue';
import { RECOMMEND_COVER_LAYOUT_ID_PREFIX } from '../lib/recommendLayoutId';

const props = defineProps<{
  book: BookRecommendItem | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

/** 0-100 整数转 0-5 星显示用的小数 */
function ratingScore(v: number): string {
  if (!v || v <= 0) return '--';
  return ((v / 100) * 10).toFixed(1);
}

function readingCountLabel(n: number): string {
  if (!n || n <= 0) return '';
  if (n >= 10000) return `${(n / 10000).toFixed(1)} 万人在读`;
  return `${n} 人在读`;
}

const wereadHref = `weread://reading?bId=${props.book?.bookId ?? ''}`;

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.book) emit('close');
}

function lockScroll(lock: boolean) {
  if (typeof document === 'undefined') return;
  document.body.style.overflow = lock ? 'hidden' : '';
}

watch(
  () => props.book,
  (book) => {
    lockScroll(!!book);
  },
);

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  lockScroll(false);
});
</script>

<template>
  <Teleport to="body">
    <AnimatePresence>
      <!-- 背景遮罩 -->
      <Motion
        v-if="book"
        :key="book.bookId"
        :initial="{ opacity: 0 }"
        :animate="{ opacity: 1 }"
        :exit="{ opacity: 0 }"
        :transition="FADE"
        class="fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto bg-black/70 p-0 backdrop-blur-md sm:items-center sm:p-6"
        @click.self="emit('close')"
        role="dialog"
        aria-modal="true"
      >
        <!-- Modal shell — width + height animated independently so the cover morphs cleanly -->
        <Motion
          :layoutId="RECOMMEND_COVER_LAYOUT_ID_PREFIX + book.bookId"
          :initial="{ scale: 0.6, opacity: 0.6 }"
          :animate="{ scale: 1, opacity: 1 }"
          :exit="{ scale: 0.6, opacity: 0 }"
          :transition="SPRING_BOUNCE"
          class="bg-card relative w-full max-w-3xl overflow-hidden rounded-t-3xl border shadow-2xl sm:rounded-3xl"
        >
          <div class="grid grid-cols-1 sm:grid-cols-[200px_1fr]">
            <!-- Cover column — the morph happens here -->
            <div
              class="bg-surface relative aspect-[2/3] w-full overflow-hidden sm:aspect-auto sm:h-full sm:w-[200px]"
            >
              <img
                v-if="book.cover"
                :src="book.cover"
                :alt="book.title"
                class="h-full w-full object-cover"
              />
              <span
                v-if="book.newRating > 0"
                class="bg-page/85 text-ink absolute top-3 left-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums backdrop-blur-md"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  class="text-ink h-3 w-3"
                  aria-hidden="true"
                >
                  <path
                    fill-rule="evenodd"
                    d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.007Z"
                    clip-rule="evenodd"
                  />
                </svg>
                {{ ratingScore(book.newRating) }}
              </span>
            </div>

            <!-- Content column — body fades in alongside the morph -->
            <Motion
              :initial="{ opacity: 0, y: 12 }"
              :animate="{ opacity: 1, y: 0 }"
              :exit="{ opacity: 0, y: 8 }"
              :transition="{ duration: 0.35, delay: 0.1 }"
              class="flex min-w-0 flex-col p-6 sm:p-7"
            >
              <!-- Top row: category + close -->
              <div class="mb-3 flex items-start justify-between gap-3">
                <span
                  v-if="book.category"
                  class="bg-accent/15 text-ink inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                >
                  {{ book.category }}
                </span>
                <span v-else />

                <button
                  type="button"
                  class="text-muted hover:bg-surface hover:text-ink -mt-1 -mr-1 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-colors"
                  aria-label="关闭"
                  @click="emit('close')"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2"
                    stroke="currentColor"
                    class="h-4 w-4"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M6 18 18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <!-- Title + author -->
              <h2
                class="text-ink font-serif text-2xl leading-tight font-bold tracking-tight sm:text-3xl"
              >
                {{ book.title }}
              </h2>
              <p
                v-if="book.author"
                class="text-muted mt-1 text-sm sm:text-base"
              >
                {{ book.author }}
              </p>

              <!-- Meta line -->
              <p
                v-if="book.readingCount"
                class="text-muted/80 mt-2 text-xs tabular-nums"
              >
                {{ readingCountLabel(book.readingCount) }}
              </p>

              <!-- Reason — italicized editorial blurb -->
              <p
                v-if="book.reason"
                class="text-muted mt-5 border-l-2 pl-3 text-sm leading-relaxed italic sm:text-base"
              >
                {{ book.reason }}
              </p>

              <!-- Intro — scrollable if long -->
              <div
                v-if="book.intro"
                class="text-ink/90 mt-5 max-h-48 overflow-y-auto pr-1 text-sm leading-relaxed sm:text-[15px]"
              >
                {{ book.intro }}
              </div>

              <!-- Footer / open button -->
              <div class="mt-auto pt-6">
                <a
                  :href="wereadHref"
                  class="bg-accent text-ink hover:bg-accent/90 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-colors sm:w-auto"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2"
                    stroke="currentColor"
                    class="h-4 w-4"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                    />
                  </svg>
                  在微信读书打开
                </a>
              </div>
            </Motion>
          </div>
        </Motion>
      </Motion>
    </AnimatePresence>
  </Teleport>
</template>
