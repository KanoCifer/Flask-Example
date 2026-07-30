/**
 * AMap namespace 插件类型 —— React 端 FishingMapRuntime 专用。
 *
 * 从 useMap.ts 提取并补齐 InfoWindow 类型;Vue 端同名文件同形但不共享。
 * 官方 @types/amap-js-api 只覆盖核心 map API,插件类型须自行声明。
 */
import type { GeolocationStatusEvent } from '../types';

// ---- AMap 安全密钥全局声明 ----
declare global {
  interface Window {
    _AMapSecurityConfig?: { securityJsCode: string };
  }
}

interface CitySearchService {
  getLocalCity(
    callback: (status: 'complete' | string, result: unknown) => void,
  ): void;
}

interface GeolocationService {
  getCurrentPosition(
    callback: (
      status: 'complete' | string,
      result: GeolocationStatusEvent,
    ) => void,
  ): void;
}

interface DrivingService {
  search(
    origin: [number, number] | AMap.LngLat,
    destination: [number, number] | AMap.LngLat,
    callback: (
      status: 'complete' | 'no_data' | string,
      result: AMapDrivingResult | string,
    ) => void,
  ): void;
  clear(): void;
}

interface AMapDrivingResult {
  routes: Array<{
    distance: number;
    time: number;
    steps: Array<{ path: [number, number][] }>;
  }>;
}

interface PolylineOptions {
  path: [number, number][];
  strokeColor?: string;
  strokeWeight?: number;
  strokeOpacity?: number;
  lineJoin?: string;
  lineCap?: string;
}

export interface InfoWindowInstance {
  setContent(content: string | HTMLElement): void;
  setPosition(position: [number, number] | AMap.LngLat): void;
  open(map: AMap.Map, position?: [number, number] | AMap.LngLat): void;
  close(): void;
}

/**
 * 把官方 AMap 核心类 + 插件 ctor 合并为单一视图。
 * 消费方即可 AMap.X 访问所有构造器。
 */
export type AMapWithPlugins = typeof AMap & {
  CitySearch: new () => CitySearchService;
  Driving: new (options?: {
    map?: AMap.Map;
    policy?: number;
    showTraffic?: boolean;
  }) => DrivingService;
  Geolocation: new (options?: {
    enableHighAccuracy?: boolean;
    timeout?: number;
    offset?: [number, number];
    position?: string;
    panToLocation?: boolean;
  }) => GeolocationService;
  InfoWindow: new (options?: {
    content?: string | HTMLElement;
    offset?: [number, number];
    position?: [number, number] | AMap.LngLat;
    isCustom?: boolean;
    closeWhenClickMap?: boolean;
  }) => InfoWindowInstance;
  Polyline: new (options?: PolylineOptions) => AMap.Polyline;
  ToolBar: new (opts?: { position?: string }) => object;
  Scale: new () => object;
};

declare global {
  interface Window {
    AMap?: AMapWithPlugins;
  }
}
