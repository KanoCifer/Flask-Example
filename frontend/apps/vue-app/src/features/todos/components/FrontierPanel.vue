<template>
  <div class="space-y-10">
    <!-- ── HERO: frontier ── what's unblocked and actionable right now -->
    <section>
      <div class="mb-4">
        <div class="flex items-center gap-2.5">
          <h2 class="text-ink font-serif text-xl font-medium tracking-tight">
            现在能做什么
          </h2>
          <span
            v-if="frontierTasks.length"
            class="bg-accent/15 text-ink inline-block min-w-5 rounded-full px-1.5 text-center text-[11px] font-medium tabular-nums"
          >
            {{ frontierTasks.length }}
          </span>
        </div>
        <p class="text-muted mt-1 text-xs">
          <span class="italic">ready to pick up</span> ·
          无阻塞，按优先级与截止日排序
        </p>
      </div>

      <div
        v-if="frontierTasks.length"
        class="contain-intrinsic-size-[auto_600px] columns-1 gap-x-3 sm:columns-2 lg:columns-3"
      >
        <div
          v-for="(task, i) in frontierTasks"
          :key="task.slug"
          class="frontier-card-enter mb-3 break-inside-avoid [content-visibility:auto]"
          :style="{ '--stagger': `${Math.min(i, 8) * 40}ms` }"
        >
          <FrontierCard
            :task="task"
            @open="$emit('open', $event)"
            @cycle="$emit('cycle', $event)"
            @delete="$emit('delete', $event)"
          />
        </div>
      </div>

      <!-- empty state that teaches: all-clear vs everything-blocked -->
      <div
        v-else
        class="text-muted/70 flex flex-col items-center justify-center py-12 text-center"
      >
        <svg
          class="text-muted/30 mb-2 h-8 w-8"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
        <template v-if="activeCount === 0">
          <p class="text-sm font-medium">都完成了，今天可以合上电脑</p>
          <p class="text-xs">没有待推进的任务</p>
        </template>
        <template v-else>
          <p class="text-sm font-medium">{{ blockedCount }} 个任务在等待前置</p>
          <p class="text-xs">先去推进它们的前置，或新建一个独立任务</p>
        </template>
      </div>
    </section>

    <!-- ── SECONDARY TIER: in-progress + done, quieter and grouped ── -->
    <div class="border-border space-y-6 border-t pt-8">
      <!-- in progress -->
      <section>
        <div class="mb-3 flex items-baseline justify-between">
          <div class="flex items-center gap-2">
            <h3
              class="text-ink font-serif text-base font-medium tracking-tight"
            >
              进行中
            </h3>
            <span
              v-if="inProgressTasks.length"
              class="bg-surface/10 text-muted inline-block min-w-5 rounded-full px-1.5 text-center text-[11px] font-medium tabular-nums"
            >
              {{ inProgressTasks.length }}
            </span>
          </div>
          <span class="text-muted text-xs">正在推进的任务</span>
        </div>
        <div v-if="inProgressTasks.length" class="space-y-2">
          <TaskRow
            v-for="task in inProgressTasks"
            :key="task.slug"
            :task="task"
            @open="$emit('open', $event)"
            @cycle="$emit('cycle', $event)"
            @delete="$emit('delete', $event)"
          />
        </div>
        <div
          v-else
          class="text-muted/70 flex items-center justify-center py-6 text-sm"
        >
          {{
            frontierTasks.length
              ? '从「现在能做什么」挑一个开始推进'
              : '暂无进行中的任务'
          }}
        </div>
      </section>

      <!-- done this week -->
      <section>
        <div class="mb-3 flex items-baseline justify-between">
          <div class="flex items-center gap-2">
            <h3
              class="text-ink font-serif text-base font-medium tracking-tight"
            >
              本周已完成
            </h3>
            <span
              v-if="doneThisWeek.length"
              class="bg-surface/10 text-muted inline-block min-w-5 rounded-full px-1.5 text-center text-[11px] font-medium tabular-nums"
            >
              {{ doneThisWeek.length }}
            </span>
          </div>
          <span class="text-muted text-xs">最近关闭的任务</span>
        </div>
        <div v-if="doneThisWeek.length" class="space-y-2">
          <TaskRow
            v-for="task in doneThisWeek"
            :key="task.slug"
            :task="task"
            :done="true"
            @open="$emit('open', $event)"
            @delete="$emit('delete', $event)"
          />
        </div>
        <div
          v-else
          class="text-muted/70 flex items-center justify-center py-6 text-sm"
        >
          本周还没有完成的任务
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import FrontierCard from './FrontierCard.vue';
import TaskRow from './TaskRow.vue';
import { useV3DevTaskStore } from '@/features/todos/stores/v3devtasks';

const store = useV3DevTaskStore();

// 所有派生数据走 store.derived —— 单次遍历、4 个 panel 共享。
//
// 注意：不能用 `toRefs(store.derived)`。`store.derived` 是 store 的 computed
// getter，访问时返回当前值（plain 对象快照）。`toRefs(snapshot)` 把每个属性
// 锚到 **第一次读到的那个对象**，之后 derived 重算出新对象，toRefs 出来的
// ref 仍然指向旧快照 —— panel 永远不刷新。所以这里把每个字段单独包成 computed
// 读 `store.derived.<field>`，computed 缓存并跟踪 store.derived 的重算。
const frontierTasks = computed(() => store.derived.frontier);
const inProgressTasks = computed(() => store.derived.inProgress);
const doneThisWeek = computed(() => store.derived.completedThisWeek);
const activeCount = computed(() => store.derived.activeCount);
const blockedCount = computed(() => store.derived.blockedCount);

defineEmits<{
  open: [slug: string];
  cycle: [slug: string];
  delete: [slug: string];
}>();
</script>

<style scoped>
/* frontier 卡片进入时的轻量错落 —— 每次进入「推进」视图重放一次。
   40ms 递进，index>8 后封顶，避免长列表尾部等待过久。 */
.frontier-card-enter {
  animation: frontier-card-in 280ms cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: var(--stagger, 0ms);
}

@keyframes frontier-card-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .frontier-card-enter {
    animation: none;
  }
}
</style>
