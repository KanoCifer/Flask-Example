import {
  DEFAULT_MAP_CENTER,
  useFishingMapStore,
} from '@/features/fishing/stores/fishingMap';
import { useNotificationStore } from '@/stores';
import { fishingSpotsGateway } from '@readinglist/api';
import type {
  FishingIndexData,
  FishingSpotKind,
  MapMarker,
} from '@readinglist/types';
import { toMapMarker, toMapMarkers } from '@/features/fishing/types';
import type {
  FishingMapInstance,
  MarkerClickPayload,
} from '@/features/fishing/composables/fishingMapRuntime';
import { useFishingAnalysis } from '@/features/fishing/composables/useFishingAnalysis';
import { useFishingFeedback } from '@/features/fishing/composables/useFishingFeedback';
import { usePanelMutex } from '@/features/fishing/composables/usePanelMutex';
import { storeToRefs } from 'pinia';
import type { ComponentPublicInstance, InjectionKey } from 'vue';
import { computed, inject, provide, ref } from 'vue';

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
  /**
   * 地图实例引用。
   *
   * 不能用 useTemplateRef —— 它只绑定「调用它的那个组件实例」的模板 ref，
   * 而本 composable 现在由 FishingLayout 创建、MapContainer 落在子路由页 MapView 里，
   * 层级对不上会永远收不到实例（定位 / 飞行 / 过滤全部静默失效）。
   * 改用普通 ref + 函数 ref 回填，由持有 MapContainer 的组件显式绑定 `:ref="setMapTile"`。
   */
  const mapTileRef = ref<FishingMapInstance | null>(null);
  function setMapTile(el: Element | ComponentPublicInstance | null): void {
    mapTileRef.value = (el as FishingMapInstance | null) ?? null;
  }

  const fishingMapStore = useFishingMapStore();
  const notifier = useNotificationStore();
  const { indexData } = storeToRefs(fishingMapStore);

  // —— 三面板互斥 seam(任务 289):详情 / 表单 / AI 分析同一时刻只开一个 —— //
  const mutex = usePanelMutex();
  const panelOpen = mutex.isOpen('detail');
  const formOpen = mutex.isOpen('form');

  const userPosition = ref<[number, number] | null>(null);
  const activeLocation = computed<[number, number]>(
    () => userPosition.value ?? DEFAULT_MAP_CENTER,
  );

  // —— 钓点详情 Panel ——
  /**
   * 当前 Panel 展示的完整 MapMarker。
   * position 供迷你地图;extraData 供详情展示。
   * 来源: MarkerClickPayload.spot(地图点击时即含 position)。
   */
  const activePanelMarker = ref<MapMarker | null>(null);
  function openSpotPanel(marker: MapMarker): void {
    mutex.openExclusive('detail');
    activePanelMarker.value = marker;
  }
  function closeSpotPanel(): void {
    mutex.close('detail');
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
  function openSpotForm(): void {
    mutex.openExclusive('form');
  }
  function closeSpotForm(): void {
    mutex.close('form');
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

  const feedback = useFishingFeedback();
  const analysis = useFishingAnalysis();

  /**
   * showFeedbackBanner —— 路线规划入口已下线(task-279),无 isPlanning /
   * routeInfo 任何来源,保持硬编码 true 等价「始终显示」,与 QuickFeedbackBanner
   * 既有行为对齐。
   * TODO:React 端 useRouteMapStore.isPlanningRoute 字段保留作为占位;若 Vue 端
   *      未来恢复路线规划,这里需要从 store 派生。
   */
  const showFeedbackBanner = computed(() => true);

  /**
   * AI 分析开关 —— 三面板互斥由 mutex.openExclusive 保证(开 AI 自动关其它)。
   * 路线规划入口已删除(任务 279):Panel 内联「打开高德 App」按钮。
   */
  function toggleAnalysis(): void {
    mutex.openExclusive('analysis');
    analysis.toggle();
  }

  /** Sidebar 列表选中 index —— dashboard 内部状态(原 useFishingRoute 占位) */
  const selectedSpotIndex = ref<number | null>(null);

  function onMarkerClick(payload: MarkerClickPayload): void {
    if (!payload.spot.extraData) return;
    selectedSpotIndex.value = payload.index;
    selectedIndex.value = payload.index;
    // 地图视角跟随被点击的钓点(覆盖已打开 Panel 的场景)
    mapTileRef.value?.setZoomAndCenter(15, payload.spot.position);
    openSpotPanel(payload.spot);
  }

  function onFeedbackClick(data: FishingIndexData): void {
    feedback.openFeedback(data, selectedSpotIndex.value);
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

  // —— Sidebar (任务 284) ——
  /**
   * Sidebar filter chip 状态:null = 全部,Set = 仅显示选中 kind。
   * 父组件 watch 后调用 map.setVisibleKinds;MapContainer 自己也接受
   * visibleKinds prop 双向同步。本 ref 作为单一真源。
   */
  const activeFilter = ref<Set<FishingSpotKind> | null>(null);
  /**
   * Sidebar 列表选中 index —— 指向原始数组,与 marker click 共用。
   */
  const selectedIndex = ref<number | null>(null);
  /**
   * Sidebar 列表选中 id —— 用 id 而非 index(原始数组索引)跟 sidebar 同步,
   * 因为 sidebar 已按 kind 过滤,index 范围与原始数组不再对齐。
   */
  const selectedId = computed<string | null>(
    () => fishingSpots.value[selectedIndex.value ?? -1]?.extraData?.id ?? null,
  );

  /** 定位 in-flight 标志,Sidebar Locate icon crossfade 用 */
  const isLocating = ref(false);

  /** Sidebar chip 切换 → 更新本地状态 + 通知地图过滤 marker */
  function onFilterChange(kinds: Set<FishingSpotKind>): void {
    activeFilter.value = kinds.size > 0 ? kinds : null;
    mapTileRef.value?.setVisibleKinds(activeFilter.value);
  }

  /** Sidebar 列表项点击 → flyTo zoom=9 + hover preview + 更新 selectedIndex */
  function onSpotSelect(spot: MapMarker): void {
    // sidebar 传 MapMarker 自身(已过滤);selectedIndex 仍指向原始数组以便
    // 后续 MapContainer markers prop 索引对应
    const idx = fishingSpots.value.findIndex(
      (m) => m.extraData?.id === spot.extraData?.id,
    );
    selectedIndex.value = idx >= 0 ? idx : null;
    mapTileRef.value?.setZoomAndCenter(15, spot.position);
    mapTileRef.value?.setHoverPreview(spot);
  }

  /** Sidebar header 定位按钮 → 复用 MapContainer.locate */
  async function onLocate(): Promise<[number, number] | null> {
    const map = mapTileRef.value;
    if (!map) return null;
    isLocating.value = true;
    try {
      const pos = await map.locate();
      if (pos) userPosition.value = pos;
      return pos;
    } finally {
      isLocating.value = false;
    }
  }

  /** Sidebar header 添加钓点入口 → 复用 openSpotForm */
  function onAddSpot(): void {
    openSpotForm();
  }

  /** MapTile 定位 / 路线等操作失败时 toast 提示 */
  function onMapError(message: string): void {
    notifier.error(message);
  }

  return {
    // refs / state
    mapTileRef,
    setMapTile,
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

    feedbackOpen: feedback.open,
    currentFishingData: feedback.currentFishingData,
    feedbackLocationId: feedback.locationId,
    feedbackLocationName: feedback.locationName,
    analysisOpen: analysis.open,
    analysisPayload: analysis.payload,
    analysisHasData: analysis.hasData,

    // sub-composables (仅 handlers 内部使用,不暴露给模板)
    feedback,
    analysis,

    // derived
    showFeedbackBanner,

    // handlers
    openSpotForm,
    toggleAnalysis,
    onMarkerClick,
    onFeedbackClick,
    onQuickFeedback,
    onMapReady,
    onMapError,
    init,
    refreshIndex,

    // sidebar (任务 284)
    activeFilter,
    selectedIndex,
    selectedId,
    isLocating,
    onFilterChange,
    onSpotSelect,
    onLocate,
    onAddSpot,
  };
}

export type FishingDashboard = ReturnType<typeof useFishingDashboard>;

const FISHING_DASHBOARD_KEY: InjectionKey<FishingDashboard> =
  Symbol('fishing-dashboard');

/**
 * 在 FishingLayout 里建一份 dashboard 并向子路由页下发。
 * 顶栏与浮层挂在 layout，主体（地图 / 天气）由 RouterView 切换，
 * 两边共享同一份状态，切页时不重挂载、不重复拉钓点。
 */
export function provideFishingDashboard(): FishingDashboard {
  const dash = useFishingDashboard();
  provide(FISHING_DASHBOARD_KEY, dash);
  return dash;
}

/** 子路由页取用 layout 下发的 dashboard —— 不在 FishingLayout 内使用即报错 */
export function useFishingDashboardContext(): FishingDashboard {
  const dash = inject(FISHING_DASHBOARD_KEY, null);
  if (!dash) {
    throw new Error(
      'useFishingDashboardContext 必须在 FishingLayout 的子组件中调用',
    );
  }
  return dash;
}
