<template>
  <article
    class="bg-card/30 group border-border block w-full rounded-3xl border p-3 text-left transition-[background-color,translate,opacity] duration-200"
    :class="[
      isDragging ? 'cursor-grabbing opacity-50' : 'cursor-grab',
      done ? 'opacity-70' : '',
    ]"
    draggable="true"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
  >
    <div class="grid grid-cols-[auto_1fr] items-start gap-3">
      <!-- LEFT: animal guardian. No ring, no halo — same C-ring style as FrontierCard. -->
      <div class="relative shrink-0 pt-0.5">
        <img
          :src="animalSrc"
          :alt="''"
          class="animal-avatar h-[80px] w-[80px] object-cover select-none"
          draggable="false"
          loading="lazy"
        />
      </div>

      <!-- RIGHT: title + chips + (optional desc) + footer -->
      <div class="flex min-w-0 flex-col gap-1.5">
        <!-- title row: 6-dot grip (visual drag cue) + clickable title -->
        <button
          type="button"
          class="focus-visible:ring-ring flex w-full items-start gap-1.5 rounded-md text-left focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
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
          <!-- 拖动仅作指针用户的视觉提示；键盘用户通过"移动到"菜单操作 -->
          <span
            class="text-ink line-clamp-2 flex-1 text-sm leading-snug"
            :class="done ? 'text-muted line-through' : 'font-medium'"
            >{{ task.title }}</span
          >
        </button>

        <!-- chips: type / priority / kind (English labels via the shared chip components) -->
        <div class="flex flex-wrap items-center gap-1">
          <StatusChip :type="task.type" />
          <PriorityBadge :priority="task.priority" />
          <KindBadge v-if="task.kind" :kind="task.kind" />
        </div>

        <p
          v-if="task.description"
          class="text-muted line-clamp-2 text-xs leading-relaxed"
        >
          {{ task.description }}
        </p>

        <!-- footer: avatar + due_date (left) · actions (right, hover-revealed) -->
        <div class="mt-1 flex items-center justify-between gap-2">
          <div
            class="text-muted flex items-center gap-1.5 font-mono text-[11px] tabular-nums"
          >
            <span
              v-if="task.due_date"
              class="flex items-center gap-1"
              :class="overdue(task.due_date) && !done ? 'text-destructive' : ''"
            >
              <svg
                class="h-[11px] w-[11px] shrink-0"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="1.4"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <rect x="2" y="3" width="12" height="11" rx="1.5" />
                <path d="M2 6.5h12" />
                <path d="M5.5 1.5v3M10.5 1.5v3" />
              </svg>
              <span>{{ dueLabel }}</span>
            </span>
          </div>

          <!-- actions (reveal on hover) -->
          <div class="fc-actions flex items-center gap-1">
            <button
              v-if="!done"
              type="button"
              class="text-muted hover:bg-surface hover:text-ink border-border bg-surface grid h-6 w-6 place-items-center rounded-full border transition"
              title="推进状态"
              aria-label="推进状态"
              @click.stop="$emit('cycle', task.slug)"
            >
              <svg
                class="h-[11px] w-[11px]"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M3 8h10" />
                <path d="M9.5 4.5L13 8l-3.5 3.5" />
              </svg>
            </button>
            <button
              type="button"
              class="text-muted hover:text-destructive border-border bg-surface grid h-6 w-6 place-items-center rounded-full border transition"
              title="删除"
              aria-label="删除"
              @click.stop="$emit('delete', task.slug)"
            >
              <svg
                class="h-[11px] w-[11px]"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M3 4.5h10" />
                <path d="M6.5 4.5V3.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1" />
                <path
                  d="M4.5 4.5l.7 8a1 1 0 0 0 1 .9h3.6a1 1 0 0 0 1-.9l.7-8"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { DevTask } from '@/features/todos/api';
import StatusChip from './StatusChip.vue';
import PriorityBadge from './PriorityBadge.vue';
import KindBadge from './KindBadge.vue';

const props = withDefaults(
  defineProps<{
    task: DevTask;
    isDragging?: boolean;
  }>(),
  {
    isDragging: false,
  },
);

const emit = defineEmits<{
  open: [slug: string];
  cycle: [slug: string];
  delete: [slug: string];
  dragstart: [slug: string];
  dragend: [];
}>();

const done = computed(() => props.task.status === '已完成');

// ── Animal routing (same as FrontierCard, C-ring character-based) ────────────
function pickAnimal(task: DevTask): string {
  if (task.due_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(task.due_date);
    if (!Number.isNaN(due.getTime())) {
      if (due < today) return 'fox';
      const days = (due.getTime() - today.getTime()) / 86400000;
      if (days <= 3) return 'penguin';
    }
  } else {
    return 'cat';
  }
  return task.kind === 'subtask' ? 'rabbit' : 'deer';
}

// ── Due-date label formatting (same as FrontierCard) ─────────────────────────
function formatDue(due: string | null | undefined): {
  text: string;
  overdue: boolean;
} {
  if (!due) return { text: '—', overdue: false };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(due);
  if (Number.isNaN(dueDate.getTime())) return { text: due, overdue: false };
  if (dueDate < today) {
    const days = Math.floor((today.getTime() - dueDate.getTime()) / 86400000);
    return { text: `overdue ${days}d`, overdue: true };
  }
  const m = dueDate.getMonth() + 1;
  const d = String(dueDate.getDate()).padStart(2, '0');
  return { text: `${m}月 ${d}`, overdue: false };
}

const animalSrc = computed(
  () => `/images/animal-badge/${pickAnimal(props.task)}.png`,
);
const dueLabel = computed(() => formatDue(props.task.due_date).text);

function onDragStart(e: DragEvent) {
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
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

<style scoped>
/* Animal PNG crispness + subtle white drop-shadow (same as FrontierCard). */
.animal-avatar {
  image-rendering: -webkit-optimize-contrast;
  filter: drop-shadow(0 1px 0 oklch(1 0 0 / 0.4));
}

/* Reveal action buttons on group hover. */
.fc-actions {
  opacity: 0;
  transition: opacity 200ms ease;
}
.group:hover .fc-actions,
.group:focus-within .fc-actions {
  opacity: 1;
}
</style>
