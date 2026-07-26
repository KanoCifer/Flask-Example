<script setup lang="ts">
import type { ReadDetailSnapshot, ReadStatsMode } from '@/features/books/api';
import { formatDuration } from '@/lib/dayjs';
import { computed, toRef } from 'vue';
import { useLongestView } from '../composables/useLongestView';

const props = defineProps<{
  snapshot: ReadDetailSnapshot;
  mode: ReadStatsMode;
}>();

const snapshotRef = toRef(props, 'snapshot');
const { topBooks, barPercent } = useLongestView(snapshotRef);

const formatRead = (s: number | null | undefined) => formatDuration(s);
const visible = computed(() => topBooks.value.length > 0);
</script>

<template>
  <section v-if="visible" class="mb-14">
    <h2
      class="text-ink mb-6 font-serif text-2xl font-semibold tracking-tight sm:text-3xl"
    >
      让你停不下来的是
    </h2>
    <ol class="space-y-3">
      <li
        v-for="(book, i) in topBooks"
        :key="book.bookId ?? i"
        class="flex items-center gap-4"
      >
        <span
          class="text-muted w-5 flex-shrink-0 text-right font-mono text-xs tabular-nums"
        >
          {{ i + 1 }}
        </span>
        <div
          class="bg-surface relative h-[42px] w-8 flex-shrink-0 overflow-hidden rounded-sm shadow-sm"
        >
          <img
            v-if="book.cover"
            :src="book.cover"
            :alt="book.title ?? ''"
            loading="lazy"
            class="h-full w-full object-cover"
          />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-ink truncate font-serif text-base leading-tight">
            {{ book.title ?? '未知书目' }}
          </p>
          <p v-if="book.author" class="text-muted mt-0.5 truncate text-xs">
            {{ book.author }}
          </p>
          <div
            v-if="book.tags.length"
            class="mt-1.5 flex flex-wrap items-center gap-1"
          >
            <span
              v-for="tag in book.tags"
              :key="tag"
              class="bg-accent/15 text-ink rounded-full px-2 py-0.5 text-xs font-medium"
            >
              {{ tag }}
            </span>
          </div>
        </div>
        <div class="flex flex-1 items-center gap-3">
          <div class="bg-surface h-1 flex-1 overflow-hidden rounded-full">
            <div
              class="bg-accent h-full rounded-full transition-all duration-700"
              :style="{ width: `${barPercent(book.readTime)}%` }"
            />
          </div>
          <span
            class="text-muted w-16 flex-shrink-0 text-right text-sm tabular-nums"
          >
            {{ formatRead(book.readTime) }}
          </span>
        </div>
      </li>
    </ol>
  </section>
</template>
