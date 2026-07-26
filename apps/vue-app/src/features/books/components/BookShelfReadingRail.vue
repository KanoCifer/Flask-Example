<template>
  <section v-if="books.length" class="mb-8">
    <header class="mb-3 flex items-baseline justify-between">
      <div class="flex items-baseline gap-2">
        <h2 class="text-ink font-serif text-xl font-bold md:text-2xl">
          你正在读
        </h2>
        <span class="text-muted text-xs tabular-nums">
          {{ books.length }} 本
        </span>
      </div>
      <button
        v-if="hasOverflow"
        type="button"
        class="text-muted hover:text-ink text-xs font-medium"
        @click="scrollByPage(1)"
      >
        更多 →
      </button>
    </header>

    <div class="relative -mx-12">
      <div
        ref="railEl"
        class="flex snap-x snap-mandatory scroll-px-4 scrollbar-none gap-3 overflow-x-auto px-4 pb-2 sm:scroll-px-6 sm:gap-4 sm:px-6 md:scroll-px-10 md:px-10 [&::-webkit-scrollbar]:hidden"
      >
        <div
          v-for="book in books"
          :key="book.bookId"
          class="w-28 flex-shrink-0 snap-start sm:w-32 md:w-36"
        >
          <WereadBookCard
            :book="book"
            :showStatus="true"
            @select="$emit('select', book)"
          >
            <template #corner-tl>
              <!--
                "你正在读" rail 的 recency 角标:
                - 仅 reading 状态显示(已读完没有 recency 语义)
                - 角标独占左上,与右上 statusLabel "在读" 互不重叠
              -->
              <span
                v-if="book.readUpdateTime && !book.finishReading"
                class="bg-page/85 text-ink/80 rounded-full px-2 py-0.5 text-[10px] font-medium shadow-sm backdrop-blur-sm"
              >
                {{ formatRelative(book.readUpdateTime) }}
              </span>
            </template>
          </WereadBookCard>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { WereadUserBook } from '@/features/books/api';
import WereadBookCard from '@/features/books/components/WereadBookCard.vue';
import { formatRelative } from '@/lib/dayjs';
import { onBeforeUnmount, onMounted, ref } from 'vue';

defineProps<{
  books: WereadUserBook[];
}>();

defineEmits<{
  (e: 'select', book: WereadUserBook): void;
}>();

const railEl = ref<HTMLDivElement | null>(null);
const hasOverflow = ref(false);
const ro = ref<ResizeObserver | null>(null);

function checkOverflow() {
  const el = railEl.value;
  if (!el) return;
  hasOverflow.value = el.scrollWidth > el.clientWidth + 4;
}

onMounted(() => {
  checkOverflow();
  if (typeof ResizeObserver !== 'undefined' && railEl.value) {
    ro.value = new ResizeObserver(checkOverflow);
    ro.value.observe(railEl.value);
  }
});
onBeforeUnmount(() => {
  ro.value?.disconnect();
});

function scrollByPage(dir: 1 | -1) {
  const el = railEl.value;
  if (!el) return;
  el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
}

defineExpose({ scrollByPage });
</script>
