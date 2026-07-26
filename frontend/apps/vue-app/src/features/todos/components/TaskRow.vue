<template>
  <div
    class="bg-surface group hover:bg-surface flex items-center gap-3 rounded-2xl px-4 py-2.5 transition-[background-color] duration-200"
  >
    <!-- open affordance: real button (no nested interactives) -->
    <button
      type="button"
      class="focus-visible:ring-ring flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      @click="$emit('open', task.slug)"
    >
      <span
        class="text-ink min-w-0 flex-1 truncate text-sm font-medium"
        :class="{ 'text-muted line-through opacity-70': done }"
      >
        {{ task.title }}
      </span>

      <span class="flex shrink-0 items-center gap-1.5">
        <TypeBadge :type="task.type" />
        <PriorityBadge :priority="task.priority" />
        <KindBadge v-if="task.kind === 'subtask'" :kind="task.kind" />
      </span>

      <span
        v-if="task.due_date"
        class="text-muted shrink-0 text-[10px] tabular-nums"
      >
        {{ task.due_date }}
      </span>
    </button>

    <!-- actions: siblings of the open button (revealed on hover) -->
    <span
      class="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
    >
      <button
        v-if="!done"
        type="button"
        class="text-muted hover:bg-surface hover:text-ink focus-visible:ring-ring cursor-pointer rounded-md p-2 transition-[color,transform] focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none active:scale-[0.96] active:not-focus-visible:ring-0"
        title="推进状态"
        aria-label="推进状态"
        @click="$emit('cycle', task.slug)"
      >
        <svg
          class="h-4 w-4"
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
        class="text-muted hover:bg-destructive/10 hover:text-destructive focus-visible:ring-ring cursor-pointer rounded-md p-2 transition-[color,transform] focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none active:scale-[0.96] active:not-focus-visible:ring-0"
        title="删除"
        aria-label="删除"
        @click="$emit('delete', task.slug)"
      >
        <svg
          class="h-4 w-4"
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
    </span>
  </div>
</template>

<script setup lang="ts">
import type { DevTask } from '@/features/todos/api';
import TypeBadge from './TypeBadge.vue';
import PriorityBadge from './PriorityBadge.vue';
import KindBadge from './KindBadge.vue';

withDefaults(
  defineProps<{
    task: DevTask;
    done?: boolean;
  }>(),
  { done: false },
);

defineEmits<{
  open: [slug: string];
  cycle: [slug: string];
  delete: [slug: string];
}>();
</script>
