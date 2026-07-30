<script setup lang="ts">
/**
 * FishingSidebar —— 编辑图鉴式左侧栏（任务 284）。
 *
 * 编辑图鉴感来源:
 * - 大号 display 字体 (font-family-averia) 的章节标题「钓点地图」
 * - 编号 + 鱼形 pin(同地图 marker 配色),不是泛化的圆形 chip
 * - 列表项像杂志目录:序号大字 · 名称(serif 偏粗) · region 副标题 · kind 小字标签
 * - filter chips 收紧成细横排,无重型按钮感
 * - 充足留白 + 1px hairline 分隔(走主题 border)
 *
 * 视觉语言: 沿用项目事实上的 display 字体 font-family-averia;配色全部走
 * 主题 token (bg-page / bg-surface / text-ink / text-muted / bg-accent /
 * bg-secondary / border 等);无硬编码颜色,无新增字体 / 主题 token。
 *
 * 事件:
 * - select(spot) — 列表项点击;父组件触发 flyTo + hover preview
 * - locate() — header 定位按钮
 * - addSpot() — header 添加钓点入口
 * - changeFilter(kinds) — chip 切换;父组件驱动 map.setVisibleKinds
 */
import {
  FISHING_SPOT_KINDS,
  FISHING_SPOT_KIND_LABELS,
} from '@readinglist/types';
import type { FishingSpotKind, MapMarker } from '@readinglist/types';
import { Loader2, Locate, Plus } from '@lucide/vue';
import { AnimatePresence, Motion } from 'motion-v';
import { computed, ref } from 'vue';
import { EASE } from '@/constants';

interface Props {
  spots: MapMarker[];
  /**
   * 当前选中 marker 的 id —— 用 id 比较而非 index,
   * 因为 sidebar 已按 chip 过滤,index 范围与父组件持有的原始 spots 数组不再对齐。
   */
  selectedId: string | null;
  /** 定位中态,影响 Locate icon crossfade */
  isLocating?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isLocating: false,
});

const emit = defineEmits<{
  select: [spot: MapMarker];
  locate: [];
  addSpot: [];
  changeFilter: [kinds: Set<FishingSpotKind>];
}>();

/**
 * 本地筛选状态 —— 空 Set 表示「全部」,Set 元素为用户选中的 kind。
 * emit changeFilter 给父组件;父组件负责把状态同步给 MapContainer。
 */
const selectedKinds = ref<Set<FishingSpotKind>>(new Set());

/** 筛选后的 spot 列表 —— 按原始顺序,无 kind 过滤切换导致的重排 */
const visibleSpots = computed<MapMarker[]>(() => {
  if (selectedKinds.value.size === 0) return props.spots;
  return props.spots.filter((m) => m.kind && selectedKinds.value.has(m.kind));
});

const allActive = computed(() => selectedKinds.value.size === 0);

/** 每个 kind 在 props.spots 中的计数 —— 给 chip 副信息 */
const kindCount = computed<Record<FishingSpotKind, number>>(() => {
  const counts = Object.fromEntries(
    FISHING_SPOT_KINDS.map((k) => [k, 0]),
  ) as Record<FishingSpotKind, number>;
  for (const spot of props.spots) {
    if (spot.kind && spot.kind in counts) counts[spot.kind]++;
  }
  return counts;
});

/**
 * Chip 点击 → toggle kind。「全部」与 kind chips 互斥。
 */
function toggleKind(kind: FishingSpotKind): void {
  const next = new Set(selectedKinds.value);
  if (next.has(kind)) {
    next.delete(kind);
  } else {
    next.add(kind);
  }
  selectedKinds.value = next;
  emit('changeFilter', next);
}

function selectAll(): void {
  selectedKinds.value = new Set();
  emit('changeFilter', new Set());
}

/** 列表项 region 字段:MapMarker.extraData 不含 region,留作后端扩展 */
function regionLabel(spot: MapMarker): string {
  const description = spot.extraData?.description?.trim();
  if (!description) return '';
  return description.length > 14 ? `${description.slice(0, 14)}…` : description;
}

/**
 * 鱼形 pin 颜色 —— 与地图鱼形 marker 视觉一致:
 * - lake → accent, river → secondary, reservoir → page (背景对比),
 *   null / unknown → muted
 */
