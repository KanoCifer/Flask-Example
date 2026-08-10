/**
 * In-memory AMap 引擎 stub —— FishingMapRuntime 单测专用。
 *
 * React 端独立实现,与 Vue 端同形但不共享。
 * 只覆盖 FishingMapRuntime 实际触达的 API 子集。
 *
 * 设计原则:
 * - 不写真 AMap,只让 FishingMapRuntime 跑起来;无 DOM / 异步 loader 依赖
 * - 事件回调以注入方式存;测试断言用 emit(...)
 * - 暴露 queryable 状态(marker / infoWindow 实例数组)便于验证副作用
 */
import { vi } from 'vitest';

type Handler = (event: unknown) => void;

class EventBus {
  private map = new Map<string, Set<Handler>>();

  on(eventName: string, handler: Handler): this {
    if (!this.map.has(eventName)) this.map.set(eventName, new Set());
    this.map.get(eventName)!.add(handler);
    return this;
  }

  off(eventName: string, handler: Handler): this {
    this.map.get(eventName)?.delete(handler);
    return this;
  }

  emit(eventName: string, data?: unknown): this {
    this.map.get(eventName)?.forEach((h) => h(data));
    return this;
  }
}

export class FakeMarker extends EventBus {
  position: [number, number];
  content: string;
  offset: { x: number; y: number };
  /** 当前挂载的 map;null 表示未挂载 */
  attachedMap: FakeMap | null = null;
  zIndex?: number;

  constructor(opts: {
    position?: [number, number];
    content?: string;
    offset?: { x: number; y: number };
    zIndex?: number;
  }) {
    super();
    this.position = opts.position ?? [0, 0];
    this.content = opts.content ?? '';
    this.offset = opts.offset ?? { x: 0, y: 0 };
    this.zIndex = opts.zIndex;
  }

  setMap(map: FakeMap | null): void {
    if (map) {
      this.attachedMap = map;
      map.add(this);
    } else {
      this.attachedMap?.remove(this);
      this.attachedMap = null;
    }
  }

  getMap(): FakeMap | null {
    return this.attachedMap;
  }
}

export class FakeInfoWindow extends EventBus {
  content: string;
  isOpen = false;
  openedAt: [number, number] | null = null;

  constructor(_opts?: Record<string, unknown>) {
    super();
    this.content = '';
  }

  setContent(content: string): void {
    this.content = content;
  }

  open(_map: FakeMap, position?: [number, number]): void {
    this.isOpen = true;
    this.openedAt = position ?? null;
  }

  close(): void {
    this.isOpen = false;
  }
}

export class FakeMap extends EventBus {
  container: HTMLElement | null;
  center: [number, number] = [0, 0];
  zoom = 11;
  private overlays = new Set<FakeMarker | FakePolyline>();

  constructor(container: HTMLElement | null) {
    super();
    this.container = container;
  }

  add(overlay: FakeMarker | FakePolyline): void {
    this.overlays.add(overlay);
  }

  remove(overlay: FakeMarker | FakePolyline): void {
    this.overlays.delete(overlay);
  }

  /** 测试断言:当前挂载的 overlay 数量 */
  getOverlayCount(): number {
    return this.overlays.size;
  }

  setCenter(center: [number, number]): void {
    this.center = center;
  }

  setZoom(zoom: number): void {
    this.zoom = zoom;
  }

  setZoomAndCenter(zoom: number, center: [number, number]): void {
    this.zoom = zoom;
    this.center = center;
  }

  setFitView(): void {
    /* no-op */
  }

  resize(): void {
    /* no-op */
  }

  destroy(): void {
    this.overlays.clear();
  }
}

class FakePolyline {
  path: [number, number][];
  strokeColor: string;
  strokeWeight: number;
  strokeOpacity: number;
  lineJoin: string;
  lineCap: string;

  constructor(opts: {
    path: [number, number][];
    strokeColor?: string;
    strokeWeight?: number;
    strokeOpacity?: number;
    lineJoin?: string;
    lineCap?: string;
  }) {
    this.path = opts.path;
    this.strokeColor = opts.strokeColor ?? '#1890ff';
    this.strokeWeight = opts.strokeWeight ?? 6;
    this.strokeOpacity = opts.strokeOpacity ?? 0.9;
    this.lineJoin = opts.lineJoin ?? 'round';
    this.lineCap = opts.lineCap ?? 'round';
  }
}

