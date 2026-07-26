<template>
  <nav
    role="tablist"
    aria-label="工作台视角"
    class="bg-surface mb-5 flex gap-0.5 rounded-lg p-1 lg:hidden"
  >
    <button
      v-for="tab in tabs"
      :key="tab.id"
      role="tab"
      :aria-selected="activeTab === tab.id"
      class="focus-visible:ring-ring relative flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-[color,transform] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.96]"
      :class="
        activeTab === tab.id
          ? 'bg-page text-ink shadow-[0_1px_2px_color-mix(in_oklch,var(--ink)_6%,transparent),inset_0_1px_0_0_oklch(from_var(--page)_l_c_h_/_0.6)]'
          : 'text-muted hover:text-ink'
      "
      @click="activeTab = tab.id"
    >
      {{ tab.label }}
      <span
        class="ml-1.5 inline-block min-w-[1.25rem] rounded-full px-1.5 text-center text-[10px] font-medium tabular-nums"
        :class="
          activeTab === tab.id
            ? 'text-ink bg-accent/15'
            : 'text-muted bg-surface/10'
        "
      >
        {{ tab.count }}
      </span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useV3DevTaskStore } from '@/features/todos/stores/v3devtasks';
import {
  frontier,
  totalActive,
  completedCount,
} from '@/features/todos/composables';

const activeTab = defineModel<'frontier' | 'planning' | 'review' | 'kanban'>({
  required: true,
});

const store = useV3DevTaskStore();

const tabs = computed(() => [
  {
    id: 'frontier' as const,
    label: '推进',
    count: frontier(store.tasks).length,
  },
  { id: 'planning' as const, label: '规划', count: totalActive(store.tasks) },
  { id: 'kanban' as const, label: '看板', count: totalActive(store.tasks) },
  { id: 'review' as const, label: '回顾', count: completedCount(store.tasks) },
]);
</script>
