<script setup lang="ts">
import { useFishingMapStore } from '@/features/fishing/stores/fishingMap';
import { formatDate } from '@/lib/dayjs';
import DashboardCard from './DashboardCard.vue';
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { motion } from 'motion-v';
import { EASE } from '@/constants';

defineProps<{
  location?: [number, number];
}>();

const fishingMapStore = useFishingMapStore();
const { liveWeather, forecasts, locationName, weatherLoading, weatherError } =
  storeToRefs(fishingMapStore);

const isLoading = computed(() => weatherLoading.value);
const error = computed(() => weatherError.value || null);

const openQWeather = () => {
  window.open('https://www.qweather.com/', '_blank');
};

/**
 * 4 天天气 icon 配色 —— 走 semantic token,跟随文字描述的"情绪"
 * 多云/阴 -> foreground(中性);雨 -> primary(冷调);雷 -> warning(暖调)
 * 保留 fallback 处理未知 icon,避免渲染空方块
 */
const forecastIconClass = (textDay: string): string => {
  if (textDay.includes('雷')) return 'text-warning';
  if (textDay.includes('雨')) return 'text-ink';
  return 'text-ink';
};
</script>

<template>
  <DashboardCard tone="hero" interactive @click="openQWeather">
    <!-- 氛围背景 —— 极轻冷调渐变 + noise overlay (装饰层,pointer-events-none) -->
    <div class="theater-atmosphere" aria-hidden="true" />
    <div class="theater-noise" aria-hidden="true" />

    <!-- Header -->
    <div class="relative z-10 mb-5 flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 class="text-ink font-serif text-lg font-semibold">
          {{ locationName || '钓鱼地点' }}
        </h3>
        <p class="text-muted mt-0.5 truncate text-sm">和风天气</p>
      </div>
      <div
        class="bg-accent/90 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm transition-all duration-300 group-hover:rounded-xl"
      >
        <i
          v-if="liveWeather"
          :class="`qi-${liveWeather.icon}`"
          class="text-xl"
        />
        <svg
          v-else
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
          />
        </svg>
      </div>
    </div>

    <!-- Loading (仅初次无数据时示,避免刷新时卸载数据分支重发动画) -->
    <div
      v-if="isLoading && !liveWeather"
      class="relative z-10 flex flex-1 flex-col items-center justify-center py-8"
    >
      <div
        class="border-t-accent h-10 w-10 animate-spin rounded-full border-2"
      />
      <span class="text-muted mt-3 text-sm">获取天气数据...</span>
    </div>

    <!-- Error (仅初次无数据时示,有数据时静默失败保留旧值) -->
    <div
      v-else-if="error && !liveWeather"
      class="bg-destructive/10 relative z-10 rounded-xl p-4"
    >
      <p class="text-destructive flex items-center gap-2 text-sm">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        {{ error }}
      </p>
    </div>

    <!-- Weather data -->
    <div v-else-if="liveWeather" class="relative z-10 flex flex-1 flex-col">
      <!-- 主区:温度 + 文字描述 -->
      <div class="mb-5 text-center">
        <div class="flex items-baseline justify-center gap-1">
          <motion.span
            :initial="{ opacity: 0, y: 8 }"
            :animate="{ opacity: 1, y: 0 }"
            :transition="{ ...EASE, delay: 0 }"
            class="text-ink text-7xl leading-none font-bold tracking-tight tabular-nums"
          >
            {{ liveWeather.temp }}
          </motion.span>
          <motion.span
            :initial="{ opacity: 0, y: 8 }"
            :animate="{ opacity: 1, y: 0 }"
            :transition="{ ...EASE, delay: 0.06 }"
            class="text-ink/60 text-2xl font-light"
          >
            °C
          </motion.span>
        </div>
        <motion.p
          :initial="{ opacity: 0, y: 8 }"
          :animate="{ opacity: 1, y: 0 }"
          :transition="{ ...EASE, delay: 0.12 }"
          class="text-ink mt-3 text-lg font-medium"
        >
          {{ liveWeather.text }}
        </motion.p>
      </div>

      <!-- 三联指标 —— 水平 metric row,极细竖线分隔 -->
      <motion.div
        :initial="{ opacity: 0, y: 8 }"
        :animate="{ opacity: 1, y: 0 }"
        :transition="{ ...EASE, delay: 0.18 }"
        class="mx-1 flex items-stretch justify-around py-3"
      >
        <div class="flex flex-1 flex-col items-center">
          <span class="text-muted text-[10px] tracking-[0.18em] uppercase"
            >风向</span
          >
          <span class="text-ink mt-1 text-sm font-semibold tabular-nums">
            {{ liveWeather.windDir }}
          </span>
        </div>
        <div class="metric-sep my-1" />
        <div class="flex flex-1 flex-col items-center">
          <span class="text-muted text-[10px] tracking-[0.18em] uppercase"
            >风力</span
          >
          <span class="text-ink mt-1 text-sm font-semibold tabular-nums">
            {{ liveWeather.windScale }}级
          </span>
        </div>
        <div class="metric-sep my-1" />
        <div class="flex flex-1 flex-col items-center">
          <span class="text-muted text-[10px] tracking-[0.18em] uppercase"
            >湿度</span
          >
          <span class="text-ink mt-1 text-sm font-semibold tabular-nums">
            {{ liveWeather.humidity }}%
          </span>
        </div>
      </motion.div>

      <!-- 顶/底分隔线 -->
      <div class="metric-divider" />

      <div v-if="forecasts.length > 0" class="flex-1">
        <p class="text-muted mb-2 text-[10px] tracking-[0.18em] uppercase">
          未来 3 天
        </p>
        <div class="grid grid-cols-3 gap-1">
          <motion.div
            v-for="(day, i) in forecasts.slice(0, 3)"
            :key="day.fxDate"
            :initial="{ opacity: 0, y: 8 }"
            :animate="{ opacity: 1, y: 0 }"
            :transition="{ ...EASE, delay: 0.18 + i * 0.06 }"
            class="flex flex-col items-center py-2"
          >
            <span class="text-muted text-[10px] tracking-[0.12em] uppercase">
              {{ day.fxDate.slice(5) }}
            </span>
            <i
              :class="[`qi-${day.iconDay}`, forecastIconClass(day.textDay)]"
              class="my-1.5 text-2xl leading-none"
            />
            <span class="text-ink text-xs font-semibold tabular-nums">
              {{ day.tempMax }}°
            </span>
            <span class="text-muted text-[10px] tabular-nums">
              {{ day.tempMin }}°
            </span>
          </motion.div>
        </div>
      </div>

      <p
        class="text-muted mt-4 text-center text-[10px] tracking-[0.18em] uppercase"
      >
        更新于 {{ formatDate(liveWeather.obsTime) }}
      </p>
    </div>

    <!-- 空态 -->
    <div
      v-else
      class="relative z-10 flex flex-1 flex-col items-center justify-center py-8 text-center"
    >
      <div
        class="bg-surface mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="text-muted h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
          />
        </svg>
      </div>
      <p class="text-ink text-sm">查看实时天气情况</p>
      <p class="text-muted mt-1 text-xs">选择最佳钓鱼时间</p>
    </div>
  </DashboardCard>
</template>

<style scoped>
/*
 * 天空剧场版 · 装饰层
 * - theater-atmosphere / theater-noise: 氛围背景(极轻冷调渐变 + SVG noise overlay)
 * - icon-tile: icon 大方块走 primary -> warning 渐变
 * - metric-sep / metric-divider: 水平 metric row 的极细竖/横分隔线
 * 所有颜色走 semantic token + oklch(from) + opacity,无硬编码
 */
.theater-atmosphere {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    160deg,
    oklch(from var(--color-accent) l c h / 0.14) 0%,
    oklch(from var(--color-accent) l c h / 0.05) 60%,
    transparent 100%
  );
  z-index: 0;
  pointer-events: none;
}
.theater-noise {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  opacity: 0.4;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.06 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
}

.metric-sep {
  width: 1px;
  background: oklch(from var(--border) l c h / 0.3);
}
.metric-divider {
  height: 1px;
  margin: 0 0.25rem 1rem;
  background: oklch(from var(--border) l c h / 0.5);
}

@media (prefers-reduced-motion: reduce) {
  /* motion-v 自身已响应 reduced-motion;此 hook 留给后续 */
}
</style>
