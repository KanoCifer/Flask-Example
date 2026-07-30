/**
 * FishingMapRuntime —— React 端地图行为深模块。
 *
 * 镜像 Vue 端 fishingMapRuntime.ts。把 marker 渲染、kind 过滤、hover preview、
 * 定位、路线规划等 AMap 操作收拢到此 class;React hook (useMap) 只负责生命周期编排。
 */
import type { FishingSpotKind, MapMarker } from '@readinglist/types';

import type { AMapWithPlugins, InfoWindowInstance } from './amapNamespace';
import type { RouteInfo } from '../types';
import { escapeHtml, fillFor, makeFishMarkerHtml, makeHoverPreviewHtml } from '@readinglist/utils';

// ---- 内部服务类型(本文件独占,不导出) ----

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

interface GeolocationResult {
  position: { lng: number; lat: number };
  info?: string;
}

/** marker 点击时抛出的载荷 */
export interface MarkerClickPayload {
  index: number;
  spot: MapMarker;
}

export class FishingMapRuntime {
  private readonly map: AMap.Map;
  private readonly ns: AMapWithPlugins;

  private readonly geolocation: AMapWithPlugins['Geolocation'] extends new (
    options?: infer _opts,
  ) => infer R
    ? R
    : never;
  private markers: AMap.Marker[] = [];
  private markerSources: MapMarker[] = [];
  private markerDomElements: (HTMLElement | null)[] = [];
  private userLocationMarker: AMap.Marker | null = null;
  private hoverInfoWindow: InfoWindowInstance;
  private hoverIndex: number | null = null;
  private drivingInstance: DrivingService | null = null;
  private currentRoute: AMap.Polyline | null = null;

  /**
   * 标记点击回调(由组件注入,转发到上层);
   * payload.spot.extraData 含钓点业务字段。
   */
  onMarkerClick: ((payload: MarkerClickPayload) => void) | null = null;

  constructor(map: AMap.Map, ns: AMapWithPlugins) {
    this.map = map;
    this.ns = ns;
    this.geolocation = new ns.Geolocation({
      enableHighAccuracy: true,
      timeout: 10000,
      offset: [10, 20],
      position: 'RT',
      panToLocation: false,
    });
    this.hoverInfoWindow = new ns.InfoWindow({
      isCustom: true,
      offset: [0, -28],
      closeWhenClickMap: true,
    });
  }

  // ---- marker 渲染与事件 ----

  renderMarkers(markers: MapMarker[]): void {
    this.clearMarkers();
    const { map, ns } = this;

    markers.forEach((markerData, index) => {
      const html = markerData.content ?? makeFishMarkerHtml(markerData, index);
      const marker = new ns.Marker({
        position: markerData.position,
        content: html,
        offset: new ns.Pixel(-19, -19),
      });

      marker.on('click', () => {
        this.onMarkerClick?.({ index, spot: this.markerSources[index] });
      });
      marker.on('mouseover', () => this.handleHover(index));
      marker.on('mouseout', () => this.handleHoverEnd());

      marker.setMap(map);

      queueMicrotask(() => this.attachKeyboard(index, marker));

      this.markers.push(marker);
      this.markerSources.push(markerData);
      this.markerDomElements.push(null);
    });
  }

