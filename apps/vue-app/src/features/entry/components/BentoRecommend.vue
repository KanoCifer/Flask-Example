<template>
  <BentoCard class="group relative h-full overflow-hidden">
    <div
      class="from-gradient-decorative-from to-gradient-decorative-to absolute inset-0 bg-linear-to-br opacity-10 transition-opacity group-hover:opacity-20"
    ></div>
    <div class="relative z-10 flex h-full flex-col justify-between p-2">
      <!-- Icon / Logo -->
      <div
        class="bg-surface text-ink mb-4 flex h-12 w-12 items-center justify-center rounded-full"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
      </div>
      <div>
        <div class="text-ink mb-1 text-xs font-bold tracking-wide uppercase">
          Recommended Read
        </div>
        <h3
          class="text-ink group-hover:text-ink mb-2 text-lg leading-tight font-bold transition-colors"
        >
          {{ item.title }}
        </h3>
        <p class="text-muted line-clamp-3 text-sm">
          {{ item.description }}
        </p>
      </div>
    </div>
  </BentoCard>
</template>

<script setup lang="ts">
import { BentoCard } from '@/components';

const item = {
  title: 'Refactoring UI',
  description:
    "Learn how to design beautiful user interfaces by yourself using specific tactics explained from a developer's point-of-view.",
  type: 'Book',
};
</script>
