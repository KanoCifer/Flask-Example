<template>
  <div
    class="bg-secondary flex flex-wrap items-center gap-2 rounded-xl px-4 py-3"
    role="group"
    aria-label="筛选条件"
  >
    <span class="text-muted font-serif text-xs tracking-widest">类型</span>
    <button
      v-for="t in TASK_TYPES"
      :key="t"
      class="rounded-full border px-2.5 py-0.5 text-xs transition-colors"
      :class="
        filterType.has(t)
          ? 'border-accent/40 bg-accent/10 text-ink'
          : 'text-muted hover:text-ink'
      "
      :aria-pressed="filterType.has(t)"
      @click="$emit('toggle', { key: 'type', value: t })"
    >
      {{ t }}
    </button>

    <span class="bg-border mx-1 hidden h-4 w-px sm:inline-block" />

    <span class="text-muted font-serif text-xs tracking-widest">优先级</span>
    <button
      v-for="p in PRIORITIES"
      :key="p"
      class="rounded-full border px-2.5 py-0.5 text-xs transition-colors"
      :class="
        filterPriority.has(p)
          ? 'border-accent/40 bg-accent/10 text-ink'
          : 'text-muted hover:text-ink'
      "
      :aria-pressed="filterPriority.has(p)"
      @click="$emit('toggle', { key: 'priority', value: p })"
    >
      {{ p }}
    </button>

    <template v-if="memberChips.length">
      <span class="bg-border mx-1 hidden h-4 w-px sm:inline-block" />
      <span class="text-muted font-serif text-xs tracking-widest">成员</span>
      <button
        v-for="m in memberChips"
        :key="m.userId"
        class="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs transition-colors"
        :class="
          filterMember.has(m.userId)
            ? 'border-accent/40 bg-accent/10 text-ink'
            : 'text-muted hover:text-ink'
        "
        :aria-pressed="filterMember.has(m.userId)"
        :title="`仅看 ${m.label}`"
        @click="$emit('toggle', { key: 'member', value: m.userId })"
      >
        <MemberAvatar :user-id="m.userId" size="xs" />
        {{ m.label }}
      </button>
    </template>

    <label class="ml-auto flex items-center gap-1.5">
      <span class="sr-only">搜索任务标题</span>
      <svg
        class="text-muted h-3.5 w-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
        />
      </svg>
      <input
        :value="searchTerm"
        type="search"
        placeholder="搜索标题…"
        class="bg-page text-ink placeholder:text-muted/60 focus-visible:ring-ring w-32 rounded-md border px-2 py-1 text-xs focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none sm:w-40"
        @input="
          $emit('update:searchTerm', ($event.target as HTMLInputElement).value)
        "
      />
    </label>

    <span class="text-muted text-xs tabular-nums"> {{ count }} 项 </span>
  </div>
</template>

<script setup lang="ts">
import type { DevTaskPriority, DevTaskType } from '@/features/todos/api';
import { PRIORITIES } from '@/features/todos/composables';
import MemberAvatar from './MemberAvatar.vue';

export interface MemberChip {
  userId: number;
  label: string;
}

const TASK_TYPES: DevTaskType[] = ['功能需求', '问题', '优化', '技术债'];

defineProps<{
  filterType: Set<DevTaskType>;
  filterPriority: Set<DevTaskPriority>;
  filterMember: Set<number>;
  memberChips: MemberChip[];
  searchTerm: string;
  count: number;
}>();

defineEmits<{
  toggle: [
    {
      key: 'type' | 'priority' | 'member';
      value: DevTaskType | DevTaskPriority | number;
    },
  ];
  'update:searchTerm': [string];
}>();
</script>
