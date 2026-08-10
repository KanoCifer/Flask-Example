/**
 * In-memory AMap 引擎 stub —— FishingMapRuntime 单测专用。
 *
 * 只覆盖 FishingMapRuntime 在任务 282 后实际触达的 API:
 * - Marker:   on / off / setMap / getMap
 * - InfoWindow: setContent / open / close
 * - Map:      on / off / setZoomAndCenter / setCenter / setZoom / remove / add / destroy
 * - Geolocation: getCurrentPosition(complete / fail)
 * - CitySearch: getLocalCity
 * - 顶层常量: Pixel(包装为 { x, y })
 *
 * 设计原则:
 * - 不写真 AMap,只让 FishingMapRuntime 跑起来;无 DOM / 异步 loader 依赖
 * - 事件回调以 this 注入方式存;测试断言用 emit(...)
 * - 暴露 queryable 状态(markers / openInfoWindows)便于验证副作用
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

class FakeMarker extends EventBus {
  position: [number, number];
  content: string;
  offset: { x: number; y: number };
  /** 当前挂载的 map;null 表示未挂载 */
  attachedMap: FakeMap | null = null;

  constructor(opts: {
    position?: [number, number];
    content?: string;
    offset?: { x: number; y: number };
  }) {
    super();
    this.position = opts.position ?? [0, 0];
    this.content = opts.content ?? '';
    this.offset = opts.offset ?? { x: 0, y: 0 };
  }

  setMap(map: FakeMap | null): void {
    this.attachedMap = map;
    if (map) map.add(this);
    else this.attachedMap?.remove(this);
  }

  getMap(): FakeMap | null {
    return this.attachedMap;
  }
}

class FakeInfoWindow extends EventBus {
  content: string;
  isOpen = false;
  openedAt: [number, number] | null = null;

  constructor(opts: { content?: string } = {}) {
    super();
    this.content = opts.content ?? '';
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

class FakeMap extends EventBus {
  container: HTMLElement | null;
  center: [number, number] = [0, 0];
  zoom = 11;
  private overlays = new Set<FakeMarker>();

  constructor(container: HTMLElement | null) {
    super();
    this.container = container;
  }

  add(overlay: FakeMarker): void {
    this.overlays.add(overlay);
  }

  remove(overlay: FakeMarker): void {
    this.overlays.delete(overlay);
  }

  /** 测试断言:当前挂载的 marker 数量 */
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

  resize(): void {
    /* no-op */
  }

  destroy(): void {
    this.overlays.clear();
  }
}

class FakeGeolocation {
  /** next response — 'complete' -> resolve, 'fail' -> 走 IP 兜底 */
  static nextStatus: 'complete' | 'fail' = 'complete';
  static nextPosition: [number, number] = [113.4, 23.06];

  constructor(_opts?: Record<string, unknown>) {
    /* no-op */
  }

  getCurrentPosition(
    cb: (
      status: string,
      result: { position: { lng: number; lat: number } },
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

/** Fake AMap namespace —— 类型签名贴近 @readinglist/utils amapNamespace 消费方 */
export function createInMemoryAmap() {
  const markers: FakeMarker[] = [];
  const infoWindows: FakeInfoWindow[] = [];
  const map = new FakeMap(document.createElement('div'));

  /**
   * ns.Marker / InfoWindow / Geolocation / CitySearch 都必须能 `new`。
   * - vi.fn 直接 wrap class 丢失 prototype → 实例无方法
   * - vi.fn wrap 箭头函数 → 箭头函数不可 new
   * 解决:用 function declaration 包装,内部返回真实构造的实例。
   * spy 拦截 `new spy(...)` 调用并记录,返回的对象是 FakeMarker 实例。
   */
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
    opts?: { content?: string },
  ): FakeInfoWindow {
    const w = new FakeInfoWindow(opts);
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

  const MarkerSpy = vi.fn(makeMarker);
  const InfoWindowSpy = vi.fn(makeInfoWindow);
  const GeolocationSpy = vi.fn(makeGeolocation);
  const CitySearchSpy = vi.fn(makeCitySearch);
  const PixelSpy = vi.fn(makePixel);

  return {
    map: map as unknown as ConstructorParameters<
      typeof import('../fishingMapRuntime').FishingMapRuntime
    >[0],
    markers,
    infoWindows,
    ns: {
      Marker: MarkerSpy as unknown as new (
        opts: ConstructorParameters<typeof FakeMarker>[0],
      ) => FakeMarker,
      InfoWindow: InfoWindowSpy as unknown as new (opts?: {
        content?: string;
      }) => FakeInfoWindow,
      Geolocation: GeolocationSpy as unknown as new (
        opts?: Record<string, unknown>,
      ) => FakeGeolocation,
      CitySearch: CitySearchSpy as unknown as new () => FakeCitySearch,
      Pixel: PixelSpy as unknown as new (
        x: number,
        y: number,
      ) => { x: number; y: number },
    } as unknown as ConstructorParameters<
      typeof import('../fishingMapRuntime').FishingMapRuntime
    >[1] & { _internals: { map: FakeMap; markers: FakeMarker[] } },
  };
}

export { FakeMarker, FakeInfoWindow, FakeMap };
