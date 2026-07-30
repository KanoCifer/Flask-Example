import type { FishingSpot, MapMarker } from '@readinglist/types';

/**
 * FishingSpot DTO → MapMarker transform。
 * location 拆为 position；kind 提升到顶层（标记配色 / 过滤必用）；其余字段收进 extraData。
 *
 * 纯函数、无副作用 —— 可在 composable / 测试中直接调用。
 */
export function toMapMarker(spot: FishingSpot): MapMarker {
  const { location, ...rest } = spot;
  return {
    position: location,
    kind: spot.kind,
    extraData: rest,
  };
}

/** 批量 transform —— fishingSpotsGateway.list() 结果直接喂给本函数 */
export function toMapMarkers(spots: FishingSpot[]): MapMarker[] {
  return spots.map(toMapMarker);
}
