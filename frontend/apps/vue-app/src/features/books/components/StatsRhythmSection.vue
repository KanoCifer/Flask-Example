<script setup lang="ts">
import type { ReadDetailSnapshot, ReadStatsMode } from '@/features/books/api';
import { formatDuration } from '@/lib/dayjs';
import { computed, toRef } from 'vue';
import VChart from 'vue-echarts';
import { useEChartsTheme } from '../composables/useEChartsTheme';
import { useRhythmView } from '../composables/useRhythmView';

const props = defineProps<{
  snapshot: ReadDetailSnapshot;
  mode: ReadStatsMode;
}>();

// 把非 ref 的 props 包成 ref，让 narrow composable 可以订阅
const snapshotRef = toRef(props, 'snapshot');
const modeRef = toRef(props, 'mode');
const theme = useEChartsTheme();

const {
  hasTrendData,
  hasPreferTimeData,
  hasReadListenData,
  hasData,
  trendSubtitle,
  preferTimeSubtitle,
  readListenSubtitle,
  readPercent,
  listenPercent,
  trendOption,
  preferTimeOption,
} = useRhythmView(snapshotRef, modeRef, theme);

const formatRead = (s: number | null | undefined) => formatDuration(s);
const formatListen = (s: number | null | undefined) => formatDuration(s);

const visible = computed(() => hasData.value);
</script>

<template>
  <section v-if="visible" class="mb-14 space-y-10">
    <h2
      class="text-ink font-serif text-2xl font-semibold tracking-tight sm:text-3xl"
    >
      你的阅读节奏
    </h2>

    <!-- 趋势 -->
    <div v-if="hasTrendData">
      <p class="text-muted mb-4 text-sm">
        {{ trendSubtitle }}
      </p>
      <div class="h-56 sm:h-64">
        <v-chart :option="trendOption" autoresize />
      </div>
    </div>

    <!-- 时段 -->
    <div v-if="hasPreferTimeData">
      <p class="text-muted mb-4 text-sm">
        {{ preferTimeSubtitle }}
      </p>
      <div class="h-44 sm:h-48">
        <v-chart :option="preferTimeOption" autoresize />
      </div>
    </div>

    <!-- 文字 vs 听书 -->
    <div v-if="hasReadListenData">
      <p class="text-muted mb-4 text-sm">
        {{ readListenSubtitle }}
      </p>
      <div class="bg-surface flex h-2 overflow-hidden rounded-full">
        <div
          class="bg-accent h-full transition-all duration-700"
          :style="{ width: `${readPercent}%` }"
        />
        <div
          class="bg-success h-full transition-all duration-700"
          :style="{ width: `${listenPercent}%` }"
        />
      </div>
      <div
        class="text-muted mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs sm:text-sm"
      >
        <span class="flex items-center gap-2">
          <span class="bg-accent inline-block h-2 w-2 rounded-full" />
          文字阅读
          <span class="text-ink tabular-nums">
            {{ formatRead(snapshot.wrReadTime) }} · {{ readPercent }}%
          </span>
        </span>
        <span class="flex items-center gap-2">
          <span class="bg-success inline-block h-2 w-2 rounded-full" />
          听书
          <span class="text-ink tabular-nums">
            {{ formatListen(snapshot.wrListenTime) }} · {{ listenPercent }}%
          </span>
        </span>
      </div>
    </div>
  </section>
</template>
