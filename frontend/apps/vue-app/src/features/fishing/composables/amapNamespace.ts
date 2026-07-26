/**
 * AMap namespace 单例加载器。
 *
 * 为什么 hoist:
 * - 全项目目前仅 MapContainer 一个 AMap 消费者,namespace 每次 mount 都重新拉一次
 *   fetchSecurityKey + AMapLoader.load,后者虽然对 namespace 幂等,但 plugin 数组合并
 *   仍会触发额外的网络请求
 * - 提到 module 后,整个 app 生命周期只 fetch / load 一次,MapContainer 退化为"消费
 *   namespace + 建 map 实例 + 卸载时 destroy"
 * - map 实例本身不能 hoist(1:1 绑 DOM container,AMap API 不支持换皮),仍由组件持有
 *
 * 安全密钥:fetchSecurityKey() 也在此处一次性调用并设到 window._AMapSecurityConfig。
 * 当前高德安全模型下密钥不严格时变,接受 session-scoped;如未来要轮换,改为
 * 暴露 refreshSecurityKey() 即可。
 *
 * 拥有 AMapWithPlugins 类型 (谁拥有 SDK namespace 谁导出,消费方 fishingMapRuntime
 * 不再自己拼)。
 */
import { mapGateway } from '@/features/fishing/api';
import AMapLoader from '@amap/amap-jsapi-loader';

// ---- AMap 安全密钥全局声明 ----
declare global {
  interface Window {
    _AMapSecurityConfig: { securityJsCode: string };
  }
}

// ---- AMap 插件类型 (官方 @types/amap-js-api 只覆盖核心) ----

interface DrivingService {
  search(
    origin: [number, number] | AMap.LngLat,
    destination: [number, number] | AMap.LngLat,
    callback: (
      status: 'complete' | 'no_data' | string,
      result: unknown,
    ) => void,
  ): void;
  clear(): void;
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
      result: { position: { lng: number; lat: number }; info?: string },
    ) => void,
  ): void;
}

export type AMapWithPlugins = typeof AMap & {
  CitySearch: new () => CitySearchService;
  Geolocation: new (options?: {
    enableHighAccuracy?: boolean;
    timeout?: number;
    offset?: [number, number];
    position?: string;
    panToLocation?: boolean;
  }) => GeolocationService;
  Driving: new (options?: {
    map?: AMap.Map;
    policy?: number;
    showTraffic?: boolean;
  }) => DrivingService;
  ToolBar: new (opts?: { position?: string }) => object;
  Scale: new () => object;
};

let nsPromise: Promise<AMapWithPlugins> | null = null;

export function loadAMapNamespace(): Promise<AMapWithPlugins> {
  if (nsPromise) return nsPromise;

  nsPromise = (async () => {
    const res = await mapGateway.getSecurityKey();
    const encoded = res.securityJsCode || '';
    let securityCode = encoded;
    if (encoded) {
      try {
        securityCode = atob(encoded);
      } catch {
        // 非 base64,直接用原值
      }
    }
    if (!securityCode) {
      securityCode = import.meta.env.VITE_AMAP_SECURITY_CODE || '';
    }
    window._AMapSecurityConfig = { securityJsCode: securityCode };

    const loaded = await AMapLoader.load({
      key: import.meta.env.VITE_JS_API,
      version: '2.0',
      plugins: [
        'AMap.Scale',
        'AMap.ToolBar',
        'AMap.Geolocation',
        'AMap.CitySearch',
        'AMap.Driving',
      ],
    });
    return loaded as AMapWithPlugins;
  })();

  return nsPromise;
}
