<script setup lang="ts">
defineOptions({ name: 'FishingMapView' });
import AnalysisPanel from '@/features/fishing/components/AnalysisPanel.vue';
import FeedbackFormDialog from '@/features/fishing/components/FeedbackFormDialog.vue';
import FishingTopBar from '@/features/fishing/components/FishingTopBar.vue';
import MapContainer from '@/features/fishing/components/MapContainer.vue';
import SpotDetailPanel from '@/features/fishing/components/SpotDetailPanel.vue';
import { useFishingDashboard } from '@/features/fishing/composables/useFishingDashboard';
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
    <FishingTopBar
      class="fixed inset-x-0 top-0"
      :analysis-open="dash.analysisOpen.value"
      :analysis-has-data="dash.analysisHasData.value"
      @toggle-analysis="dash.toggleAnalysis"
      @add-spot="dash.openSpotForm"
    />

    <main class="relative z-10">
      <!-- <QuickFeedbackBanner
        :disabled="!dash.indexData.value"
        @submit="dash.onQuickFeedback"
      /> -->

      <div
        class="fishing-map-wrapper absolute inset-0 h-screen w-screen overflow-hidden"
      >
        <MapContainer
          ref="mapTileRef"
          :markers="dash.fishingSpots.value"
          @marker-click="dash.onMarkerClick"
          @map-ready="dash.onMapReady"
          @error="dash.onMapError"
          @add-spot="dash.openSpotForm"
        />
      </div>
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
