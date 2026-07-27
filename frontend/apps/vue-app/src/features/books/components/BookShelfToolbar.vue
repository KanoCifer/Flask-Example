<template>
  <div
    class="bg-page/85 top-0 z-20 -mx-4 mb-6 px-4 pt-3 pb-3 backdrop-blur-md sm:-mx-6 sm:px-6 md:-mx-10 md:px-10"
  >
    <!-- Row 1: 搜索 + 密度切换 -->
    <div class="flex items-center gap-2">
      <div class="relative flex-1">
        <Search
          class="text-muted pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
        />
        <input
          :value="searchQuery"
          type="text"
          placeholder="搜索书名或作者…"
          class="bg-page placeholder:text-muted/50 focus:border-accent focus:ring-accent/20 w-full rounded-xl border py-2 pr-3 pl-9 text-sm transition-colors outline-none focus:ring-2"
          @input="onSearchInput"
        />
      </div>

      <!-- 密度切换 -->
      <div
        class="bg-page relative hidden items-center rounded-xl border p-0.5 sm:flex"
        role="group"
        aria-label="书架密度"
      >
        <span
          class="bg-accent pointer-events-none absolute top-1/2 left-0.5 size-9 rounded-lg shadow-sm transition-transform duration-280 ease-in-out"
          :style="{
            transform: `translate(${36 * densityIndex}px, -50%)`,
          }"
        >
        </span>
        <Button
          v-for="opt in DENSITY_OPTIONS"
          :key="opt.key"
          size="icon"
          variant="ghost"
          :aria-pressed="density === opt.key"
          :aria-label="opt.label"
          :title="opt.label"
          :class="[
            '!active:scale-100 z-10 !rounded-lg',
            density === opt.key
              ? 'bg-accent text-contrast! shadow-sm hover:bg-transparent!'
              : 'text-muted hover:text-ink',
          ]"
          @click="onDensityChange(opt.key)"
        >
          <component :is="opt.icon" class="h-4 w-4" />
        </Button>
      </div>

      <!-- 排序下拉 -->
      <HoverDropdown
        panel-class="bg-page absolute top-full right-0 z-30 mt-1 w-36 overflow-hidden rounded-xl border shadow-lg"
      >
        <template #trigger="{ isOpen }">
          <Button
            variant="outline"
            :aria-expanded="isOpen"
            aria-haspopup="menu"
            class="bg-page hover:bg-surface text-ink h-9 gap-1.5 px-3 text-sm"
          >
            <ArrowUpDown class="h-4 w-4" />
            <span class="hidden sm:inline">{{ activeSortLabel }}</span>
            <ChevronDown
              class="h-3.5 w-3.5 opacity-60 transition-transform duration-150"
              :class="{ 'rotate-180': isOpen }"
            />
          </Button>
        </template>
        <template #default="{ close }">
          <div role="menu">
            <Button
              v-for="opt in SORT_OPTIONS"
              :key="opt.key"
              variant="ghost"
              class="!active:scale-100 text-ink hover:bg-surface flex w-full items-center justify-between !rounded-none px-3 py-2 text-sm font-normal"
              role="menuitemradio"
              :aria-checked="sort === opt.key"
              @click="onSelectSort(opt.key, close)"
            >
              <span>{{ opt.label }}</span>
              <Check v-if="sort === opt.key" class="text-ink h-3.5 w-3.5" />
            </Button>
          </div>
        </template>
      </HoverDropdown>
    </div>

    <!-- Row 2: 状态 chip -->
    <div
      class="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-0.5"
      role="tablist"
      aria-label="书籍状态"
    >
      <Button
        v-for="chip in CHIPS"
        :key="chip.key"
        :class="[
          '!active:scale-100 h-8 gap-1.5 !rounded-full px-3 text-xs',
          filter === chip.key
            ? 'bg-accent text-contrast border'
            : 'bg-page text-muted hover:border-ink/20 hover:text-ink border',
        ]"
        role="tab"
        :aria-selected="filter === chip.key"
        @click="$emit('update:filter', chip.key)"
      >
        <span>{{ chip.label }}</span>
        <span
          class="tabular-nums"
          :class="filter === chip.key ? 'opacity-90' : 'opacity-60'"
        >
          {{ countOf(chip.key) }}
        </span>
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  Grid3x3,
  LayoutGrid,
  List,
  Search,
} from '@lucide/vue';
import { Button, HoverDropdown } from '@/components';
import type {
  ShelfDensity,
  ShelfFilter,
  ShelfSort,
} from '../composables/useShelfView';

interface Counts {
  all: number;
  reading: number;
  finished: number;
  wishlist: number;
}

const props = defineProps<{
  searchQuery: string;
  filter: ShelfFilter;
  sort: ShelfSort;
  density: ShelfDensity;
  counts: Counts;
}>();

const emit = defineEmits<{
  (e: 'update:searchQuery', value: string): void;
  (e: 'update:filter', value: ShelfFilter): void;
  (e: 'update:sort', value: ShelfSort): void;
  (e: 'update:density', value: ShelfDensity): void;
}>();

const CHIPS = [
  { key: 'all' as const, label: '全部' },
  { key: 'reading' as const, label: '在读' },
  { key: 'finished' as const, label: '已读' },
  { key: 'wishlist' as const, label: '待读' },
];

const SORT_OPTIONS = [
  { key: 'recent' as const, label: '最近更新' },
  { key: 'title' as const, label: '按书名' },
  { key: 'author' as const, label: '按作者' },
];

const DENSITY_OPTIONS = [
  { key: 'compact' as const, label: '紧凑', icon: Grid3x3 },
  { key: 'standard' as const, label: '标准', icon: LayoutGrid },
  { key: 'list' as const, label: '列表', icon: List },
];

const activeSortLabel = computed(
  () => SORT_OPTIONS.find((o) => o.key === props.sort)?.label ?? '排序',
);

const densityIndex = computed(() => {
  const index = DENSITY_OPTIONS.findIndex(
    (option) => option.key === props.density,
  );
  return Math.max(index, 0);
});

function onDensityChange(value: ShelfDensity) {
  emit('update:density', value);
}

function onSearchInput(e: Event) {
  emit('update:searchQuery', (e.target as HTMLInputElement).value);
}

function onSelectSort(key: ShelfSort, close: () => void) {
  emit('update:sort', key);
  close();
}

function countOf(key: ShelfFilter) {
  return props.counts[key];
}
</script>
