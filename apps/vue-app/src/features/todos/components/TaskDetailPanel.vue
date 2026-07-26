<template>
  <Teleport to="body">
    <!-- 背景遮罩 -->
    <motion.div
      v-if="open"
      :initial="{ opacity: 0 }"
      :animate="{ opacity: 1 }"
      :exit="{ opacity: 0 }"
      :transition="FADE_FAST"
      class="bg-ink/35 fixed inset-0 z-[9998] backdrop-blur-[6px]"
      @click="$emit('close')"
    />

    <!-- 抽屉面板 -->
    <AnimatePresence>
      <motion.aside
        v-if="open"
        :initial="{ x: '100%' }"
        :animate="{ x: 0 }"
        :exit="{ x: '100%' }"
        :transition="SPRING_SNUG"
        class="bg-page fixed top-0 right-0 z-[9999] flex h-full w-full max-w-[min(640px,52vw)] flex-col border-l shadow-[0_12px_32px_color-mix(in_oklch,var(--ink)_10%,transparent)] max-sm:max-w-full"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
      >
        <!-- header -->
        <header
          class="flex shrink-0 items-start justify-between gap-3 border-b px-5 py-4"
        >
          <h2
            id="detail-title"
            class="text-ink min-w-0 flex-1 truncate pr-2 font-serif text-lg leading-tight font-medium"
          >
            {{ task?.title || '任务详情' }}
          </h2>
          <button
            type="button"
            class="text-muted hover:bg-surface hover:text-ink focus-visible:ring-ring cursor-pointer rounded-md p-2 transition-[color,transform] focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none active:scale-[0.96] active:not-focus-visible:ring-0"
            aria-label="关闭"
            @click="$emit('close')"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </header>

        <!-- body -->
        <div class="flex-1 overflow-y-auto px-5 py-5">
          <!-- 任务不存在 / 已删除 -->
          <div
            v-if="!task"
            class="flex h-full min-h-72 flex-col items-center justify-center gap-3 text-center"
          >
            <svg
              class="text-muted/40 h-10 w-10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p class="text-ink text-sm font-medium">找不到这个任务</p>
            <p class="text-muted max-w-[260px] text-xs leading-relaxed">
              它可能已被删除，或链接错误。
            </p>
          </div>

          <template v-else>
            <!-- ── 主区：状态流转（主导操作，无 label） ── -->
            <div class="mb-6 w-full">
              <ol class="flex items-stretch" role="list">
                <li
                  v-for="(s, i) in STATUSES"
                  :key="s"
                  class="relative flex flex-1 flex-col items-center"
                >
                  <!-- 连接线 -->
                  <!-- <span
                    v-if="i > 0"
                    class="absolute top-3.5 right-1/2 w-full"
                    :class="
                      i <= statusIndex ? 'border-success' : ''
                    "
                    style="border-top-width: 1px; transform: translateY(-50%)"
                    aria-hidden="true"
                  /> -->
                  <button
                    type="button"
                    class="focus-visible:ring-ring flex items-center gap-1 rounded-full border-2 px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
                    :class="
                      i < statusIndex
                        ? 'border-success bg-success/10 text-success'
                        : i === statusIndex
                          ? 'border-accent/40 bg-accent/10 text-ink'
                          : 'text-muted opacity-60'
                    "
                    :aria-pressed="task.status === s"
                    @click="
                      task.status !== s && $emit('set-status', task.slug, s)
                    "
                  >
                    <svg
                      v-if="i < statusIndex"
                      class="h-3 w-3"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="3"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span
                      v-else
                      class="h-1.5 w-1.5 rounded-full"
                      :class="i === statusIndex ? 'bg-accent' : 'bg-border'"
                    />
                    {{ s }}
                  </button>
                </li>
              </ol>
              <!-- 搁置旁路：仅在非已完成时作为可操作入口 -->
              <button
                v-if="task.status !== '已完成' && task.status !== '已搁置'"
                type="button"
                class="text-muted hover:bg-surface focus-visible:ring-ring hover:text-ink mx-auto mt-2 block max-w-xs cursor-pointer rounded-md px-2 py-2 text-center text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
                @click="$emit('set-status', task.slug, '已搁置')"
              >
                搁置此任务
              </button>
              <p
                v-else-if="task.status === '已搁置'"
                class="text-muted mt-2 text-center text-[11px]"
              >
                已搁置 — 从上面选择一个状态恢复
              </p>
            </div>

            <!-- ── 工作区：关键属性行 + 关联行 ── -->
            <div class="mb-6 space-y-3">
              <!-- badges: 类型 / 优先级 / kind / 范围 / slug -->
              <div class="flex flex-wrap items-center gap-1.5">
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
              </div>

              <!-- 关联行：归属 spec / 截止日 / 阻塞 -->
              <div
                v-if="
                  task.parent_slug ||
                  task.due_date ||
                  (task.blocked_by && task.blocked_by.length)
                "
                class="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs"
              >
                <span v-if="task.parent_slug" class="text-muted">
                  归属
                  <span class="text-ink font-mono font-medium">{{
                    task.parent_slug
                  }}</span>
                </span>
                <span
                  v-if="task.due_date"
                  class="flex items-center gap-1"
                  :class="
                    isOverdue(task.due_date) ? 'text-destructive' : 'text-muted'
                  "
                >
                  <svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fill-rule="evenodd"
                      d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 1 1 0 0 0 0-2H6z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  {{ task.due_date }}
                </span>
                <span
                  v-if="task.blocked_by && task.blocked_by.length"
                  class="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style="background: var(--warning); color: oklch(0.2 0.02 50)"
                >
                  ⛔ 依赖 {{ task.blocked_by.length }} 项
                </span>
              </div>
            </div>

            <!-- ── 主区：描述 + 详情（无 label，高权重） ── -->
            <div
              v-if="task.description"
              class="prose prose-sm text-ink mb-5 max-w-none leading-relaxed"
              v-html="renderMarkdown(task.description)"
            />
            <div
              v-if="task.detail"
              class="prose prose-sm text-ink mb-5 max-w-none leading-relaxed"
              v-html="renderMarkdown(task.detail)"
            />

            <hr class="my-5" />

            <!-- ── 附区：元信息（弱化：label + 更轻的文字色） ── -->
            <div class="space-y-4">
              <!-- 验收标准 -->
              <div v-if="task.acceptance_criteria">
                <span
                  class="text-muted mb-1 block font-serif text-xs tracking-widest"
                >
                  验收标准
                </span>
                <div
                  class="prose prose-sm text-muted max-w-none"
                  v-html="renderMarkdown(task.acceptance_criteria)"
                />
              </div>

              <!-- 约束 -->
              <div v-if="task.constraints">
                <span
                  class="text-muted mb-1 block font-serif text-xs tracking-widest"
                >
                  约束
                </span>
                <div
                  class="prose prose-sm text-muted max-w-none"
                  v-html="renderMarkdown(task.constraints)"
                />
              </div>

              <!-- 上下文指针 -->
              <div v-if="task.context_pointers">
                <span
                  class="text-muted mb-1 block font-serif text-xs tracking-widest"
                >
                  上下文指针
                </span>
                <pre
                  class="text-muted font-mono text-[12px] leading-relaxed break-words whitespace-pre-wrap"
                  >{{ task.context_pointers }}</pre>
              </div>

              <!-- 元数据 -->
              <div>
                <span
                  class="text-muted mb-1 block font-serif text-xs tracking-widest"
                >
                  元数据
                </span>
                <p class="text-muted font-mono text-[11px] leading-relaxed">
                  ID: {{ task.id }}<br />
                  创建于 {{ (task.created_at || '').slice(0, 10) }} · 更新于
                  {{ (task.updated_at || '').slice(0, 10) }}
                </p>
              </div>
            </div>
          </template>
        </div>

        <!-- footer -->
        <footer
          class="flex shrink-0 items-center justify-between gap-2 border-t px-5 py-3"
        >
          <button
            class="text-destructive hover:bg-destructive/10 focus-visible:ring-destructive/30 cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            @click="$emit('delete', task!.slug)"
          >
            永久删除
          </button>
          <div class="flex items-center gap-2">
            <button
              class="text-muted hover:bg-surface focus-visible:ring-ring cursor-pointer rounded-lg px-3.5 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              @click="$emit('close')"
            >
              关闭
            </button>
            <button
              class="bg-accent text-ink hover:bg-accent/90 focus-visible:ring-ring cursor-pointer rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              @click="$emit('edit', task!.slug)"
            >
              编辑
            </button>
          </div>
        </footer>
      </motion.aside>
    </AnimatePresence>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { AnimatePresence, motion } from 'motion-v';
import { FADE_FAST, SPRING_SNUG } from '@/constants';
import type { DevTask, DevTaskStatus } from '@/features/todos/api';
import { renderMarkdown } from '@/composables';
import TypeBadge from './TypeBadge.vue';
import PriorityBadge from './PriorityBadge.vue';
import KindBadge from './KindBadge.vue';

// 主线状态流转（有顺序）：已搁置是旁路，不开进主线
const STATUSES: DevTaskStatus[] = ['待评估', '待排期', '进行中', '已完成'];

const props = defineProps<{
  open: boolean;
  task: DevTask | null;
}>();

defineEmits<{
  close: [];
  'set-status': [slug: string, status: DevTaskStatus];
  edit: [slug: string];
  delete: [slug: string];
}>();

// 当前任务在主线中的位置；-1 表示不在主线（已搁置）
const statusIndex = computed(() =>
  props.task ? STATUSES.indexOf(props.task.status) : -1,
);

function isOverdue(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dateStr) < today;
}
</script>
