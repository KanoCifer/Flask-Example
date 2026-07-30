/**
 * FishingMapRuntime —— 地图行为深模块。
 *
 * 把原本埋在 MapContainer.vue 里的三类行为收拢到一处:
 * - 钓点标记渲染 (markers,鱼形 divIcon + a11y + kind 过滤 + hover preview)
 * - 当前位置解析 (getCurrentPosition, 用 AMap.Geolocation + CitySearch IP 兜底)
 *
 * AMap 实例从构造参数直接传入;Geolocation 插件在构造时初始化,
 * 定位失败时降级到 CitySearch IP 城市级定位。
 */
import type { AMapWithPlugins } from '@/features/fishing/composables/amapNamespace';
import type { FishingSpotKind, MapMarker } from '@readinglist/types';
import { escapeHtml, fillFor, makeFishMarkerHtml, makeHoverPreviewHtml } from '@readinglist/utils';

// ---- AMap 内部服务类型(本文件独占,不导出)----

/**
 * FishingMapInstance —— MapContainer 暴露给父组件的行为接口。
 *
 * 任务 282 后:路线规划已下线,只保留定位 / 视野控制 / kind 过滤 / hover preview。
 * 原先定义在 useFishingRoute.ts,与 FishingMapRuntime 类同址更合理 —— 接口是
 * runtime 的对外契约,搬家后 useFishingRoute 整个 stub 可彻底删除。
 */
export interface FishingMapInstance {
  getCurrentPosition: () => Promise<[number, number]>;
  /** 地图视角移动到指定坐标并缩放 */
  setZoomAndCenter: (zoom: number, center: [number, number]) => void;
  /** 定位:移图 + 打点,返回坐标供调用方复用。初始化自动定位与按钮重试共用 */
  locate: () => Promise<[number, number] | null>;
  /**
   * 按 kind 过滤 marker 可见性。null / 空 Set = 全部可见。
   * 不销毁实例,过渡走 200ms CSS(opacity + transform)。
   * 集合内不放 null —— null kind 的 marker 在 kinds 非空时一律视为不可见。
   */
  setVisibleKinds: (kinds: Set<FishingSpotKind> | null) => void;
  /** hover preview —— AMap.InfoWindow 显示 name + kind + region;null = 关闭 */
  setHoverPreview: (spot: MapMarker | null) => void;
}

interface GeolocationResult {
  position: { lng: number; lat: number };
  info?: string;
}

/**
 * 静态标记 SVG —— SpotMiniMap 用(单点 / 选点提示,无 kind 信息)。
 * 保留旧版 24×32 极简几何:圆头 + 下方三角,蓝描边。
 * 主地图(任务 282 后的 renderMarkers)走鱼形 divIcon,不走这枚。
 */