const PIN_KIND_BG: Record<FishingSpotKind, string> = {
  lake: 'bg-accent',
  river: 'bg-secondary',
  reservoir: 'bg-page',
};
</script>

<template>
  <aside
    class="bg-page text-ink flex h-full min-h-0 flex-col"
    aria-label="钓点地图侧栏"
  >
    <!-- Header: 编辑图鉴式标题 + Locate / AddSpot -->
    <header class="shrink-0 px-6 pt-15 pb-5">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <!-- Eyebrow:小型 display label,提示分区 -->
          <p
            class="text-muted font-family-averia mb-2 text-[10px] tracking-[0.32em] uppercase"
          >
            Fishing Atlas
          </p>
          <!-- 主导 display 标题 -->
          <h3
            class="text-ink font-serif text-[34px] leading-[1.05] font-bold tracking-tight"
          >
            钓点地图
          </h3>
          <!-- 副标题:计数 + 点提示 -->
          <p class="text-muted mt-3 text-xs leading-relaxed">
            <span class="text-ink font-medium tabular-nums">
              {{ visibleSpots.length }}
            </span>
            <span class="opacity-70"> / {{ props.spots.length }} 个钓点</span>
          </p>
        </div>

        <!-- Icon actions:右上角圆角小按钮 -->
        <div class="flex shrink-0 items-center gap-1.5 pt-1">
          <button
            type="button"
            class="text-ink hover:bg-surface inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors duration-150"
            :disabled="props.isLocating"
            aria-label="定位到当前位置"
            @click="emit('locate')"
          >
            <span
              class="icon-crossfade"
              :class="{ 'is-active': props.isLocating }"
              aria-hidden="true"
            >
              <Locate
                class="icon-crossfade__item icon-crossfade__item--enter h-4 w-4"
              />
              <Loader2
                class="icon-crossfade__item icon-crossfade__item--exit h-4 w-4"
              />
            </span>
          </button>

          <button
            type="button"
            class="text-ink hover:bg-surface inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors duration-150"
            aria-label="添加钓点"
            @click="emit('addSpot')"
          >
            <Plus class="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>

    <!-- Hairline 分隔 -->
    <div class="border-border shrink-0 border-t" aria-hidden="true" />

    <!-- Filter chips -->
    <div
      class="shrink-0 px-6 pt-4 pb-4"
      role="group"
      aria-label="按水体类型筛选"
    >
      <div class="flex items-baseline justify-between gap-2">
        <p
          class="text-muted font-family-averia text-[10px] tracking-[0.24em] uppercase"
        >
          Filter
        </p>
        <p class="text-muted text-[11px] tabular-nums">
          {{ visibleSpots.length }}
        </p>
      </div>

      <div class="mt-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          class="filter-chip rounded-full"
          :class="
            allActive
              ? 'border-ink text-ink bg-page'
              : 'text-muted hover:text-ink'
          "
          :aria-pressed="allActive"
          @click="selectAll"
        >
          全部
        </button>
        <button
          v-for="kind in FISHING_SPOT_KINDS"
          :key="kind"
          type="button"
          class="filter-chip rounded-full"
          :class="
            selectedKinds.has(kind)
              ? 'border-ink text-ink bg-page'
              : 'text-muted hover:text-ink'
          "
          :aria-pressed="selectedKinds.has(kind)"
          @click="toggleKind(kind)"
        >
          <span
            class="mr-1.5 inline-block h-1.5 w-1.5 rounded-full"
            :class="[
              PIN_KIND_BG[kind],
              selectedKinds.has(kind) ? 'opacity-100' : 'opacity-60',
            ]"
            aria-hidden="true"
          />
          {{ FISHING_SPOT_KIND_LABELS[kind] }}
          <span class="text-muted ml-1.5 text-[10px] tabular-nums opacity-70">
            {{ kindCount[kind] }}
          </span>
        </button>
      </div>
    </div>

    <!-- Hairline 分隔 -->
    <div class="border-border shrink-0 border-t" aria-hidden="true" />

    <!-- Spot list -->
    <AnimatePresence mode="popLayout">
      <ul
        v-if="visibleSpots.length > 0"
        key="spot-list"
        class="min-h-0 flex-1 overflow-y-scroll overscroll-y-contain"
        role="listbox"
        aria-label="钓点列表"
      >
        <Motion
          v-for="(spot, index) in visibleSpots"
          :key="spot.extraData?.id ?? `${spot.position[0]}-${spot.position[1]}`"
          as="li"
          :initial="{ opacity: 0, y: 6 }"
          :animate="{ opacity: 1, y: 0 }"
          :transition="{ ...EASE, delay: index * 0.05 }"
          :exit="{ opacity: 0, y: -4, transition: { ...EASE, duration: 0.15 } }"
          role="option"
          :aria-selected="props.selectedId === (spot.extraData?.id ?? null)"
        >
          <button
            type="button"
            class="spot-row group hover:bg-surface/60 w-full px-6 py-6 text-left transition-colors duration-200"
            :class="
              props.selectedId === (spot.extraData?.id ?? null)
                ? 'bg-surface/80'
                : ''
            "
            @click="emit('select', spot)"
          >
            <!--
            编辑图鉴式行:左列大序号 · 中列鱼形 pin · 右列(主标题 / 副标题 / kind 标签)。
            active 状态:左侧 2px ink 色 hairline,文字加重。
          -->
            <div class="flex items-start gap-3">
              <!-- 序号 (左列,display 字体) -->
              <span
                class="text-muted bg-secondary group-hover:text-ink font-family-averia shrink-0 rounded-full p-1.5 text-sm leading-none tabular-nums"
                :class="
                  props.selectedId === (spot.extraData?.id ?? null)
                    ? 'text-ink'
                    : ''
                "
                aria-hidden="true"
              >
                {{ String(index + 1).padStart(2, '0') }}
              </span>

              <!-- 右列主内容 -->
              <div class="min-w-0 flex-1">
                <p
                  class="text-ink font-family-averia truncate text-[15px] leading-tight font-semibold"
                >
                  {{ spot.extraData?.name || '未命名钓点' }}
                </p>
                <p
                  class="text-muted mt-1 truncate text-xs leading-snug"
                >
                  {{ regionLabel(spot) || '&nbsp;' }}
                </p>
                <p
                  v-if="spot.kind"
                  class="text-muted font-family-averia mt-1.5 text-[10px] tracking-[0.2em] uppercase"
                >
                  {{ FISHING_SPOT_KIND_LABELS[spot.kind] }}
                </p>
              </div>
            </div>
          </button>
        </Motion>
      </ul>

      <!-- Empty state: fades in when chips filter to zero spots -->
      <Motion
        v-else
        key="empty-state"
        :initial="{ opacity: 0 }"
        :animate="{ opacity: 1 }"
        :transition="{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }"
        class="text-muted px-6 py-12 text-center text-sm"
      >
        <p class="font-family-averia italic">
          {{ props.spots.length === 0 ? '尚无钓点收录' : '当前筛选下无钓点' }}
        </p>
      </Motion>
    </AnimatePresence>
  </aside>
