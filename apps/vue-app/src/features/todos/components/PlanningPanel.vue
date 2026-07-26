<template>
  <div class="space-y-4">
    <TodoFilterBar
      :filter-type="filterType"
      :filter-priority="filterPriority"
      :filter-member="filterMember"
      :member-chips="memberChips"
      v-model:search-term="searchTerm"
      :count="filteredPlanning.length"
      @toggle="(p) => toggleFilter(p.key, p.value)"
    />

    <!-- index list -->
    <div class="overflow-hidden rounded-xl border">
      <div
        v-for="task in filteredPlanning"
        :key="task.slug"
        class="hover:bg-accent/5 group relative flex cursor-pointer items-center gap-3 border-b px-4 py-3 transition-colors last:border-b-0"
        role="button"
        tabindex="0"
        :aria-label="`任务: ${task.title}`"
        @click="$emit('open', task.slug)"
        @keydown.enter="$emit('open', task.slug)"
      >
        <span
          class="absolute inset-y-0 left-0 w-[2px]"
          :class="typeBarClass(task.type)"
          aria-hidden="true"
        />

        <span class="text-ink min-w-0 flex-1 truncate font-serif text-base">
          {{ task.title }}
        </span>

        <span
          class="text-muted hidden text-xs whitespace-nowrap tabular-nums sm:inline"
        >
          {{ task.type }} · {{ task.priority }} · {{ task.status }}
        </span>

        <button
          type="button"
          class="text-muted hover:bg-destructive/10 hover:text-destructive focus-visible:ring-ring rounded-md p-2 transition-[color,transform] focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none active:scale-[0.96] active:not-focus-visible:ring-0"
          title="删除"
          aria-label="删除"
          @click.stop="$emit('delete', task.slug)"
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
      </div>

      <div
        v-if="!filteredPlanning.length"
        class="text-muted/70 flex flex-col items-center justify-center px-4 py-12 text-center"
      >
        <svg
          class="text-muted/30 mb-3 h-7 w-7"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
        <p class="font-serif text-sm">没有匹配的任务</p>
        <p class="text-xs">去新建一个，或放宽筛选条件</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useV3DevTaskStore } from '@/features/todos/stores/v3devtasks';
import type { DevTaskPriority, DevTaskType } from '@/features/todos/api';
import TodoFilterBar, { type MemberChip } from './TodoFilterBar.vue';

const store = useV3DevTaskStore();

// 左缘 type-color 细线 — Layer 3 语义 token 映射，不引入新颜色。
// 技术债用 muted-muted（中性灰），对位"结构性、非紧急"的语义。
const TYPE_BAR_CLASS: Record<DevTaskType, string> = {
  功能需求: 'bg-warning',
  问题: 'bg-destructive',
  优化: 'bg-success',
  技术债: 'bg-surface',
};

function typeBarClass(type: DevTaskType): string {
  return TYPE_BAR_CLASS[type];
}

const filterType = ref<Set<DevTaskType>>(new Set());
const filterPriority = ref<Set<DevTaskPriority>>(new Set());
const filterMember = ref<Set<number>>(new Set());
const searchTerm = ref('');

/** 成员 chip —— 从任务 user_id 聚合，始终展示（含仅 1 成员场景）。
 *  与 KanbanPanel 的同名 computed 完全一致；PlanningPanel 也支持成员筛选
 *  以便 multi-user 场景下"只看我的待规划任务"。 */
const memberChips = computed<MemberChip[]>(() => {
  const map = new Map<number, { count: number }>();
  for (const t of store.tasks) {
    if (t.is_deleted) continue;
    const e = map.get(t.user_id) ?? { count: 0 };
    e.count += 1;
    map.set(t.user_id, e);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .map(([userId, { count }]) => ({
      userId,
      label: `用户 ${userId}`,
      count,
    }));
});

const filteredPlanning = computed(() => {
  const q = searchTerm.value.trim().toLowerCase();
  return store.tasks
    .filter((t) => !t.is_deleted && t.status !== '已完成')
    .filter((t) =>
      filterType.value.size ? filterType.value.has(t.type) : true,
    )
    .filter((t) =>
      filterPriority.value.size ? filterPriority.value.has(t.priority) : true,
    )
    .filter((t) =>
      filterMember.value.size ? filterMember.value.has(t.user_id) : true,
    )
    .filter((t) => (q ? (t.title ?? '').toLowerCase().includes(q) : true));
});

function toggleFilter(
  key: 'type' | 'priority' | 'member',
  val: DevTaskType | DevTaskPriority | number,
) {
  if (key === 'type') {
    const v = val as DevTaskType;
    const s = filterType.value;
    if (s.has(v)) s.delete(v);
    else s.add(v);
  } else if (key === 'priority') {
    const v = val as DevTaskPriority;
    const s = filterPriority.value;
    if (s.has(v)) s.delete(v);
    else s.add(v);
  } else {
    const v = val as number;
    const s = filterMember.value;
    if (s.has(v)) s.delete(v);
    else s.add(v);
  }
}

defineEmits<{
  open: [slug: string];
  delete: [slug: string];
}>();
</script>
