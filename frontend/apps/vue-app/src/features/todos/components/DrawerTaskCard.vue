<template>
  <!-- 行级 surface：bg 与 panel 同色，靠 inset 高光 + 细 hairline 边界从抽屉面板里浮起。
       悬停时叠 layered ambient（与 TaskRow 同款），让鼠标 hover 的卡片「被台灯照亮」。
       已完成态降为 paper 上的淡墨，而不是刺眼的删除线。 -->
  <li
    class="group relative rounded-xl px-3.5 py-2.5 transition-[box-shadow,background-color] duration-200"
    :class="
      done
        ? 'bg-surface/40 ring-border/60 ring-1'
        : 'bg-page ring-border/60 hover:bg-page hover:ring-border/80 ring-1 hover:shadow-[0_1px_1px_color-mix(in_oklch,var(--ink)_6%,transparent),0_6px_14px_color-mix(in_oklch,var(--ink)_10%,transparent)]'
    "
  >
    <div class="flex items-start gap-3">
      <!-- open affordance: real button, 占满 title + meta 行 -->
      <button
        type="button"
        class="focus-visible:ring-ring min-w-0 flex-1 cursor-pointer text-left focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        :aria-label="`打开任务：${task.title}`"
        @click="$emit('open', task.slug)"
      >
        <p
          class="text-sm leading-snug"
          :class="
            done ? 'text-muted font-serif italic' : 'text-ink font-medium'
          "
        >
          {{ task.title }}
        </p>

        <p
          v-if="task.description"
          class="text-muted mt-1 line-clamp-2 text-xs leading-relaxed"
        >
          {{ task.description }}
        </p>

        <!-- 底部 meta：chips + due，弱化为纯文本层级 -->
        <div class="mt-2 flex flex-wrap items-center gap-1.5">
          <TypeBadge :type="task.type" />
          <PriorityBadge :priority="task.priority" />
          <KindBadge v-if="task.kind === 'subtask'" :kind="task.kind" />

          <span
            v-if="task.due_date"
            class="ml-auto inline-flex items-center gap-1 text-[11px] tabular-nums"
            :class="overdue ? 'text-destructive font-medium' : 'text-muted'"
          >
            <svg
              class="h-3 w-3"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fill-rule="evenodd"
                d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 1 1 0 000-2H6z"
                clip-rule="evenodd"
              />
            </svg>
            {{ task.due_date }}
          </span>
        </div>
      </button>

      <!-- actions: 抽屉场景里始终可见（不像 TaskRow 在 hover 才显），作者需要快速推进 -->
      <div class="flex shrink-0 items-start gap-0.5">
        <button
          v-if="!done"
          type="button"
          :aria-label="`推进状态：${task.title}`"
          :title="`推进状态 · ${task.title}`"
          class="text-muted hover:bg-accent/10 hover:text-ink focus-visible:ring-ring cursor-pointer rounded-md p-1.5 transition-[color,transform] focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none active:scale-[0.94] active:not-focus-visible:ring-0"
          @click="$emit('cycle-status', task.slug)"
        >
          <svg
            class="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M13 7l5 5m0 0l-5 5m5-5H6"
            />
          </svg>
        </button>
        <button
          type="button"
          :aria-label="`删除：${task.title}`"
          :title="`删除 · ${task.title}`"
          class="text-muted hover:bg-destructive/10 hover:text-destructive focus-visible:ring-ring cursor-pointer rounded-md p-1.5 transition-[color,transform] focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none active:scale-[0.94] active:not-focus-visible:ring-0"
          @click="$emit('delete-task', task.slug)"
        >
          <svg
            class="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6m6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>
    </div>
  </li>
</template>

<script setup lang="ts">
import type { DevTask } from '@/features/todos/api';
import TypeBadge from './TypeBadge.vue';
import PriorityBadge from './PriorityBadge.vue';
import KindBadge from './KindBadge.vue';

const props = withDefaults(
  defineProps<{
    task: DevTask;
    done?: boolean;
  }>(),
  { done: false },
);

defineEmits<{
  open: [slug: string];
  'cycle-status': [slug: string];
  'delete-task': [slug: string];
}>();

/** 逾期判定：YYYY-MM-DD 串可按字典序与今日串比较；只有未完成态才计算。 */
const overdue = (() => {
  if (props.done || !props.task.due_date) return false;
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return props.task.due_date < todayStr;
})();
</script>
