<template>
  <BentoCard
    :initial="{ scale: 0.5, opacity: 0 }"
    :animate="{ scale: 1, opacity: 1 }"
    class="group relative flex h-full flex-col overflow-hidden p-2!"
  >
    <RouterLink
      to="/todos"
      class="relative flex h-full items-center gap-3 px-4 py-2"
    >
      <div
        class="bg-accent-500/15 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
      >
        <img
          src="/images/animal-badge/deer.png"
          class="size-10 rounded-md object-cover"
          loading="lazy"
        />
      </div>
      <span class="text-ink text-sm font-medium">开发任务</span>
      <svg
        class="text-muted ml-auto size-4 transition-transform duration-300 group-hover:translate-x-0.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 5l7 7-7 7"
        />
      </svg>
    </RouterLink>
  </BentoCard>
</template>

<script setup lang="ts">
import { BentoCard } from '@/components';
</script>
