/**
 * 地图标记点 DTO（不耦合 AMap SDK —— useMap 内部转为 AMap.Marker）。
 *
 * 字段:
 * - position: 经纬度 [lng, lat]
 * - content:  自定义 DOM 字符串（可选）
 * - offset:   像素偏移（可选；与 content 配合使用）
 */
export interface MapMarker {
  position: [number, number];
  content?: string;
  offset?: [number, number];
  /** 钓点业务字段（location 除外）—— 供详情面板 / 上层消费，对齐 frontend MapMarker.extraData */
  extraData?: Record<string, unknown>;
}
