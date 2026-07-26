<template>
  <article
    class="bg-card group flex flex-col rounded-3xl p-4 transition-transform duration-300 hover:-translate-y-0.5"
  >
    <!-- open affordance: a real button wrapping the content area (no nested interactives) -->
    <button
      type="button"
      class="focus-visible:ring-ring flex w-full flex-col items-stretch text-left focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      @click="$emit('open', task.slug)"
    >
      <!-- badges -->
      <span class="mb-2 flex flex-wrap items-center gap-1">
        <CircleCheckBig class="text-ink size-5" />
        <TypeBadge :type="task.type" />
        <PriorityBadge :priority="task.priority" />
        <KindBadge :kind="task.kind" />
        <span
          v-if="task.scope"
          class="text-muted rounded-full border px-1.5 py-px text-[10px]"
        >
          {{ task.scope }}
        </span>
        <span
          v-if="task.slug"
          class="bg-accent/10 text-ink rounded-full px-1.5 py-px text-[10px] font-medium"
        >
          {{ task.slug }}
        </span>
      </span>

      <!-- title -->
      <span class="text-ink text-sm font-medium">{{ task.title }}</span>

      <!-- description -->
      <span
        v-if="task.description"
        class="prose prose-sm mt-1 line-clamp-2 text-xs"
        v-html="renderMarkdown(task.description)"
      />
    </button>

    <!-- footer: due date + actions (siblings of the open button, not nested) -->
    <div class="mt-3 flex items-center justify-between gap-2">
      <span
        v-if="task.due_date"
        class="flex items-center gap-1 text-[10px]"
        :class="overdue(task.due_date) ? 'text-destructive' : 'text-muted'"
      >
        <svg class="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor">
          <path
            fill-rule="evenodd"
            d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 1 1 0 0 0 0-2H6z"
            clip-rule="evenodd"
          />
        </svg>
        {{ task.due_date }}
      </span>
      <span v-else class="flex-1" />

      <!-- actions (reveal on hover) -->
      <div
        class="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
      >
        <button
          type="button"
          class="text-muted hover:bg-surface hover:text-ink focus-visible:ring-ring cursor-pointer rounded-md p-1 transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
          title="推进状态"
          aria-label="推进状态"
          @click="$emit('cycle', task.slug)"
        >
          <svg
            class="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 7l5 5m0 0l-5 5m5-5H6"
            />
          </svg>
        </button>
        <button
          type="button"
          class="text-muted hover:bg-destructive/10 hover:text-destructive focus-visible:ring-ring cursor-pointer rounded-md p-1 transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
          title="删除"
          aria-label="删除"
          @click="$emit('delete', task.slug)"
        >
          <svg
            class="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { DevTask } from '@/features/todos/api';
import { renderMarkdown } from '@/composables';
import TypeBadge from './TypeBadge.vue';
import PriorityBadge from './PriorityBadge.vue';
import KindBadge from './KindBadge.vue';
import { CircleCheckBig } from '@lucide/vue';

defineProps<{ task: DevTask }>();
defineEmits<{
  open: [slug: string];
  cycle: [slug: string];
  delete: [slug: string];
}>();

function overdue(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dateStr) < today;
}
</script>
