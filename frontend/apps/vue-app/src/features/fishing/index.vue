<script setup lang="ts">
defineOptions({ name: 'FishingMapView' });
import TideCard from '@/features/fishing/components/TideCard.vue';
import WeatherCard from '@/features/fishing/components/WeatherCard.vue';
import AnalysisPanel from '@/features/fishing/components/AnalysisPanel.vue';
import DashboardHeader from '@/features/fishing/components/DashboardHeader.vue';
import FeedbackFormDialog from '@/features/fishing/components/FeedbackFormDialog.vue';
import FishingAmbient from '@/features/fishing/components/FishingAmbient.vue';
import HourlyChartCard from '@/features/fishing/components/HourlyChartCard.vue';
import IndexHeroCard from '@/features/fishing/components/IndexHeroCard.vue';
import MapContainer from '@/features/fishing/components/MapContainer.vue';
import SpotDetailPanel from '@/features/fishing/components/SpotDetailPanel.vue';
import QuickFeedbackBanner from '@/features/fishing/components/QuickFeedbackBanner.vue';
import { useFishingDashboard } from '@/features/fishing/composables/useFishingDashboard';
import { MapPin } from '@lucide/vue';
import { defineAsyncComponent, onMounted } from 'vue';

const SpotFormPanel = defineAsyncComponent(
  () => import('@/features/fishing/components/SpotFormPanel.vue'),
);

const dash = useFishingDashboard();
const { feedback, analysis } = dash;

onMounted(dash.init);
</script>

<template>
  <div class="bg-page relative min-h-screen">
    <FishingAmbient />

    <DashboardHeader
      class="relative z-10"
      :analysis-open="dash.analysisOpen.value"
      :analysis-has-data="dash.analysisHasData.value"
      @toggle-analysis="dash.toggleAnalysis"
      @add-spot="dash.openSpotForm"
    />

    <main
      class="relative z-10 mx-auto flex max-w-screen-2xl flex-col gap-6 px-4 py-5 sm:px-6 sm:py-8"
    >
      <QuickFeedbackBanner
        :disabled="!dash.indexData.value"
        @submit="dash.onQuickFeedback"
      />

      <div
        class="fishing-dashboard grid grid-cols-1 gap-4 md:grid-cols-6 md:grid-rows-[minmax(420px,580px)_auto] lg:grid-cols-12"
      >
        <div
          class="fishing-map-wrapper order-2 h-[300px] overflow-hidden rounded-2xl border shadow-sm md:order-1 md:col-span-6 md:h-full lg:col-span-8"
        >
          <MapContainer
            ref="mapTileRef"
            :markers="dash.fishingSpots.value"
            :is-planning="dash.isPlanning.value"
            :route-info="dash.routeInfo.value"
            @marker-click="dash.onMarkerClick"
            @map-ready="dash.onMapReady"
            @clear-route="dash.onClearRoute"
            @error="dash.onMapError"
            @add-spot="dash.openSpotForm"
          />
        </div>

        <!-- Fishing Index (hero,移动端优先排在 Map 之前) -->
        <div class="order-1 md:order-2 md:col-span-6 lg:col-span-4">
          <IndexHeroCard
            @refresh="dash.refreshIndex"
            @feedback-click="dash.onFeedbackClick"
          />
        </div>

        <!-- 底排:Weather (3) / Hourly (5) / Tide (4) = 12 -->
        <div class="order-3 md:col-span-3 lg:col-span-3">
          <WeatherCard :location="dash.activeLocation.value" />
        </div>
        <div class="order-4 md:col-span-3 lg:col-span-5">
          <HourlyChartCard />
        </div>
        <div class="order-5 md:col-span-6 lg:col-span-4">
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

    <FeedbackFormDialog
      v-if="dash.feedbackOpen.value && dash.currentFishingData.value"
      :is-open="dash.feedbackOpen.value"
      :fishing-data="dash.currentFishingData.value"
      :location-id="dash.feedbackLocationId.value"
      :location-name="dash.feedbackLocationName.value"
      @cancel="feedback.closeFeedback"
      @success="feedback.closeFeedback"
    />

    <AnalysisPanel
      :open="dash.analysisOpen.value"
      :payload="dash.analysisPayload.value"
      @close="analysis.close"
    />

    <SpotDetailPanel
      :open="dash.panelOpen.value"
      :marker="dash.activePanelMarker.value"
      @close="dash.closeSpotPanel"
      @route="dash.onRouteFromSpot"
      @spot-updated="dash.onSpotUpdated"
      @spot-deleted="dash.onSpotDeleted"
    />

    <SpotFormPanel
      :open="dash.formOpen.value"
      :initial-center="dash.activeLocation.value"
      @close="dash.closeSpotForm"
      @created="dash.onSpotCreated"
    />
  </div>
</template>

<style scoped>
/*
 * 地图容器阴影 —— 与右侧书房纸卡共享 color-mix 阴影语系。
 * 静止态仅薄边 + 极轻 ambient;hover 抬起两层向右 ambient。
 * 全部走 color-mix,遵守 No-Fixed-RGBA Rule。
 */
.fishing-map-wrapper {
  position: relative;
  transition:
    transform 240ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 240ms cubic-bezier(0.22, 1, 0.36, 1),
    border-color 240ms ease;
  box-shadow:
    0 -1px 1px color-mix(in oklch, var(--ink) 4%, transparent),
    0 -4px 8px color-mix(in oklch, var(--ink) 3%, transparent);
}
.fishing-map-wrapper:hover {
  transform: translateY(-2px);
  box-shadow:
    0 -8px 18px color-mix(in oklch, var(--ink) 8%, transparent),
    0 -24px 40px color-mix(in oklch, var(--ink) 5%, transparent);
}

/* —— 分区入场 stagger ——
 * 不再整体 grid 统一 rise;每个子区块按阅读序淡入上滑,
 * 给出从容的书斋节奏。prefers-reduced-motion → opacity 切换。
 */
@keyframes fishing-section-rise {
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
  .fishing-dashboard > * {
    animation: fishing-section-rise 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .fishing-dashboard > *:nth-child(1) {
    animation-delay: 0ms;
  }
  .fishing-dashboard > *:nth-child(2) {
    animation-delay: 70ms;
  }
  .fishing-dashboard > *:nth-child(3) {
    animation-delay: 140ms;
  }
  .fishing-dashboard > *:nth-child(4) {
    animation-delay: 210ms;
  }
  .fishing-dashboard > *:nth-child(5) {
    animation-delay: 280ms;
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
  .fishing-dashboard > * {
    animation: none;
  }
  .fishing-map-wrapper:hover {
    transform: none;
  }
}

@media (hover: none) {
  .fishing-map-wrapper:hover {
    transform: none;
  }
}
</style>
