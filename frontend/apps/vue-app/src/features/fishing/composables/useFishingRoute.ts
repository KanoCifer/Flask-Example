/**
 * useFishingRoute —— 历史占位文件。
 *
 * 历史:此 composable 持有驾车路线规划串行化守卫(useSequencedTask) +
 * planFromMarker / clearRoute 逻辑。task-279 设计路线规划从钓点页移除,
 * 改由详情面板内联「打开高德 App」按钮实现,因此整个路线流已下线。
 *
 * 当前:保留 useFishingRoute 仅为了不破坏潜在外层引用 —— 返回空对象,
 * 真正选中的 marker index 由 SpotDetailPanel 的 v-model 自行管理。
 *
 * 选中的 marker index 仍由 dashboard 透传(dash.selectedSpotIndex),
 * 但此 composable 不再持有任何状态。如确认无引用可彻底删除本文件。
 */
import type { FishingSpotKind, MapMarker } from '@readinglist/types';
import { ref } from 'vue';

/**
 * FishingMapInstance —— 暴露给父组件的 MapContainer 行为接口。
 * 路线规划已下线,只保留定位 / 视野控制 / kind 过滤 / hover preview。
 */
export interface FishingMapInstance {
  getCurrentPosition: () => Promise<[number, number]>;
  /** 地图视角移动到指定坐标并缩放 */
  setZoomAndCenter: (zoom: number, center: [number, number]) => void;
  /** 定位:移图 + 打点,返回坐标供调用方复用。初始化自动定位与按钮重试共用 */
  locate: () => Promise<[number, number] | null>;
  /**
   * 按 kind 过滤 marker 可见性。null / 空 Set = 全部可见。
   * 不销毁实例,过渡走 200ms CSS(opacity + transform)。
   * 集合内不放 null —— null kind 的 marker 在 kinds 非空时一律视为不可见。
   */
  setVisibleKinds: (kinds: Set<FishingSpotKind> | null) => void;
  /** hover preview —— AMap.InfoWindow 显示 name + kind + region;null = 关闭 */
  setHoverPreview: (spot: MapMarker | null) => void;
}

/** useFishingRoute —— 历史 stub,返回空对象,见文件头注释 */
export function useFishingRoute(_getMap: () => FishingMapInstance | null) {
  // 历史占位:planFromMarker / clearRoute 已删除,marker index 由 SpotDetailPanel
  // 自行管理。如未来无引用,可删除本 composable。
  const selectedSpotIndex = ref<number | null>(null);
  return {
    isPlanning: ref(false),
    routeInfo: ref<null>(null),
    selectedSpotIndex,
    planFromMarker: (_index: number, _spot: MapMarker): Promise<void> =>
      Promise.resolve(),
    clearRoute: (): void => undefined,
  };
}