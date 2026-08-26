<template>
  <aside
    :class="[
      'sidebar-collapse-transition bg-secondary/70 top-20 hidden shrink-0 space-y-1 self-start rounded-tr-3xl px-4 py-6 lg:sticky lg:block lg:h-[calc(100vh-5rem)]',
      collapsed ? 'lg:w-14' : 'lg:w-60',
    ]"
  >
    <div
      :class="[
        'flex',
        collapsed
          ? 'justify-center pb-2'
          : 'items-center justify-between px-3 pb-2',
      ]"
    >
      <span
        v-if="!collapsed"
        class="text-muted font-serif text-xs tracking-widest"
        >工作台</span
      >
      <button
        type="button"
        :title="collapsed ? '展开工作台' : '收起工作台'"
        :aria-label="collapsed ? '展开工作台' : '收起工作台'"
        :aria-expanded="!collapsed"
        aria-controls="todo-sidebar-nav"
        class="text-muted hover:bg-accent/10 hover:text-ink focus-visible:ring-ring rounded-md p-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        @click="collapsed = !collapsed"
      >
        <ChevronLeft v-if="!collapsed" class="h-4 w-4" aria-hidden="true" />
        <ChevronRight v-else class="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
    <nav
      id="todo-sidebar-nav"
      role="tablist"
      aria-label="工作台视角"
      class="relative"
    >
      <!-- 滑动指示器 -->
      <span
        :class="[
          'tab-indicator bg-accent/10 absolute top-0 left-0 z-0 w-full rounded-lg shadow-[inset_0_1px_0_0_oklch(from_var(--page)_l_c_h_/_0.5),inset_0_-1px_1px_oklch(0_0_0_/_0.04)]',
          collapsed ? 'h-8' : 'h-9',
        ]"
        :style="{ transform: `translateY(${indicatorY}px)` }"
      />
      <button
        v-for="(tab, index) in tabs"
        :key="tab.id"
        role="tab"
        :aria-selected="activeTab === tab.id"
        :title="collapsed ? tab.label : undefined"
        class="focus-visible:ring-ring relative z-10 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-[color,transform] duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.96]"
        :class="[
          activeTab === tab.id ? 'text-ink' : 'text-muted hover:text-ink',
          collapsed ? 'justify-center' : '',
        ]"
        @click="activeTab = tab.id"
      >
        <component :is="tab.icon" class="h-4 w-4 shrink-0" />
        <span v-if="!collapsed" class="flex-1 text-left">{{ tab.label }}</span>
        <span
          v-if="!collapsed"
          :class="[
            'inline-block min-w-[1.25rem] rounded-full px-1.5 text-center text-[10px] font-medium tabular-nums transition-[background-color,color] duration-150',
            index === activeTabIndex
              ? 'bg-accent/15 text-ink'
              : 'bg-surface/10 text-muted',
          ]"
        >
          {{ tab.count }}
        </span>
      </button>
    </nav>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  Rocket,
  ClipboardList,
  KanbanSquare,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from '@lucide/vue';
import { useV3DevTaskStore } from '@/features/todos/stores/v3devtasks';

const activeTab = defineModel<'frontier' | 'planning' | 'review' | 'kanban'>({
  required: true,
});
const collapsed = defineModel<boolean>('collapsed', { default: false });

const store = useV3DevTaskStore();

// Tab 按钮高度 = py-2 (16px) + 内容最高项
//   展开态：text-sm 行高 ~20px → 36px（h-9）
//   折叠态：仅 h-4 图标 (16px) → 32px（h-8）
const TAB_ITEM_HEIGHT = computed(() => (collapsed.value ? 32 : 36));

const activeTabIndex = computed(() =>
  tabs.value.findIndex((t) => t.id === activeTab.value),
);
const indicatorY = computed(() => activeTabIndex.value * TAB_ITEM_HEIGHT.value);

// 计数全部走 store.derived —— store.derived 是单次 O(N) 派生的 computed，
// 这层 computed 只在 derived 重算时再算一次（O(1)），整个 sidebar 一次性。
// 之前直接调 frontier/totalActive/completedCount 是各自再走一遍 N 遍历。
const frontierCount = computed(() => store.derived.frontier.length);
const activeCount = computed(() => store.derived.activeCount);
const completedCount = computed(() => store.derived.completedCount);

const tabs = computed(() => [
  {
    id: 'frontier' as const,
    label: '推进',
    icon: Rocket,
    count: frontierCount.value,
  },
  {
    id: 'planning' as const,
    label: '规划',
    icon: ClipboardList,
    count: activeCount.value,
  },
  {
    id: 'kanban' as const,
    label: '看板',
    icon: KanbanSquare,
    count: activeCount.value,
  },
  {
    id: 'review' as const,
    label: '回顾',
    icon: CheckCircle2,
    count: completedCount.value,
  },
]);
</script>

<style scoped>
/* Tab 指示器滑动过渡：与 BasicNav indicator 同缓动 cubic-bezier(.32,.72,0,1) */
.tab-indicator {
  transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
}

/* 折叠态缩放过渡：走 transform，避免触发父 grid `auto_1fr` 重排；
 * 真实宽度仍由 lg:w-14 / lg:w-60 类同步切换，但动画只补一层视觉插值，
 * 主线程不再做 layout/paint，只做合成层 transform，60fps。 */
.sidebar-collapse-transition {
  /* ponytail: 用 transform 替代 width 动画，绕开 grid layout；
   * 升级路径：若未来 grid 改为 flex-basis 容器，可改回 width。 */
  transform-origin: left center;
  transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
}

@media (prefers-reduced-motion: reduce) {
  .tab-indicator,
  .sidebar-collapse-transition {
    transition: none;
  }
}
</style>
