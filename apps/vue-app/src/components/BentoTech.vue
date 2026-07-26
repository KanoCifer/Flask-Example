<template>
  <BentoCard class="group relative overflow-hidden">
    <div class="relative">
      <!-- Header -->
      <div class="mx-3 flex items-center justify-between">
        <div
          class="flex h-10 w-10 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110 group-hover:rounded-xl"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="text-ink size-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        </div>
        <h3 class="text-muted text-xs font-bold tracking-wider uppercase">
          TechStack
        </h3>
      </div>

      <div class="mt-3 ml-3 flex flex-wrap gap-2">
        <span
          v-for="tech in techStack"
          :key="tech.name"
          :class="[
            'cursor-default rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            colorClasses[tech.color],
          ]"
        >
          {{ tech.name }}
        </span>
      </div>
    </div>
  </BentoCard>
</template>
<script setup lang="ts">
import BentoCard from './BentoCard.vue';

const techStack = [
  { name: 'Vue3', color: 'rose' },
  { name: 'React19', color: 'teal' },
  { name: 'Postgres@18', color: 'indigo' },
  { name: 'FastAPI', color: 'indigo' },
  { name: 'Redis8', color: 'teal' },
  { name: 'MongoDB', color: 'fuchsia' },
  { name: 'Golang', color: 'blue' },
];

const colorClasses: Record<string, string> = {
  green:
    'bg-success/15 text-success hover:bg-success/25 dark:bg-success/10 dark:text-success dark:hover:bg-success/20',
  rose: 'bg-destructive/15 text-destructive hover:bg-destructive/25 dark:bg-destructive/10 dark:text-destructive dark:hover:bg-destructive/20',
  teal: 'bg-chart-2/15 text-chart-2 hover:bg-chart-2/25 dark:bg-chart-2/10 dark:text-chart-2 dark:hover:bg-chart-2/20',
  indigo:
    'bg-chart-3/15 text-chart-3 hover:bg-chart-3/25 dark:bg-chart-3/10 dark:text-chart-3 dark:hover:bg-chart-3/20',
  cyan: 'bg-chart-1/15 text-chart-1 hover:bg-chart-1/25 dark:bg-chart-1/10 dark:text-chart-1 dark:hover:bg-chart-1/20',
  fuchsia:
    'bg-chart-5/15 text-chart-5 hover:bg-chart-5/25 dark:bg-chart-5/10 dark:text-chart-5 dark:hover:bg-chart-5/20',
  blue: 'bg-chart-4/15 text-chart-4 hover:bg-chart-4/25 dark:bg-chart-4/10 dark:text-chart-4 dark:hover:bg-chart-4/20',
};
</script>
