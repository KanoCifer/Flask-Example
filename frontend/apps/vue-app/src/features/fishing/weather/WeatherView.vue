<script setup lang="ts">
/**
 * WeatherView —— 天气与渔情页（/fishing-map/weather）。
 *
 * FishingLayout 的子路由页，与「地图」子页平级，由顶栏导航切换。
 * 页内 4 个 cards:
 * - IndexHeroCard: 钓鱼指数 hero (主导)
 * - WeatherCard:   实时天气详情 (按 location 拉取)
 * - HourlyChartCard: 24h 时序 (降水 + 温度)
 * - TideCard:      潮汐面板 (手动 harbor / date)
 *
 * 设计:
 * - 顶栏与浮层由 FishingLayout 常驻提供，本页只渲染主体（顶部留出 fixed 顶栏高度）
 * - FishingAmbient 氛围层仅本页需要（地图页满屏地图不叠氛围）
 * - location 默认 DEFAULT_MAP_CENTER,也可由 query ?lng=...&lat=... 覆盖,
 *   从主页 conditions panel 跳转时透传
 * - 数据来源仍用 useFishingMapStore.fetchWeatherAndFishing —— 与 React 端保持一致
 */
import IndexHeroCard from '@/features/fishing/components/IndexHeroCard.vue';
import WeatherCard from '@/features/fishing/components/WeatherCard.vue';
import HourlyChartCard from '@/features/fishing/components/HourlyChartCard.vue';
import TideCard from '@/features/fishing/components/TideCard.vue';
import FishingAmbient from '@/features/fishing/components/FishingAmbient.vue';
import {
  DEFAULT_MAP_CENTER,
  useFishingMapStore,
} from '@/features/fishing/stores/fishingMap';
import { useHead } from '@vueuse/head';
import { useRoute } from 'vue-router';
import { computed, onMounted } from 'vue';

defineOptions({ name: 'WeatherView' });

const route = useRoute();
const fishingMapStore = useFishingMapStore();

useHead({
  title: "天气与渔情 - Kuroome's Blog",
  meta: [
    {
      name: 'description',
      content: '实时天气、24h 时序预报、潮汐与钓鱼指数全景视图',
    },
  ],
});

/**
 * 解析 ?lng=...&lat=... 透传的 location —— 任一缺失或非法则退回默认中心。
 * 给后续 conditions panel 跳转(由 task-284 处理)留下接管位。
 */
const location = computed<[number, number]>(() => {
  const lngRaw = route.query.lng;
  const latRaw = route.query.lat;
  const lng = typeof lngRaw === 'string' ? Number(lngRaw) : NaN;
  const lat = typeof latRaw === 'string' ? Number(latRaw) : NaN;
  if (Number.isFinite(lng) && Number.isFinite(lat)) {
    return [lng, lat];
  }
  return DEFAULT_MAP_CENTER;
});

function refresh(): Promise<void> {
  return fishingMapStore.fetchWeatherAndFishing(location.value);
}

onMounted(() => {
  void fishingMapStore.fetchWeatherAndFishing(location.value);
});
</script>

<template>
  <div class="bg-page relative min-h-screen">
    <FishingAmbient />

    <main
      class="relative z-10 mx-auto flex max-w-screen-2xl flex-col gap-6 px-4 pt-20 pb-5 sm:px-6 sm:pt-24 sm:pb-8"
    >
      <!-- 标题（返回入口已由常驻顶栏承担） -->
      <header class="flex items-center justify-center">
        <h1
          class="text-ink font-serif text-2xl leading-tight font-semibold sm:text-3xl"
        >
          天气与渔情
        </h1>
      </header>

      <div
        class="fishing-weather-grid grid grid-cols-1 gap-4 md:grid-cols-6 lg:grid-cols-12"
      >
        <!-- Hero:钓鱼指数 (移动端优先排在最上) -->
        <div class="order-1 md:col-span-6 lg:col-span-4">
          <IndexHeroCard @refresh="refresh" @feedback-click="() => {}" />
        </div>

        <!-- 中排:Weather (实时 + 3 日预报) -->
        <div class="order-2 md:col-span-6 lg:col-span-8">
          <WeatherCard :location="location" />
        </div>

        <!-- 底排:Hourly (时序) / Tide (潮汐) -->
        <div class="order-3 md:col-span-6 lg:col-span-7">
          <HourlyChartCard />
        </div>
        <div class="order-4 md:col-span-6 lg:col-span-5">
          <TideCard />
        </div>
      </div>

      <footer class="fishing-tagline pt-6 text-center">
        <span class="fishing-tagline-rule" aria-hidden="true" />
        <p class="text-muted font-family-averia tracking-wide italic">
          在出钓与阅读之间，留一片安静
        </p>
      </footer>
    </main>
  </div>
</template>

<style scoped>
/* 分区入场 stagger —— 与主页 dashboard 保持一致的节奏 */
@keyframes fishing-weather-rise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@media (prefers-reduced-motion: no-preference) {
  .fishing-weather-grid > * {
    animation: fishing-weather-rise 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .fishing-weather-grid > *:nth-child(1) {
    animation-delay: 0ms;
  }
  .fishing-weather-grid > *:nth-child(2) {
    animation-delay: 70ms;
  }
  .fishing-weather-grid > *:nth-child(3) {
    animation-delay: 140ms;
  }
  .fishing-weather-grid > *:nth-child(4) {
    animation-delay: 210ms;
  }
}

.fishing-tagline-rule {
  display: block;
  height: 1px;
  width: 64px;
  margin: 0 auto 16px;
  background: linear-gradient(
    90deg,
    transparent,
    oklch(from var(--muted) l c h / 0.5),
    transparent
  );
}

@media (prefers-reduced-motion: reduce) {
  .fishing-weather-grid > * {
    animation: none;
  }
}
</style>