export class FakeDriving {
  search(
    _origin: unknown,
    _destination: unknown,
    callback: (status: string, result: unknown) => void,
  ): void {
    // 默认返回一条虚构路线
    callback('complete', {
      routes: [
        {
          distance: 5000,
          time: 600,
          steps: [
            { path: [[113.4, 23.06]] as [number, number][] },
            { path: [[113.42, 23.07]] as [number, number][] },
          ],
        },
      ],
    });
  }

  clear(): void {
    /* no-op */
  }
}

class FakeGeolocation {
  static nextStatus: 'complete' | 'fail' = 'complete';
  static nextPosition: [number, number] = [113.4, 23.06];

  constructor(_opts?: Record<string, unknown>) {
    /* no-op */
  }

  getCurrentPosition(
    cb: (
      status: string,
      result: { position: { lng: number; lat: number }; info?: string },
    ) => void,
  ): void {
    if (FakeGeolocation.nextStatus === 'complete') {
      const [lng, lat] = FakeGeolocation.nextPosition;
      cb('complete', { position: { lng, lat } });
    } else {
      cb('error', { position: { lng: 0, lat: 0 } });
    }
  }
}

class FakeCitySearch {
  rectangle = '113.3,23.0;113.5,23.1';

  getLocalCity(
    cb: (status: string, result: { rectangle: string; info: string }) => void,
  ): void {
    cb('complete', { rectangle: this.rectangle, info: 'OK' });
  }
}

/** Fake AMap namespace —— 类型签名贴近 runtime/amapNamespace 消费方 */
export function createInMemoryAmap() {
  const markers: FakeMarker[] = [];
  const infoWindows: FakeInfoWindow[] = [];
  const map = new FakeMap(document.createElement('div'));

  function makeMarker(
    this: unknown,
    opts: ConstructorParameters<typeof FakeMarker>[0],
  ): FakeMarker {
    const m = new FakeMarker(opts ?? {});
    markers.push(m);
    return m;
  }
  function makeInfoWindow(
    this: unknown,
    _opts?: Record<string, unknown>,
  ): FakeInfoWindow {
    const w = new FakeInfoWindow(_opts);
    infoWindows.push(w);
    return w;
  }
  function makeGeolocation(
    this: unknown,
    opts?: Record<string, unknown>,
  ): FakeGeolocation {
    return new FakeGeolocation(opts);
  }
  function makeCitySearch(this: unknown): FakeCitySearch {
    return new FakeCitySearch();
  }
  function makePixel(
    this: unknown,
    x: number,
    y: number,
  ): { x: number; y: number } {
    return { x, y };
  }
  function makeDriving(
    this: unknown,
    _opts?: Record<string, unknown>,
  ): FakeDriving {
    return new FakeDriving();
  }
  function makePolyline(
    this: unknown,
    opts: ConstructorParameters<typeof FakePolyline>[0],
  ): FakePolyline {
    return new FakePolyline(opts ?? { path: [] });
  }

  const MarkerSpy = vi.fn(makeMarker);
  const InfoWindowSpy = vi.fn(makeInfoWindow);
  const GeolocationSpy = vi.fn(makeGeolocation);
  const CitySearchSpy = vi.fn(makeCitySearch);
  const PixelSpy = vi.fn(makePixel);
  const DrivingSpy = vi.fn(makeDriving);
  const PolylineSpy = vi.fn(makePolyline);

  return {
    map,
    markers,
    infoWindows,
    ns: {
      Marker: MarkerSpy as unknown as new (
        opts: ConstructorParameters<typeof FakeMarker>[0],
      ) => FakeMarker,
      InfoWindow: InfoWindowSpy as unknown as new (
        opts?: Record<string, unknown>,
      ) => FakeInfoWindow,
      Geolocation: GeolocationSpy as unknown as new (
        opts?: Record<string, unknown>,
      ) => FakeGeolocation,
      CitySearch: CitySearchSpy as unknown as new () => FakeCitySearch,
      Pixel: PixelSpy as unknown as new (
        x: number,
        y: number,
      ) => { x: number; y: number },
      Driving: DrivingSpy as unknown as new (
        opts?: Record<string, unknown>,
      ) => FakeDriving,
      Polyline: PolylineSpy as unknown as new (
        opts: ConstructorParameters<typeof FakePolyline>[0],
      ) => FakePolyline,
    } as unknown as Record<string, unknown> & {
      _internals: { map: FakeMap; markers: FakeMarker[] };
    } as any,
  };
}
