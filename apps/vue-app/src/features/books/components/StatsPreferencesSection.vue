<script setup lang="ts">
import type { ReadDetailSnapshot } from '@/features/books/api';
import { toRef } from 'vue';
import { usePreferenceView } from '../composables/usePreferenceView';

const props = defineProps<{
  snapshot: ReadDetailSnapshot;
}>();

const snapshotRef = toRef(props, 'snapshot');
const { topCategories, topAuthors, topPublishers, hasData } =
  usePreferenceView(snapshotRef);
</script>

<template>
  <section v-if="hasData" class="mb-14">
    <h2
      class="text-ink mb-6 font-serif text-2xl font-semibold tracking-tight sm:text-3xl"
    >
      你偏好的
    </h2>
    <dl class="space-y-5 text-sm sm:text-base">
      <div
        v-if="topCategories.length"
        class="grid grid-cols-[5rem_1fr] gap-x-5 gap-y-1 sm:grid-cols-[6rem_1fr]"
      >
        <dt class="text-muted pt-1">品类</dt>
        <dd class="flex flex-wrap gap-x-3 gap-y-1.5">
          <span
            v-for="cat in topCategories"
            :key="cat.categoryTitle"
            class="text-ink"
          >
            <span class="font-serif">{{ cat.categoryTitle }}</span>
            <span class="text-muted ml-1 text-xs tabular-nums">
              {{ Math.round(cat.share * 100) }}%
            </span>
          </span>
        </dd>
      </div>

      <div
        v-if="topAuthors.length"
        class="grid grid-cols-[5rem_1fr] gap-x-5 gap-y-1 sm:grid-cols-[6rem_1fr]"
      >
        <dt class="text-muted pt-1">作者</dt>
        <dd class="flex flex-wrap gap-x-3 gap-y-1.5">
          <span
            v-for="(author, idx) in topAuthors"
            :key="author.name ?? idx"
            class="text-ink"
          >
            <span class="font-serif">
              {{ author.name ?? '未知' }}
            </span>
            <span v-if="author.readTime" class="text-muted ml-1 text-xs">
              {{ author.readTime }}
            </span>
          </span>
        </dd>
      </div>

      <div
        v-if="topPublishers.length"
        class="grid grid-cols-[5rem_1fr] gap-x-5 gap-y-1 sm:grid-cols-[6rem_1fr]"
      >
        <dt class="text-muted pt-1">出版社</dt>
        <dd class="flex flex-wrap gap-x-3 gap-y-1.5">
          <span
            v-for="(pub, idx) in topPublishers"
            :key="pub.name ?? idx"
            class="text-ink"
          >
            <span class="font-serif">{{ pub.name ?? '未知' }}</span>
            <span v-if="pub.count" class="text-muted ml-1 text-xs tabular-nums">
              {{ pub.count }} 本
            </span>
          </span>
        </dd>
      </div>
    </dl>
  </section>
</template>