export const FISHING_MARKER_CONTENT = `
  <div style="width:24px;height:32px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 1px 2px rgba(37,99,235,0.3));">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32" width="24" height="32" aria-hidden="true">
      <path
        d="M12 1.5C6.2 1.5 1.5 6.05 1.5 11.65c0 7.7 8.7 17.5 9.7 18.55a1.1 1.1 0 0 0 1.6 0c1-.05 9.7-10.85 9.7-18.55C22.5 6.05 17.8 1.5 12 1.5Z"
        fill="#FFFFFF"
        stroke="#2563EB"
        stroke-width="2"
        stroke-linejoin="round"
      />
      <circle cx="12" cy="11.5" r="3" fill="#2563EB"/>
    </svg>
  </div>
`;

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
  /** 与 this.markers 一一对应,保留 source MapMarker(含 extraData)供点击回调带回 */
  private markerSources: MapMarker[] = [];
  /** marker DOM 元素索引(AMap.Marker.getDomElement 不存在,自己存) */
  private markerDomElements: (HTMLElement | null)[] = [];
  private userLocationMarker: AMap.Marker | null = null;
  private hoverInfoWindow: AMapWithPlugins['InfoWindow'] extends new (
    options?: infer _opts,
  ) => infer R
    ? R
    : never;
  /** 当前 hover 的 marker index,用于清除预览时定位 */
  private hoverIndex: number | null = null;
  /** 处理 hover 结束延迟关闭的定时器 ID(防快速滑动累积) */
  private hoverEndTimer: ReturnType<typeof setTimeout> | null = null;
  /** setVisibleKinds 兜底 fallback 定时器 ID(所有 marker 共用一个) */
  private visibleKindsFallback: ReturnType<typeof setTimeout> | null = null;

  /**
   * 标记点击回调(由组件注入,转发到上层 emit)。
   * payload.spot.extraData 含钓点业务字段(name/description/tags/rating/images…),
   * payload.position 为经纬度 —— 详情 Modal 各取所需。
   */
  onMarkerClick: ((payload: MarkerClickPayload) => void) | null = null;

  constructor(map: AMap.Map, ns: AMapWithPlugins) {
    this.map = map;
    this.ns = ns;
    this.geolocation = new ns.Geolocation({
      enableHighAccuracy: true,
      timeout: 10000,
      // 禁止定位成功后自动移图 —— 避免 marker 点击时把地图中心拉回用户位置
      panToLocation: false,
    });
    this.hoverInfoWindow = new ns.InfoWindow({
      isCustom: true,
      offset: [0, -28],
      closeWhenClickMap: true,
    });
  }

  /** 渲染钓点标记;调用前会清除旧标记 */
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

      // 注入点击 / 键盘激活 / hover 监听
      marker.on('click', () => {
        this.onMarkerClick?.({ index, spot: this.markerSources[index] });
      });
      marker.on('mouseover', () => this.handleHover(index));
      marker.on('mouseout', () => this.handleHoverEnd());

      // AMap.Marker 渲染后从 DOM 拿外层 div,绑键盘事件
      // (AMap 把 content 字符串塞进内部容器,通过 getElement 取不到 divIcon 外壳)
      marker.setMap(map);

      // 微任务拿 DOM:AMap 把 content 注入是同步的,但保险起见 nextTick
      queueMicrotask(() => this.attachKeyboard(index, marker));

      this.markers.push(marker);
      this.markerSources.push(markerData);
      this.markerDomElements.push(null);
    });
  }

  /**
   * 给 marker 的 DOM 外壳绑键盘激活 (Enter / Space)。
   * divIcon 模式下,AMap 会把 content 字符串包一层 .amap-marker-content,
   * 其内是我们注入的 .fish-marker div(带 role="button")。
   *
   * AMap.Marker 的官方类型未声明 getDomElement,但实际运行时存在 —— 通过
   * unknown 强制断言,失败时降级(键盘激活不可用,但鼠标点击仍工作)。
   */
  private attachKeyboard(index: number, marker: AMap.Marker): void {
    const getDomElement = (
      marker as unknown as {
        getDomElement?: () => HTMLElement | null;
      }
    ).getDomElement;
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

  /** 清除所有钓点标记 */
  clearMarkers(): void {
    this.markers.forEach((m) => m.setMap(null));
    this.markers = [];
    this.markerSources = [];
    this.markerDomElements = [];
    this.hoverIndex = null;
    this.hoverInfoWindow?.close();
  }

  /**
   * 按 kind 过滤 marker 可见性 —— 200ms CSS 过渡后 setMap(null)。
   * 不销毁实例,filter 切换时无重新构造开销。
   *
   * 传 null 或空 Set → 全部可见。
   * 切换时:不可见 marker 先走过渡(淡出 + 缩小)→ transitionend 触发了再 setMap(null);
   *          重新可见 marker 立即 setMap(map),下一帧 CSS 让其淡入。
   *
   * 为什么 transitionend 不用 setTimeout:
   * - transitionend 与 CSS 真实时长同步;CSS 改 200ms 时不用动这里
   * - transitionend + e.propertyName 去重(opacity / transform 同时触发,只取首个)
   */
  setVisibleKinds(kinds: Set<FishingSpotKind> | null): void {
    const allVisible = !kinds || kinds.size === 0;
    let needsFallback = false;
    this.markers.forEach((marker, i) => {
      const spot = this.markerSources[i];
      const visible = allVisible || (spot.kind != null && kinds.has(spot.kind));
      const dom = this.markerDomElements[i];

      if (visible) {
        if (!marker.getMap()) {
          marker.setMap(this.map);
          // 重新挂载后强制 reflow,让 CSS transition 重新触发
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
          // 200ms 过渡结束再卸载 DOM(避免动画中途被撕掉)。
          // 用 transitionend 而非 setTimeout(200),与 CSS 真实时长同步。
          // 用 once:true 保证 listener 自动移除;期间用户重切可见则 marker 不再 setMap(null)。
          dom?.addEventListener(
            'transitionend',
            () => {
              // 期间用户可能重新切回可见,加保护
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
          if (!needsFallback) needsFallback = true;
        }
      }
    });
    // 兜底:所有 marker 共用一个 fallback 定时器,避免 N 个定时器。
    // 取消上一个 fallback,防止新旧切换回合时残留定时器把刚切回的 marker 卸载。
    if (this.visibleKindsFallback !== null) {
      clearTimeout(this.visibleKindsFallback);
    }
    if (needsFallback) {
      this.visibleKindsFallback = setTimeout(() => {
        this.visibleKindsFallback = null;
        this.markers.forEach((marker, i) => {
          if (
            this.markerDomElements[i]?.classList.contains(
              'fish-marker--leaving',
            ) &&
            marker.getMap()
          ) {
            marker.setMap(null);
          }
        });
      }, 240);
    }
  }

  /**
   * hover preview —— AMap.InfoWindow 显示 name + kind + region。
   * 传 null 关闭预览。
   *
   * 设计:用 isCustom:true 的 InfoWindow(纯 DOM,不走默认白卡)—— 样式由
   * .fish-preview-card class 控制,内联 style 只放布局相关 padding/min-width。
   */
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
    // 短暂延迟:用户从 marker 移到 InfoWindow 内容时,mouseout 触发会立即关闭 → 用户看不到预览。
    // 150ms 延迟,期间若 hover 进入新 marker 会被 handleHover 覆盖,期间若进入 InfoWindow 自身则用户已在看。
    // 防快速滑动累积:每次 mouseout 先清除上一个未执行定时器
    if (this.hoverEndTimer !== null) {
      clearTimeout(this.hoverEndTimer);
    }
    this.hoverIndex = null;
    this.hoverEndTimer = setTimeout(() => {
      this.hoverEndTimer = null;
      if (this.hoverIndex !== null) {
        // 仍有活跃 hover(mouseover 在 mouseout 后又触发了) → 不关闭
        return;
      }
      this.hoverInfoWindow.close();
    }, 150);
  }

  /** 容器尺寸变化后通知 AMap 重新测量(运行时方法,类型未声明) */
  resize(): void {
    (this.map as unknown as { resize: () => void }).resize();
  }

  /** 地图视角移动到指定坐标并缩放 */
  setZoomAndCenter(zoom: number, center: [number, number]): void {
    this.map.setZoomAndCenter(zoom, center);
  }

  /**
   * 当前位置 [lng,lat](GCJ-02)。
   *
   * 链路:AMap.Geolocation → 失败时 CitySearch IP 城市级兜底 → 抛错。
   * 高德插件直出 GCJ-02,无需手动坐标转换。
   */
  getCurrentPosition(): Promise<[number, number]> {
    return new Promise<[number, number]>((resolve, reject) => {
      this.geolocation.getCurrentPosition(
        (status: string, result: GeolocationResult) => {
          if (status === 'complete' && result.position) {
            resolve([result.position.lng, result.position.lat]);
          } else {
            // 高德定位失败,降级到 IP 城市级定位
            this.locateByIp().then(resolve, reject);
          }
        },
      );
    });
  }

  /** 在用户位置打一个 marker;后续点击先清旧的 */
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

  /** 释放资源(组件卸载时调用) */
  dispose(): void {
    this.clearMarkers();
    this.hoverInfoWindow?.close();
    this.userLocationMarker = null;
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
        // 矩形中心(精度到城市级,够钓鱼指数计算)
        resolve([(lng1 + lng2) / 2, (lat1 + lat2) / 2]);
      });
    });
  }
}
