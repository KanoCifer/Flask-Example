<template>
  <div class="bg-page flex min-h-[calc(100dvh-4rem)] flex-col">
    <PageHero
      title="阅读统计"
      subtitle="微信读书 · 你的阅读时间记录"
      size="sm"
      back-fallback="/bookshelf"
    />

    <div class="flex-1 pb-12">
      <div class="mx-auto max-w-3xl px-4 py-8 sm:px-6 md:px-10 md:py-10">
        <!-- ── Mode Tabs ─────────────────────────────────────────────── -->
        <div class="bg-secondary mb-4 flex gap-1 rounded-xl p-1">
          <button
            v-for="m in MODES"
            :key="m.key"
            type="button"
            class="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
            :class="
              activeMode === m.key
                ? 'bg-accent text-ink shadow-sm'
                : 'text-muted hover:bg-surface hover:text-ink'
            "
            @click="switchMode(m.key)"
          >
            {{ m.label }}
          </button>
        </div>

        <!-- ── Period Navigation (hidden in overall) ───────────────── -->
        <div
          v-if="activeMode !== 'overall'"
          class="mb-10 flex items-center justify-between"
        >
          <button
            type="button"
            class="text-muted hover:text-ink hover:bg-surface inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            :disabled="statsStore.isLoading"
            @click="goPrev"
            aria-label="上一周期"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="2"
              stroke="currentColor"
              class="h-4 w-4"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M15.75 19.5 8.25 12l7.5-7.5"
              />
            </svg>
            上{{ unitLabel }}
          </button>
          <span class="text-ink text-sm font-medium tabular-nums sm:text-base">
            {{ periodLabel }}
          </span>
          <button
            type="button"
            class="text-muted hover:text-ink hover:bg-surface inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            :disabled="statsStore.isLoading || isAtCurrent"
            @click="goNext"
            aria-label="下一周期"
          >
            下{{ unitLabel }}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="2"
              stroke="currentColor"
              class="h-4 w-4"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="m8.25 4.5 7.5 7.5-7.5 7.5"
              />
            </svg>
          </button>
        </div>

        <!-- Loading skeleton -->
        <div v-if="statsStore.isLoading && !activeSnapshot" class="space-y-12">
          <div class="space-y-3">
            <div class="bg-surface h-4 w-24 animate-pulse rounded" />
            <div class="bg-surface h-16 w-3/4 animate-pulse rounded" />
            <div class="bg-surface h-4 w-1/2 animate-pulse rounded" />
          </div>
          <div class="bg-surface h-72 animate-pulse rounded" />
        </div>

        <!-- Error -->
        <div
          v-else-if="statsStore.error && !activeSnapshot"
          class="flex flex-col items-center justify-center py-20"
        >
          <p class="text-destructive mb-4 text-center text-sm">
            {{ statsStore.error }}
          </p>
          <button
            type="button"
            class="bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-xl px-5 py-2 text-sm font-medium transition-colors"
            @click="reloadCurrent"
          >
            重试
          </button>
        </div>

        <!-- ── Empty (period has no data) ─────────────────────────── -->
        <div
          v-else-if="activeSnapshot && !hasAnyData"
          class="text-muted py-20 text-center font-serif text-lg"
        >
          这{{ unitLabel }}还没有阅读记录。
        </div>

        <template v-else-if="activeSnapshot">
          <!-- ── 段落一：你读了多少 ─────────────────────────────── -->
          <section class="mb-14">
            <p class="text-muted mb-3 text-sm">
              {{ eyebrow }}
            </p>
            <p
              class="text-ink font-serif text-5xl leading-tight font-bold tracking-tight tabular-nums sm:text-6xl md:text-7xl"
            >
              {{ formatDuration(activeSnapshot.totalReadTime) }}
            </p>
            <p class="text-muted mt-4 text-base sm:text-lg">
              {{ subtitle }}
            </p>
          </section>

          <!-- ── 段落二：让你停不下来的是 ─────────────────────────── -->
          <StatsTopBooksSection
            v-if="activeSnapshot"
            :snapshot="activeSnapshot"
            :mode="activeMode"
          />

          <!-- ── 段落三：你的阅读节奏 ─────────────────────────────── -->
          <StatsRhythmSection
            v-if="activeSnapshot && hasRhythmData"
            :snapshot="activeSnapshot"
            :mode="activeMode"
          />

          <!-- ── 段落三·年：本年的阅读足迹(仅年视图) ─────────────── -->
          <StatsYearHeatmapSection
            v-if="activeMode === 'annually' && hasYearHeatmapData"
            :heatmap="currentHeatmap"
            :year="currentYear"
            :mode="activeMode"
          />

          <!-- ── 段落四：你偏好的 ─────────────────────────────────── -->
          <StatsPreferencesSection
            v-if="activeSnapshot && hasPreferenceData"
            :snapshot="activeSnapshot"
          />

          <!-- ── 段落 4.5：接下来读什么（推荐） ───────────────────── -->
          <StatsRecommendSection
            :books="recommends"
            :loading="isLoadingRecommends"
            :has-more="hasMoreRecommends"
            :error="recommendError"
            @refresh="reloadRecommends"
            @load-more="loadMoreRecommends"
          />

          <!-- ── 段落五（仅累计模式）：阅读概览 ─────────────────── -->
          <section
            v-if="
              activeMode === 'overall' &&
              activeSnapshot.readStat &&
              activeSnapshot.readStat.length
            "
            class="mb-4 grid grid-cols-2 gap-x-6 gap-y-6 border-t pt-10 sm:grid-cols-4"
          >
            <div
              v-for="stat in activeSnapshot.readStat"
              :key="stat.stat"
              class="text-left"
            >
              <p
                class="text-ink font-serif text-3xl font-bold tabular-nums sm:text-4xl"
              >
                {{ stat.counts }}
              </p>
              <p class="text-muted mt-1 text-xs sm:text-sm">
                {{ stat.stat }}
              </p>
            </div>
          </section>

          <!-- Footer meta -->
          <StatsRefreshFooter
            :last-refreshed-at="lastRefreshedAt"
            :loading="statsStore.isLoading"
            @refresh="reloadCurrent"
          />
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ReadStatsMode } from '@/features/books/api';
import { useReadStatsStore } from '@/features/books/stores/readStats';
import { useHeatmap } from '@/features/books/composables/useHeatmap';
import { useRecommends } from '@/features/books/composables/useRecommends';
import { formatDuration } from '@/lib/dayjs';
import { PageHero } from '@/components';
import dayjs from 'dayjs';
import { computed, onMounted, ref, watch } from 'vue';
import StatsPreferencesSection from './components/StatsPreferencesSection.vue';
import StatsRecommendSection from './components/StatsRecommendSection.vue';
import StatsRefreshFooter from './components/StatsRefreshFooter.vue';
import StatsRhythmSection from './components/StatsRhythmSection.vue';
import StatsTopBooksSection from './components/StatsTopBooksSection.vue';
import StatsYearHeatmapSection from './components/StatsYearHeatmapSection.vue';
import { useLongestView } from './composables/useLongestView';
import { useOverviewView } from './composables/useOverviewView';
import { usePreferenceView } from './composables/usePreferenceView';
import { useRhythmView } from './composables/useRhythmView';
import { useYearHeatmapView } from './composables/useYearHeatmapView';
import { usePeriodNavigation } from './composables/usePeriodNavigation';

