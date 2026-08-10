/**
 * useMap —— 地图生命周期的 React 薄层 hook。
 *
 * 职责:
 * - 加载 AMap 脚本 + 构造地图实例
 * - 创建 FishingMapRuntime 实例,所有 AMap 行为委托给 runtime
 * - 管理 React 状态(isMapReady) + 转发 onMarkerClick
 * - 暴露与重构前一致的返回值签名(兼容已有 consumer)
 *
 * 所有 AMap 细节操作(marker 渲染 / kind 过滤 / hover / 定位 / 路线)见 FishingMapRuntime。
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { useRouteMapStore } from '@/stores/routeMapStore';
import AMapLoader from '@amap/amap-jsapi-loader';

import { MAP_CENTER, MAP_PLUGIN_LIST, MAP_ZOOM } from '../constants';
import { FishingMapRuntime } from '../runtime/FishingMapRuntime';
import type { AMapWithPlugins } from '../runtime/amapNamespace';
import type { MapMarker } from '@readinglist/types';
import type { RouteInfo } from '../types';
import { useGeolocation } from './useGeolocation';
import { useNotificationStore } from '@/stores/notificationState';

// StrictMode 守卫：防止 effect 双重调用时重复加载 AMap 脚本
let amapScriptPromise: Promise<AMapWithPlugins> | null = null;

export function useMap(
  containerRef: React.RefObject<HTMLDivElement | null>,
  getSecurityJsCode: () => Promise<string>,
  onMarkerClick: (index: number, userPosition: [number, number]) => void,
  markers: MapMarker[],
) {
  const mapInstanceRef = useRef<AMap.Map | null>(null);
  const runtimeRef = useRef<FishingMapRuntime | null>(null);
  const onMarkerClickRef = useRef(onMarkerClick);
  const getSecurityJsCodeRef = useRef(getSecurityJsCode);
  const routeActionsRef = useRef(useRouteMapStore.getState());
  const markersRef = useRef<MapMarker[]>(markers);

  const [isMapReady, setIsMapReady] = useState(false);

  const notifyError = useCallback((message: string) => {
    useNotificationStore.getState().error(message);
  }, []);

  const getAMap = useCallback(
    () => window.AMap as AMapWithPlugins | undefined,
    [],
  );

  const {
    userPosition,
    isLocating,
    retry: retryLocate,
  } = useGeolocation(getAMap, notifyError, { enabled: true });

  /** 清除路线:委托 runtime 清理 AMap overlay + 清理 store 状态 */
  const clearRoute = useCallback(() => {
    runtimeRef.current?.clearRoute();
    routeActionsRef.current.clearRoute();
  }, []);

  /** 规划驾车路线:委托 runtime 绘制 AMap Polyline + 更新 store */
  const planRoute = useCallback(
    async (
      start: [number, number],
      end: [number, number],
    ): Promise<RouteInfo> => {
      const runtime = runtimeRef.current;
      if (!runtime) {
        throw new Error('地图未初始化');
      }
      const routeInfo = await runtime.planRoute(start, end);
      routeActionsRef.current.setRouteInfo(routeInfo);
      return routeInfo;
    },
    [],
  );

  /** marker 点击转发的 ref 保持器 */
  const handleMarkerClickInternal = useCallback((index: number) => {
    const selectedSpot = markersRef.current[index];
    if (!selectedSpot) return;
    onMarkerClickRef.current(index, selectedSpot.position);
  }, []);

  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick;
  }, [onMarkerClick]);

  useEffect(() => {
    getSecurityJsCodeRef.current = getSecurityJsCode;
  }, [getSecurityJsCode]);

  useEffect(() => {
    markersRef.current = markers;
  }, [markers]);

  /** 地图聚焦：委托 runtime.setZoomAndCenter */
  const focusMap = useCallback((location: [number, number], zoom = 15) => {
    runtimeRef.current?.setZoomAndCenter(zoom, location);
  }, []);

  // ── 地图初始化（仅挂载时一次）──
  useEffect(() => {
    let map: AMap.Map | null = null;
    let runtime: FishingMapRuntime | null = null;

    const initializeMap = async () => {
      const containerElement = containerRef.current;
      if (!containerElement) return;

      try {
        const securityJsCode = await getSecurityJsCodeRef.current();
        window._AMapSecurityConfig = {
          securityJsCode,
        };
        const mapApiKey = import.meta.env.VITE_JS_API;
        if (!mapApiKey) {
          throw new Error('缺少 VITE_JS_API 配置');
        }
        if (!amapScriptPromise) {
          amapScriptPromise = AMapLoader.load({
            key: mapApiKey,
            version: '2.0',
            plugins: MAP_PLUGIN_LIST,
          }) as Promise<AMapWithPlugins>;
          amapScriptPromise.catch(() => {
            amapScriptPromise = null;
          });
        }
        await amapScriptPromise.then(async (loadedAMap) => {
          const AMapNs = loadedAMap as AMapWithPlugins;
          map = new AMapNs.Map(containerElement, {
            viewMode: '2D',
            zoom: MAP_ZOOM,
            center: MAP_CENTER,
          });
          if (!map) throw new Error('地图实例创建失败');

          const toolbar = new AMapNs.ToolBar();
          map.addControl(toolbar);
          const scale = new AMapNs.Scale();
          map.addControl(scale);

          mapInstanceRef.current = map;

          // 创建 runtime 并注入 marker click 回调
          runtime = new FishingMapRuntime(map, AMapNs);
          runtime.onMarkerClick = (payload) => {
            handleMarkerClickInternal(payload.index);
          };
          runtimeRef.current = runtime;

          // 渲染初始 markers
          runtime.renderMarkers(markersRef.current);

          setIsMapReady(true);
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '地图初始化失败';
        notifyError(message);
        setIsMapReady(false);
      }
    };

    void initializeMap();

    return () => {
      runtime?.dispose();
      runtimeRef.current = null;
      mapInstanceRef.current?.destroy();
      mapInstanceRef.current = null;
      map?.destroy();
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
    // containerRef 之外的依赖通过 ref 镜像最新值
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef]);

  // markers 变化时委托 runtime 重渲染
  useEffect(() => {
    if (!isMapReady) return;
    runtimeRef.current?.renderMarkers(markers);
  }, [markers, isMapReady]);

  return {
    isMapReady,
    isLocating,
    userPosition,
    planRoute,
    clearRoute,
    focusMap,
    retryLocate,
    /** FishingMapRuntime 引用,供组件直接调用 setVisibleKinds / setHoverPreview 等 */
    runtime: runtimeRef,
  };
}
