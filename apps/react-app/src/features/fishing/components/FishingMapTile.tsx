/**
 * FishingMapTile —— 全屏地图背景。
 *
 * 固定 inset-0 占据整个 viewport (z-0), 处于 DashboardSheet (z-30) 之下。
 * 路线状态 UI 全部上移至 DashboardSheet, 这里只承载地图本身。
 */
import { useEffect, useRef } from 'react';

import { Loader2, Locate } from 'lucide-react';

import { useRouteMapStore } from '@/stores/routeMapStore';
import type { MapMarker } from '@/types/marker';

import { useMap } from '../hooks/useMap';
import { fishingMapService } from '../api/service';

interface FishingMapTileProps {
  /**
   * 父组件若需要 ref 控制 map（如 forwardRef），可传 ref。
   * 不传则内部自管 —— 这是默认场景。
   */
  containerRef?: React.RefObject<HTMLDivElement | null>;
  /** 钓点标记源数据（由父组件 store 管理） */
  markers: MapMarker[];
  /** marker 点击回调 —— 打开钓点详情 */
  onMarkerSelect: (marker: MapMarker) => void;
  /** 需要聚焦的坐标（打开钓点详情时由父组件传入），null 表示不聚焦 */
  focusedLocation: [number, number] | null;
}

export function FishingMapTile({
  containerRef: externalRef,
  markers,
  onMarkerSelect,
  focusedLocation,
}: FishingMapTileProps) {
  const internalRef = useRef<HTMLDivElement | null>(null);
  const containerRef = externalRef ?? internalRef;

  const serviceRef = useRef(fishingMapService());
  useRouteMapStore((s) => s.planRouteAction);

  const getSecurityJsCode = (): Promise<string> =>
    serviceRef.current.getSecurityJsCode();

  /**
   * marker click 回调：打开钓点详情面板。
   * 签名对齐 useMap 的 onMarkerClick(index, userPosition)。
   */
  const handleMarkerClick = (
    index: number,
    userPosition: [number, number],
  ): void => {
    void userPosition;
    const marker = markers[index];
    if (marker) onMarkerSelect(marker);
  };

  const { isMapReady, isLocating, focusMap, retryLocate } = useMap(
    containerRef,
    getSecurityJsCode,
    handleMarkerClick,
    markers,
  );

  // 父组件传入聚焦坐标时，将地图中心移至该钓点
  useEffect(() => {
    if (focusedLocation) {
      focusMap(focusedLocation);
    }
  }, [focusedLocation, focusMap]);

  return (
    <div className="fixed inset-0 z-0">
      <div
        ref={containerRef}
        className="amap-fs h-full w-full"
        aria-label="fishing map"
      />
      {/* 定位按钮:重试定位,对齐 Vue MapContainer */}
      <button
        type="button"
        className="bg-page/90 text-ink hover:bg-page /40 absolute right-2.5 bottom-5 z-60 flex h-11 w-11 items-center justify-center rounded-xl border shadow-sm backdrop-blur-md transition-all duration-200 ease-out active:scale-95 disabled:opacity-50"
        aria-label="定位到当前位置"
        disabled={isLocating}
        onClick={() => void retryLocate()}
      >
        {isLocating ? (
          <Loader2 className="text-ink h-4 w-4 animate-spin" />
        ) : (
          <Locate className="h-4 w-4" />
        )}
      </button>

      {!isMapReady && (
        <div className="text-muted bg-page/60 absolute inset-0 z-10 flex items-center justify-center text-xs backdrop-blur-[2px]">
          地图加载中…
        </div>
      )}
    </div>
  );
}
