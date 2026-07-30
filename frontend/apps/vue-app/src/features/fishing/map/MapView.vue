<script setup lang="ts">
/**
 * MapView —— 钓点图鉴「地图」子页（/fishing-map）。
 *
 * 只负责主体三件套：侧栏 + 地图 + 右上条件卡。
 * 顶栏与四个浮层（详情 / 表单 / AI 分析 / 反馈）常驻在 FishingLayout，
 * 状态由 layout 下发的 dashboard 注入，切到 /fishing-map/weather 也不会丢。
 */
defineOptions({ name: 'FishingMapView' });
import FishingConditionsPanel from '@/features/fishing/components/FishingConditionsPanel.vue';
import FishingSidebar from '@/features/fishing/components/FishingSidebar.vue';
import MapContainer from '@/features/fishing/components/MapContainer.vue';
import { useFishingDashboardContext } from '@/features/fishing/composables/useFishingDashboard';
import { onMounted } from 'vue';

const dash = useFishingDashboardContext();

/**
 * 默认中心先把条件卡撑起来（随后 onMapReady 定位成功会再拉一次真实位置）。
 * 这一步留在地图页而不是 layout：weather 子页有自己的 ?lng/?lat 拉取，
 * 放 layout 会两个请求打同一个 store，谁后返回谁覆盖。
 */
onMounted(dash.init);
</script>

<template>
  <div class="h-screen overflow-hidden">
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
          :ref="dash.setMapTile"
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
  </div>
</template>