const MODES = [
  { key: 'weekly', label: '本周' },
  { key: 'monthly', label: '本月' },
  { key: 'annually', label: '本年' },
  { key: 'overall', label: '累计' },
] as const satisfies ReadonlyArray<{ key: ReadStatsMode; label: string }>;

const statsStore = useReadStatsStore();
const { yearlyHeatmap, fetchYearlyHeatmap } = useHeatmap();
const {
  recommends,
  isLoadingRecommends,
  hasMoreRecommends,
  recommendError,
  fetchRecommends,
} = useRecommends();

// 解构出顶层 ref / 函数，模板里直接用(自动 unwrap)
const {
  activeMode,
  activeSnapshot,
  isAtCurrent,
  unitLabel,
  periodLabel,
  goPrev,
  goNext,
  switchMode,
  reloadCurrent,
} = usePeriodNavigation(statsStore);

// 段落级 narrow composables,只暴露模板真正关心的几个键
const { eyebrow, subtitle } = useOverviewView(activeSnapshot, activeMode);
const { hasData: hasLongestData } = useLongestView(activeSnapshot);
const { hasData: hasRhythmData } = useRhythmView(
  activeSnapshot,
  activeMode,
  // theme 在 section 内部独立取,这里仅作整页哨兵
  {
    primaryColor: computed(() => ''),
    subtextColor: computed(() => ''),
    axisColor: computed(() => ''),
    splitLineColor: computed(() => ''),
    mutedFillColor: computed(() => ''),
  },
);
const { hasData: hasPreferenceData } = usePreferenceView(activeSnapshot);

// ── 年视图热力图 ──────────────────────────────────────────────
const currentYear = computed(() => new Date().getFullYear());
const currentHeatmap = computed(
  () => yearlyHeatmap.value[currentYear.value] ?? null,
);
// heatmap 改为纯 CSS grid,composable 不再依赖 ECharts theme
const { hasData: hasYearHeatmapData } = useYearHeatmapView(
  currentHeatmap,
  currentYear,
  activeMode,
);

// 整页级"是否完全空"——任一段有数据就不空,匹配旧 hasAnyData 语义
const hasAnyData = computed(
  () =>
    (activeSnapshot.value?.totalReadTime ?? 0) > 0 ||
    hasLongestData.value ||
    hasRhythmData.value ||
    hasPreferenceData.value ||
    hasYearHeatmapData.value,
);

// ── Refresh tracking ──────────────────────────────────────────
const lastRefreshedAt = ref<dayjs.Dayjs | null>(null);

watch(
  () => activeSnapshot.value?.fetched_at,
  (val) => {
    if (val) lastRefreshedAt.value = dayjs(val);
  },
  { immediate: true },
);

// 进入/切到 annually 时按需拉取热力图;store 内部按 year 缓存 + loading 互斥
watch(
  () => activeMode.value,
  (m) => {
    if (m === 'annually') {
      fetchYearlyHeatmap(currentYear.value);
    }
  },
  { immediate: true },
);

onMounted(() => {
  // 初次加载：当前周期
  if (!activeSnapshot.value) {
    statsStore.fetchPeriod(activeMode.value, null);
  }
  // 推荐独立拉取（不绑定 mode）
  if (recommends.value.length === 0) {
    fetchRecommends(true);
  }
});

function reloadRecommends() {
  fetchRecommends(true);
}

function loadMoreRecommends() {
  fetchRecommends(false);
}
</script>
