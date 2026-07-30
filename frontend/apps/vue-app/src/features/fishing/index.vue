<script setup lang="ts">
defineOptions({ name: 'FishingMapView' });
import AnalysisPanel from '@/features/fishing/components/AnalysisPanel.vue';
import FeedbackFormDialog from '@/features/fishing/components/FeedbackFormDialog.vue';
import FishingConditionsPanel from '@/features/fishing/components/FishingConditionsPanel.vue';
import FishingSidebar from '@/features/fishing/components/FishingSidebar.vue';
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
  <div class="h-screen overflow-hidden">
    <FishingTopBar
      class="fixed inset-x-0 top-0"
      :analysis-open="dash.analysisOpen.value"
      :analysis-has-data="dash.analysisHasData.value"
      @toggle-analysis="dash.toggleAnalysis"
      @add-spot="dash.onAddSpot"
    />
    <main
      class="grid h-full min-h-0 grid-cols-[0_1fr] overflow-hidden transition-[grid-template-columns] duration-200 md:grid-cols-[auto_1fr]"
    >
      <FishingSidebar
        class="border-border w-[320px] md:flex md:flex-col"
        :spots="dash.fishingSpots.value"
        :selected-id="dash.selectedId.value"
        :is-locating="dash.isLocating.value"
        @select="dash.onSpotSelect"
        @locate="dash.onLocate"
        @add-spot="dash.onAddSpot"
        @change-filter="dash.onFilterChange"
      />

      <div class="relative size-full min-h-0 overflow-hidden">
        <MapContainer
          ref="mapTileRef"
          :markers="dash.fishingSpots.value"
          :visible-kinds="dash.activeFilter.value"
          :hovered-marker="null"
          @marker-click="dash.onMarkerClick"
          @map-ready="dash.onMapReady"
          @error="dash.onMapError"
          @add-spot="dash.onAddSpot"
        />

        <FishingConditionsPanel
          :location="dash.activeLocation.value"
          @navigate="() => {}"
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
