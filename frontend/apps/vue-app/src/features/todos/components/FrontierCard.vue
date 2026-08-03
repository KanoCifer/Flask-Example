<template>
  <button
    type="button"
    class="bg-card/30 group block w-full rounded-3xl border p-3 text-left"
    :aria-label="`open ${task.title}`"
    @click="$emit('open', task.slug)"
  >
    <div class="grid grid-cols-[auto_1fr] items-start gap-3">
      <!-- LEFT: animal guardian. No ring, no P-letter, no halo — just the image with a 1px
           white drop-shadow so the animal sits cleanly on the transparent card. -->
      <div class="relative shrink-0 pt-0.5">
        <img
          :src="animalSrc"
          :alt="''"
          class="animal-avatar h-[80px] w-[80px] object-cover select-none"
          draggable="false"
          loading="lazy"
          decoding="async"
          fetchpriority="low"
        />
      </div>

      <!-- RIGHT: title, badges, desc, footer -->
      <div class="flex min-w-0 flex-col gap-1.5">
        <div class="text-ink truncate text-sm leading-snug font-medium">
          {{ task.title }}
        </div>

        <div class="flex flex-wrap items-center gap-1">
          <SlugBadge :slug="task.slug" />
          <StatusChip :type="task.type" />
          <PriorityBadge :priority="task.priority" />
          <KindBadge :kind="task.kind" />
        </div>

        <p
          v-if="task.description"
          class="text-muted line-clamp-2 text-xs leading-relaxed"
        >
          {{ task.description }}
        </p>

        <div class="mt-1 flex items-center justify-between gap-2">
          <div
            class="flex items-center gap-2 font-mono text-[11px] tabular-nums"
            :class="dueLabel.overdue ? 'text-destructive' : 'text-muted'"
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
            <span>{{ dueLabel.text }}</span>
          </div>

          <!-- actions (reveal on hover). @click.stop so the outer button's open event doesn't fire. -->
          <div class="fc-actions flex items-center gap-1">
            <button
              type="button"
              class="text-muted border-border bg-surface hover:text-ink grid h-6 w-6 place-items-center rounded-full border transition-colors"
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
                <path d="M3 8a5 5 0 0 1 8.5-3.5L13 6" />
                <path d="M13 3v3h-3" />
                <path d="M13 8a5 5 0 0 1-8.5 3.5L3 10" />
                <path d="M3 13v-3h3" />
              </svg>
            </button>
            <button
              type="button"
              class="text-muted hover:text-destructive border-border bg-surface grid h-6 w-6 place-items-center rounded-full border transition-colors"
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
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { DevTask } from '@/features/todos/api';
import StatusChip from './StatusChip.vue';
import PriorityBadge from './PriorityBadge.vue';
import KindBadge from './KindBadge.vue';
import SlugBadge from './SlugBadge.vue';

// ── Animal routing (C-ring's character-based, no progress ring) ──────────────
// 1. due_date overdue        → fox       (sharpened, overrides kind)
// 2. due_date within 3 days  → penguin   (cool/quick, overrides kind)
// 3. no due_date             → cat       (default independent)
// 4. kind = spec             → deer      (alert, scanning)
// 5. kind = subtask          → rabbit    (quick, actionable)
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

// ── Due-date label formatting (C-ring uses "overdue Nd" or "M月 DD" or "—") ──
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

const props = defineProps<{ task: DevTask }>();
defineEmits<{
  open: [slug: string];
  cycle: [slug: string];
  delete: [slug: string];
}>();

const animalSrc = computed(
  () => `/images/animal-badge/${pickAnimal(props.task)}.png`,
);
const dueLabel = computed(() => formatDue(props.task.due_date));
</script>

<style scoped>
/* Animal PNG 直接显示即可 —— 之前叠的 `filter: drop-shadow` 会把每张 <img>
   推进到 GPU 滤镜层，~100+ 张卡的视图里 hover / scroll 都触发 paint。
   1px 白色阴影对 80×80 透明卡上几乎不可见，但每帧 paint 成本真实存在。 */
.animal-avatar {
  /* 保留像素感；不强制 optimize-contrast —— 那条 hint 反而会让浏览器
     在每次解码时走高质量路径，常见 per-image decode spike。 */
  image-rendering: pixelated;
}

/* Reveal action buttons on group hover (matches C-ring's .fc:hover .fc-actions).
   opacity + transition-opacity 都是合成层属性，不触发 paint。 */
.fc-actions {
  opacity: 0;
  transition: opacity 150ms ease;
}
.group:hover .fc-actions,
.group:focus-within .fc-actions {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .fc-actions {
    transition: none;
  }
}
</style>
