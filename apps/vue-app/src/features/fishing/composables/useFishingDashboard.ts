import {
  DEFAULT_MAP_CENTER,
  useFishingMapStore,
} from '@/features/fishing/stores/fishingMap';
import { useNotificationStore } from '@/stores';
import { fishingSpotsGateway } from '@/features/fishing/api';
import type { FishingIndexData } from '@/features/fishing/types';
import type { MapMarker } from '@/features/fishing/types';
import { toMapMarker, toMapMarkers } from '@/features/fishing/types';
import type { MarkerClickPayload } from '@/features/fishing/composables/fishingMapRuntime';
import { useFishingAnalysis } from '@/features/fishing/composables/useFishingAnalysis';
import { useFishingFeedback } from '@/features/fishing/composables/useFishingFeedback';
import {
  type FishingMapInstance,
  useFishingRoute,
} from '@/features/fishing/composables/useFishingRoute';
import { storeToRefs } from 'pinia';
import { computed, ref, useTemplateRef } from 'vue';

export function useFishingDashboard() {
  const fishingSpots = ref<MapMarker[]>([]);
  const spotsLoading = ref(true);
  const spotsError = ref<Error | null>(null);

  // 启动即拉 API —— 失败静默降级（不弹窗，避免破坏首屏）
  void (async () => {
    try {
      const spots = await fishingSpotsGateway.list();
      fishingSpots.value = toMapMarkers(spots);
    } catch (err) {
      spotsError.value = err instanceof Error ? err : new Error(String(err));
    } finally {
      spotsLoading.value = false;
    }
  })();
  const mapTileRef = useTemplateRef<FishingMapInstance>('mapTileRef');

  const fishingMapStore = useFishingMapStore();
  const notifier = useNotificationStore();
  const { indexData } = storeToRefs(fishingMapStore);

  const userPosition = ref<[number, number] | null>(null);
  const activeLocation = computed<[number, number]>(
    () => userPosition.value ?? DEFAULT_MAP_CENTER,
  );

  // —— 钓点详情 Panel ——
  const panelOpen = ref(false);
  /**
   * 当前 Panel 展示的完整 MapMarker。
   * position 供迷你地图 / 路线规划;extraData 供详情展示。
   * 来源: MarkerClickPayload.spot(地图点击时即含 position)。
   */
  const activePanelMarker = ref<MapMarker | null>(null);
  function openSpotPanel(marker: MapMarker): void {
    // 三面板互斥:打开详情前关闭表单 + AI 分析
    closeSpotForm();
    analysis.close();
    activePanelMarker.value = marker;
    panelOpen.value = true;
  }
  function closeSpotPanel(): void {
    panelOpen.value = false;
    activePanelMarker.value = null;
  }
  /** 钓点被 Panel 内编辑后:同步 marker 引用(触发地图重渲染) */
  function onSpotUpdated(marker: MapMarker): void {
    activePanelMarker.value = marker;
    const idx = fishingSpots.value.findIndex(
      (m) => m.extraData?.id === marker.extraData?.id,
    );
    if (idx >= 0) fishingSpots.value[idx] = marker;
  }
  /** 钓点被 Panel 内删除后:从 markers 移除并重渲染地图 */
  function onSpotDeleted(id: string): void {
    fishingSpots.value = fishingSpots.value.filter(
      (m) => m.extraData?.id !== id,
    );
  }

  // ── 新增钓点 Panel ──
  const formOpen = ref(false);
  function openSpotForm(): void {
    // 三面板互斥:打开表单前关闭详情 + AI 分析
    closeSpotPanel();
    analysis.close();
    formOpen.value = true;
  }
  function closeSpotForm(): void {
    formOpen.value = false;
  }
  /**
   * 新增钓点后端 create 不返回实体,按名称匹配新钓点 → 同步列表 → 打开详情面板。
   */
  async function onSpotCreated(name: string): Promise<void> {
    const spots = await fishingSpotsGateway.list();
    fishingSpots.value = toMapMarkers(spots);
    const created = spots.find((s) => s.name === name);
    if (created) {
      openSpotPanel(toMapMarker(created));
      notifier.success(`钓点「${name}」已添加`);
    }
  }

  const route = useFishingRoute(() => mapTileRef.value);
  const feedback = useFishingFeedback();
  const analysis = useFishingAnalysis();

  const showFeedbackBanner = computed(
    () => !route.isPlanning.value && !route.routeInfo.value,
  );

  /**
   * marker 点击 → 滑入钓点详情 Panel。
   * 规划路线操作内嵌到 Panel 内(由 Panel 回调 marker 触发 planFromMarker),
   * 保留 index ↔ spot 双引用供路线规划使用。
   */
  /** AI 分析开关 —— 三面板互斥:打开前关闭表单 + 详情 */
  function toggleAnalysis(): void {
    closeSpotForm();
    closeSpotPanel();
    analysis.toggle();
  }

  function onMarkerClick(payload: MarkerClickPayload): void {
    if (!payload.spot.extraData) return;
    route.selectedSpotIndex.value = payload.index;
    // 地图视角跟随被点击的钓点(覆盖已打开 Panel 的场景)
    mapTileRef.value?.setZoomAndCenter(15, payload.spot.position);
    openSpotPanel(payload.spot);
  }

  function onClearRoute(): void {
    route.clearRoute();
  }

  function onFeedbackClick(data: FishingIndexData): void {
    feedback.openFeedback(data, route.selectedSpotIndex.value);
  }

  function onQuickFeedback(): void {
    if (!indexData.value) return;
    feedback.openFeedback(indexData.value, null);
  }

  /**
   * 地图就绪后:初始化自动定位(移图 + 打点) → 拉对应位置的天气 / 钓鱼指数。
   * 定位失败静默降级（不弹窗）—— onMounted 已经用默认中心兜底过一次。
   */
  function onMapReady(): void {
    void (async () => {
      const map = mapTileRef.value;
      if (!map) return;
      try {
        // locate() 移图 + 打点,返回坐标供复用(避免重复触发定位)
        const position = await map.locate();
        if (!position) return;
        userPosition.value = position;
        await fishingMapStore.fetchWeatherAndFishing(position);
      } catch {
        // 静默：定位失败不弹窗
      }
    })();
  }

  /** onMounted 调用：用默认中心拉一次，先把 dashboard 撑起来 */
  function init(): void {
    void fishingMapStore.fetchWeatherAndFishing(DEFAULT_MAP_CENTER);
  }

  /** Index hero card 的刷新按钮 → 用当前 activeLocation 重新拉 */
  function refreshIndex(): Promise<void> {
    return fishingMapStore.fetchWeatherAndFishing(activeLocation.value);
  }

  /** MapTile 定位 / 路线等操作失败时 toast 提示 */
  function onMapError(message: string): void {
    notifier.error(message);
  }

  return {
    // refs / state
    mapTileRef,
    fishingSpots,
    spotsLoading,
    spotsError,
    activeLocation,
    indexData,

    // 新增钓点 Panel
    formOpen,
    closeSpotForm,
    onSpotCreated,

    // 钓点详情 Panel
    panelOpen,
    activePanelMarker,
    closeSpotPanel,
    onSpotUpdated,
    onSpotDeleted,
    // Panel 路线按钮 → 直接从 emitted marker 取 position → planFromMarker。
    onRouteFromSpot: (marker: MapMarker) => {
      const idx = route.selectedSpotIndex.value;
      if (idx != null) void route.planFromMarker(idx, marker);
    },

    // 拍平的子 composable refs (模板里直接 dash.isPlanning 等,避免三层点链)
    isPlanning: route.isPlanning,
    routeInfo: route.routeInfo,
    feedbackOpen: feedback.open,
    currentFishingData: feedback.currentFishingData,
    feedbackLocationId: feedback.locationId,
    feedbackLocationName: feedback.locationName,
    analysisOpen: analysis.open,
    analysisPayload: analysis.payload,
    analysisHasData: analysis.hasData,

    // sub-composables (仅 handlers 内部使用,不暴露给模板)
    route,
    feedback,
    analysis,

    // derived
    showFeedbackBanner,

    // handlers
    openSpotForm,
    toggleAnalysis,
    onMarkerClick,
    onClearRoute,
    onFeedbackClick,
    onQuickFeedback,
    onMapReady,
    onMapError,
    init,
    refreshIndex,
  };
}
