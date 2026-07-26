<template>
  <article
    class="bg-surface/80 group hover:bg-surface flex flex-col gap-2 rounded-xl border p-3 transition-[background-color,transform,opacity] duration-200"
    :class="[
      isDragging ? 'cursor-grabbing opacity-50' : 'cursor-grab',
      done ? 'opacity-70' : '',
    ]"
    draggable="true"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
  >
    <!-- 拖拽手柄 + 标题（点击打开，拖拽手柄触发 drag） -->
    <button
      type="button"
      class="focus-visible:ring-ring flex w-full items-start gap-2 text-left focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      @click="$emit('open', task.slug)"
    >
      <svg
        class="text-muted/50 group-hover:text-muted mt-0.5 h-3.5 w-3.5 shrink-0 transition-colors"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M8 6h2M8 12h2M8 18h2M14 6h2M14 12h2M14 18h2"
        />
      </svg>
      <span
        class="text-ink line-clamp-2 flex-1 text-sm font-medium"
        :class="{ 'text-muted line-through': done }"
        >{{ task.title }}</span
      >
    </button>

    <!-- 标签行 -->
    <div class="flex flex-wrap items-center gap-1">
      <TypeBadge :type="task.type" />
      <PriorityBadge :priority="task.priority" />
      <KindBadge v-if="task.kind === 'subtask'" :kind="task.kind" />
      <span
        v-if="task.scope"
        class="text-muted rounded-full border px-1.5 py-px text-[10px]"
      >
        {{ task.scope }}
      </span>
      <span
        v-if="task.slug"
        class="bg-accent/10 text-ink rounded-full px-1.5 py-px text-[10px] font-medium tabular-nums"
      >
        {{ task.slug }}
      </span>
    </div>

    <!-- 底部：截止日 + 头像 + 动作 -->
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <MemberAvatar :user-id="task.user_id" size="sm" />
        <span
          v-if="task.due_date"
          class="flex items-center gap-1 text-[10px]"
          :class="
            overdue(task.due_date) && !done ? 'text-destructive' : 'text-muted'
          "
        >
          <svg class="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fill-rule="evenodd"
              d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
              clip-rule="evenodd"
            />
          </svg>
          {{ task.due_date }}
        </span>
      </div>

      <div
        class="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
      >
        <button
          v-if="!done"
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
import { computed } from 'vue';
import type { DevTask } from '@/features/todos/api';
import TypeBadge from './TypeBadge.vue';
import PriorityBadge from './PriorityBadge.vue';
import KindBadge from './KindBadge.vue';
import MemberAvatar from './MemberAvatar.vue';

const props = defineProps<{
  task: DevTask;
  isDragging?: boolean;
}>();

const emit = defineEmits<{
  open: [slug: string];
  cycle: [slug: string];
  delete: [slug: string];
  dragstart: [slug: string];
  dragend: [];
}>();

const done = computed(() => props.task.status === '已完成');

function onDragStart(e: DragEvent) {
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    // 用 task slug 作为拖拽 payload；备用纯文本保证 Firefox 也能起拖。
    e.dataTransfer.setData('text/plain', props.task.slug);
  }
  emit('dragstart', props.task.slug);
}
function onDragEnd() {
  emit('dragend');
}

function overdue(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dateStr) < today;
}
</script>
