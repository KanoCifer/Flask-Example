<script setup lang="ts">
/**
 * FishingLayout —— 钓点图鉴布局壳（/fishing-map 及其子页）。
 *
 * 顶栏与四个浮层（反馈 / AI 分析 / 钓点详情 / 新增钓点）常驻这一层，
 * 主体由 <RouterView /> 在「地图」「天气」等子页之间切换。
 * dashboard 状态在这里创建并下发，子页注入取用 —— 切页不重挂载、不重复拉钓点。
 */
defineOptions({ name: 'FishingLayout' });
import AnalysisPanel from '@/features/fishing/components/AnalysisPanel.vue';
import FeedbackFormDialog from '@/features/fishing/components/FeedbackFormDialog.vue';
import FishingTopBar from '@/features/fishing/components/FishingTopBar.vue';
import SpotDetailPanel from '@/features/fishing/components/SpotDetailPanel.vue';
import { provideFishingDashboard } from '@/features/fishing/composables/useFishingDashboard';
import { defineAsyncComponent } from 'vue';

const SpotFormPanel = defineAsyncComponent(
  () => import('@/features/fishing/components/SpotFormPanel.vue'),
);

const dash = provideFishingDashboard();
const { feedback, analysis } = dash;
</script>

<template>
  <div class="relative">
    <FishingTopBar
      class="fixed inset-x-0 top-0"
      :analysis-open="dash.analysisOpen.value"
      :analysis-has-data="dash.analysisHasData.value"
      @toggle-analysis="dash.toggleAnalysis"
      @add-spot="dash.onAddSpot"
    />

    <RouterView />

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
