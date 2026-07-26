import { useNotificationStore } from '@/stores';
import type { MapMarker } from '@/features/fishing/types';
import { useSequencedTask } from '@/composables';
import { ref } from 'vue';

export interface RouteInfo {
  distance: number;
  time: number;
}

export interface FishingMapInstance {
  planRoute: (
    start: [number, number],
    end: [number, number],
  ) => Promise<RouteInfo>;
  clearRoute: () => void;
  getCurrentPosition: () => Promise<[number, number]>;
  /** 地图视角移动到指定坐标并缩放 */
  setZoomAndCenter: (zoom: number, center: [number, number]) => void;
  /** 定位:移图 + 打点,返回坐标供调用方复用。初始化自动定位与按钮重试共用 */
  locate: () => Promise<[number, number] | null>;
}

/** 米 → "xxx 米 / x.x 公里" */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} 米`;
  return `${(meters / 1000).toFixed(1)} 公里`;
}

export function useFishingRoute(getMap: () => FishingMapInstance | null) {
  const notifier = useNotificationStore();

  const isPlanning = ref(false);
  const routeInfo = ref<RouteInfo | null>(null);
  const selectedSpotIndex = ref<number | null>(null);

  // 「最新调用胜出」竞态守卫：旧 await 在 finally/错误分支被吞掉
  const seq = useSequencedTask();

  async function planFromMarker(index: number, spot: MapMarker): Promise<void> {
    const map = getMap();
    if (!map) return;

    const mine = seq.begin();
    selectedSpotIndex.value = index;
    isPlanning.value = true;
    routeInfo.value = null;

    try {
      const position = await map.getCurrentPosition();
      if (!seq.isActive(mine)) return;

      const result = await map.planRoute(position, spot.position);
      if (!seq.isActive(mine)) return;

      routeInfo.value = result;
    } catch (err) {
      if (!seq.isActive(mine)) return;
      const message =
        err instanceof Error
          ? err.message
          : '路线规划失败，请检查网络连接或定位权限';
      notifier.error(message);
      selectedSpotIndex.value = null;
    } finally {
      if (seq.isActive(mine)) {
        isPlanning.value = false;
      }
    }
  }

  function clearRoute(): void {
    const map = getMap();
    if (!map) return;
    map.clearRoute();
    routeInfo.value = null;
    selectedSpotIndex.value = null;
  }

  return {
    isPlanning,
    routeInfo,
    selectedSpotIndex,
    planFromMarker,
    clearRoute,
  };
}
