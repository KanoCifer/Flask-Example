/**
 * useGeolocation —— 用户定位 hook（框架无关核心,AMap.Geolocation + CitySearch IP 兜底）。
 *
 * 职责:
 * - 封装 AMap.Geolocation（街道级,GCJ-02 直出）
 * - 失败时降级到 CitySearch IP 城市级定位
 * - 暴露 userPosition / isLocating / retry / error
 * - 都失败时经 onError 回调通知上层 Toast
 *
 * 抽出原因:原本定位逻辑埋在 useMap（地图渲染 hook）里,渲染与数据获取耦死。
 * 提到独立 hook 后:useMap 只负责地图渲染,定位由本 hook 独立管理 —— 一个关注点、一个模块。
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import type { GeolocationStatusEvent } from '../types';

/** 城市级 IP 定位服务（AMap.CitySearch 插件） */
interface CitySearchService {
  getLocalCity(
    callback: (status: 'complete' | string, result: unknown) => void,
  ): void;
}

/** 高德定位服务 */
interface GeolocationService {
  getCurrentPosition(
    callback: (
      status: 'complete' | string,
      result: GeolocationStatusEvent,
    ) => void,
  ): void;
}

/** 扩展 AMap 命名空间,加入 Geolocation + CitySearch 插件 ctor */
interface AMapWithGeolocation {
  Geolocation: new (options?: {
    enableHighAccuracy?: boolean;
    timeout?: number;
    offset?: [number, number];
    position?: string;
    panToLocation?: boolean;
  }) => GeolocationService;
  CitySearch: new () => CitySearchService;
}

/** 获取 AMap 命名空间的访问器（由 useMap 注入） */
type GetAMap = () => AMapWithGeolocation | undefined;

interface UseGeolocationResult {
  /** 用户当前位置 [lng, lat]（GCJ-02），未定位时为 null */
  userPosition: [number, number] | null;
  /** 是否正在定位 */
  isLocating: boolean;
  /** 定位失败错误信息，无错误为 null */
  error: string | null;
  /** 重试定位 */
  retry: () => void;
}

/**
 * 用户定位 hook。
 *
 * @param getAMap  - 返回已加载的 AMap 命名空间（由 useMap 注入）
 * @param onError  - 定位完全失败时的回调（上层用于 Toast 通知）
 * @param options  - 配置项
 * @param options.enabled - 是否启用自动定位（默认 true）
 */
export function useGeolocation(
  getAMap: GetAMap,
  onError?: (message: string) => void,
  options: { enabled?: boolean } = {},
): UseGeolocationResult {
  const { enabled = true } = options;

  const userPositionRef = useRef<[number, number] | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const onErrorRef = useRef(onError);
  const getAMapRef = useRef(getAMap);
  // StrictMode 守卫:同一实例双重调用 effect 时保持,避免重复自动定位
  const autoLocatedRef = useRef(false);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    getAMapRef.current = getAMap;
  }, [getAMap]);

  /**
   * IP 城市级兜底定位：成功返回城市矩形中心 [lng, lat]，失败抛带可读信息的 Error。
   */
  const locateByIp = useCallback((): Promise<[number, number]> => {
    const AMap = getAMapRef.current();
    if (!AMap) {
      return Promise.reject(new Error('AMap 未初始化'));
    }

    return new Promise<[number, number]>((resolve, reject) => {
      const citySearch = new AMap.CitySearch();
      citySearch.getLocalCity((status, result) => {
        const r = result as { rectangle?: string; info?: string } | null;
        if (status !== 'complete') {
          reject(new Error(r?.info || 'IP 定位失败'));
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
        // 矩形中心（精度到城市级）
        resolve([(lng1 + lng2) / 2, (lat1 + lat2) / 2]);
      });
    });
  }, []);

  /**
   * 定位主流程：AMap.Geolocation → 失败时 CitySearch IP 兜底 → 抛错。
   */
  const locate = useCallback(async (): Promise<void> => {
    const AMap = getAMapRef.current();
    if (!AMap) {
      setError('AMap 未初始化');
      return;
    }

    setIsLocating(true);
    setError(null);

    try {
      const position = await new Promise<[number, number]>(
        (resolve, reject) => {
          const geolocation = new AMap.Geolocation({
            enableHighAccuracy: true,
            timeout: 10000,
            offset: [10, 20],
            position: 'RT',
            // 禁止定位成功后自动移图 —— 避免 marker 点击时把地图中心拉回用户位置
            panToLocation: false,
          });

          geolocation.getCurrentPosition((status, result) => {
            if (status === 'complete' && result.position) {
              resolve([result.position.lng, result.position.lat]);
            } else {
              // 高德定位失败，降级到 IP 城市级定位
              void locateByIp().then(resolve, reject);
            }
          });
        },
      );

      if (!mountedRef.current) return;
      userPositionRef.current = position;
      setIsLocating(false);
    } catch (err) {
      if (!mountedRef.current) return;
      const message =
        err instanceof Error ? err.message : '定位失败，请检查网络或定位权限';
      setError(message);
      setIsLocating(false);
      onErrorRef.current?.(message);
    }
  }, [locateByIp]);

  // 自动定位（挂载时一次;StrictMode 下不重复）
  useEffect(() => {
    mountedRef.current = true;
    if (enabled && !autoLocatedRef.current) {
      autoLocatedRef.current = true;
      void locate();
    }
    return () => {
      mountedRef.current = false;
    };
  }, [enabled, locate]);

  const retry = useCallback(() => {
    void locate();
  }, [locate]);

  return {
    userPosition: userPositionRef.current,
    isLocating,
    error,
    retry,
  };
}
