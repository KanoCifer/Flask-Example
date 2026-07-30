/**
 * FishingMapInstance —— React 端公开的地图行为接口。
 *
 * 与 Vue 端同名接口同形但不共享(遵守 ADR-0002:只契约对齐,不跨前端共享代码)。
 * FishingMapTile 及其父组件通过此接口操作地图 runtime,不直接依赖 AMap。
 */
import type { FishingSpotKind, MapMarker } from '@readinglist/types';

export interface FishingMapInstance {
  /** 当前位置 [lng,lat](GCJ-02),Geolocation + IP 兜底 */
  getCurrentPosition: () => Promise<[number, number]>;
  /** 地图视角移动到指定坐标并缩放 */
  setZoomAndCenter: (zoom: number, center: [number, number]) => void;
  /** 定位:移图 + 打点,返回坐标供调用方复用 */
  locate: () => Promise<[number, number] | null>;
  /**
   * 按 kind 过滤 marker 可见性。null / 空 Set = 全部可见。
   * 不销毁实例,过渡走 200ms CSS(opacity + transform)。
   */
  setVisibleKinds: (kinds: Set<FishingSpotKind> | null) => void;
  /** hover preview —— InfoWindow 显示 name + kind;null = 关闭 */
  setHoverPreview: (spot: MapMarker | null) => void;
}