  private attachKeyboard(index: number, marker: AMap.Marker): void {
    const getDomElement = (marker as unknown as {
      getDomElement?: () => HTMLElement | null;
    }).getDomElement;
    if (typeof getDomElement !== 'function') return;
    const dom = getDomElement.call(marker);
    if (!dom) return;
    const inner = dom.querySelector<HTMLElement>('.fish-marker');
    if (!inner) return;
    this.markerDomElements[index] = inner;

    inner.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        this.onMarkerClick?.({
          index,
          spot: this.markerSources[index],
        });
      }
    });
  }

  clearMarkers(): void {
    this.markers.forEach((m) => m.setMap(null));
    this.markers = [];
    this.markerSources = [];
    this.markerDomElements = [];
    this.hoverIndex = null;
    this.hoverInfoWindow?.close();
  }

  // ---- kind 过滤 ----

  setVisibleKinds(kinds: Set<FishingSpotKind> | null): void {
    const allVisible = !kinds || kinds.size === 0;
    this.markers.forEach((marker, i) => {
      const spot = this.markerSources[i];
      const visible = allVisible || (spot.kind != null && kinds.has(spot.kind));
      const dom = this.markerDomElements[i];

      if (visible) {
        if (!marker.getMap()) {
          marker.setMap(this.map);
          queueMicrotask(() => {
            if (dom) {
              dom.classList.remove('fish-marker--leaving');
              dom.classList.add('fish-marker--visible');
            }
          });
        } else {
          dom?.classList.add('fish-marker--visible');
        }
      } else {
        if (marker.getMap()) {
          dom?.classList.remove('fish-marker--visible');
          dom?.classList.add('fish-marker--leaving');
          dom?.addEventListener(
            'transitionend',
            () => {
              if (
                this.markerDomElements[i]?.classList.contains(
                  'fish-marker--leaving',
                )
              ) {
                marker.setMap(null);
              }
            },
            { once: true },
          );
          window.setTimeout(() => {
            if (
              this.markerDomElements[i]?.classList.contains(
                'fish-marker--leaving',
              ) &&
              marker.getMap()
            ) {
              marker.setMap(null);
            }
          }, 240);
        }
      }
    });
  }

  // ---- hover preview ----

  setHoverPreview(spot: MapMarker | null): void {
    if (!spot) {
      this.hoverInfoWindow.close();
      this.hoverIndex = null;
      return;
    }
    this.hoverInfoWindow.setContent(makeHoverPreviewHtml(spot));
    this.hoverInfoWindow.open(this.map, spot.position);
    this.hoverIndex = this.markerSources.indexOf(spot);
  }

  private handleHover(index: number): void {
    const spot = this.markerSources[index];
    if (!spot) return;
    this.hoverIndex = index;
    this.setHoverPreview(spot);
  }

  private handleHoverEnd(): void {
    window.setTimeout(() => {
      if (this.hoverIndex !== null) {
        return;
      }
      this.hoverInfoWindow.close();
    }, 150);
    this.hoverIndex = null;
  }

  // ---- 视角控制 ----

  resize(): void {
    (this.map as unknown as { resize: () => void }).resize();
  }

  setZoomAndCenter(zoom: number, center: [number, number]): void {
    this.map.setZoomAndCenter(zoom, center);
  }

  // ---- 定位 ----

  getCurrentPosition(): Promise<[number, number]> {
    return new Promise<[number, number]>((resolve, reject) => {
      this.geolocation.getCurrentPosition(
        (status: string, result: GeolocationResult) => {
          if (status === 'complete' && result.position) {
            resolve([result.position.lng, result.position.lat]);
          } else {
            this.locateByIp().then(resolve, reject);
          }
        },
      );
    });
  }

  /**
   * 定位:获取位置 → 打蓝点 → 移图。
   * 与 Vue 端 locate 行为对齐:
   * - 成功:打 userLocationMarker + setZoomAndCenter(15, pos)
   * - 失败:返回 null
   */
  async locate(): Promise<[number, number] | null> {
    try {
      const pos = await this.getCurrentPosition();
      this.showUserLocationMarker(pos[0], pos[1]);
      this.setZoomAndCenter(15, pos);
      return pos;
    } catch {
      return null;
    }
  }

  showUserLocationMarker(lng: number, lat: number): void {
    const { map, ns } = this;
    if (this.userLocationMarker) {
      map.remove(this.userLocationMarker);
      this.userLocationMarker = null;
    }
    this.userLocationMarker = new ns.Marker({
      position: [lng, lat],
      content:
        '<div style="width:16px;height:16px;background:#1e88e5;border:2px solid #fff;border-radius:50%;box-shadow:0 0 0 4px rgba(30,136,229,0.25);"></div>',
      offset: new ns.Pixel(-10, -10),
      zIndex: 200,
    });
    map.add(this.userLocationMarker);
  }

  // ---- 路线规划 ----

  /**
   * 规划驾车路线并在 map 上绘制 Polyline。
   * 与 useMap.ts 原 planRoute 行为一致。
   */
  async planRoute(
    start: [number, number],
    end: [number, number],
  ): Promise<RouteInfo> {
    if (!this.drivingInstance) {
      this.drivingInstance = new this.ns.Driving({
        map: this.map,
        showTraffic: true,
      });
    }

    this.clearRoute();

    return await new Promise<RouteInfo>((resolve, reject) => {
      this.drivingInstance?.search(
        start,
        end,
        (status: string, result: AMapDrivingResult | string) => {
          if (
            status !== 'complete' ||
            typeof result === 'string' ||
            !result.routes.length
          ) {
            reject(new Error('未找到可用路线'));
            return;
          }

          const route = result.routes[0];
          const path: [number, number][] = [];
          route.steps.forEach((step) => {
            path.push(...step.path);
          });

          const polyline = new this.ns.Polyline!({
            path,
            strokeColor: '#1890ff',
            strokeWeight: 6,
            strokeOpacity: 0.9,
            lineJoin: 'round',
            lineCap: 'round',
          });

          this.map.add(polyline);
          this.map.setFitView();
          this.currentRoute = polyline;

          const routeInfo: RouteInfo = {
            distance: route.distance,
            time: route.time,
          };
          resolve(routeInfo);
        },
      );
    });
  }

  clearRoute(): void {
    if (this.currentRoute && this.map) {
      this.map.remove(this.currentRoute);
      this.currentRoute = null;
    }
  }

  // ---- 资源释放 ----

  dispose(): void {
    this.clearMarkers();
    this.hoverInfoWindow?.close();
    if (this.userLocationMarker) {
      this.map.remove(this.userLocationMarker);
      this.userLocationMarker = null;
    }
    this.clearRoute();
    this.drivingInstance?.clear();
    this.drivingInstance = null;
  }

  // ---- 私有:IP 城市级兜底定位 ----

  private locateByIp(): Promise<[number, number]> {
    return new Promise((resolve, reject) => {
      const citySearch = new this.ns.CitySearch();
      citySearch.getLocalCity((status, result) => {
        const r = result as { rectangle?: string; info?: string } | null;
        if (status !== 'complete') {
          reject(new Error(r?.info || '未知'));
          return;
        }
        if (!r?.rectangle) {
          reject(new Error('IP 定位未返回坐标范围'));
          return;
        }
        const [p1, p2] = r.rectangle.split(';');
        if (!p1 || !p2) {
          reject(new Error('IP 定位坐标格式异常'));
          return;
        }
        const [lng1, lat1] = p1.split(',').map(Number);
        const [lng2, lat2] = p2.split(',').map(Number);
        if ([lng1, lat1, lng2, lat2].some(Number.isNaN)) {
          reject(new Error('IP 定位坐标解析失败'));
          return;
        }
        resolve([(lng1 + lng2) / 2, (lat1 + lat2) / 2]);
      });
    });
  }
}