</template>

<style scoped>
/*
 * Filter chip: 编辑图鉴式小标签 —— 圆角,选中态 ink 色边框 + ink 字。
 * 走 hairline 1px border,无重型按钮感。
 */
.filter-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.625rem;
  font-size: 11px;
  line-height: 1.1;
  border: 1px solid transparent;
  border-radius: 999px;
  transition:
    color 200ms cubic-bezier(0.22, 1, 0.36, 1),
    background-color 200ms cubic-bezier(0.22, 1, 0.36, 1),
    border-color 200ms cubic-bezier(0.22, 1, 0.36, 1);
  letter-spacing: 0.02em;
}

/*
 * 列表行: 顶部分隔 1px hairline —— 选中态/hover 时用绝对定位 2px ink hairline 代替。
 * 不用 divide-y(避免 hover 状态时仍可见)。
 */
.spot-row {
  position: relative;
  border-top: 1px solid color-mix(in oklch, var(--ink) 6%, transparent);
}
.spot-row:first-child {
  border-top: none;
}
.spot-row[aria-selected='true'] {
  border-top-color: transparent;
}
.spot-row[aria-selected='true']::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 2px;
  background: var(--ink);
}

@media (prefers-reduced-motion: reduce) {
  .filter-chip,
  .spot-row {
    transition: none;
  }
}
</style>
