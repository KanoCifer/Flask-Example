import { create } from 'zustand';

import { useNotificationStore } from '@/stores/notificationState';

import type { RouteInfo } from '@/features/fishing/types';

export interface RouteMapState {
  userPosition: [number, number] | null;
  routeInfo: RouteInfo | null;
  selectedSpotIndex: number | null;
  isPlanningRoute: boolean;
  /**
   * 路线规划串行化守卫：每次 planRouteAction 递增。
   * 旧的 await 在 finally/错误分支比对 routeSeq 后被吞掉 —— 防止用户
   * 连续点击两个 marker 时，前一个请求的延迟结果污染当前选中的钓点。
   */
  routeSeq: number;
  setUserPosition: (pos: [number, number] | null) => void;
  setRouteInfo: (info: RouteInfo | null) => void;
  setSelectedSpotIndex: (idx: number | null) => void;
  setIsPlanningRoute: (loading: boolean) => void;
  /**
   * 串行化的路线规划入口。调用方传入 marker index 与实际 planRoute 执行体。
   * 旧的请求在 await 之后会比对自身 seq 与 store 中的 routeSeq，
   * 不一致则视为过期并放弃写入。
   */
  planRouteAction: <T extends RouteInfo>(params: {
    spotIndex: number;
    runner: (seq: number) => Promise<T>;
    fallbackError: string;
  }) => Promise<T | null>;
  clearRoute: () => void;
}

export const useRouteMapStore = create<RouteMapState>((set, get) => ({
  userPosition: null,
  routeInfo: null,
  selectedSpotIndex: null,
  isPlanningRoute: false,
  routeSeq: 0,

  setUserPosition: (pos) => set({ userPosition: pos }),
  setRouteInfo: (info) => set({ routeInfo: info }),
  setSelectedSpotIndex: (idx) => set({ selectedSpotIndex: idx }),
  setIsPlanningRoute: (loading) => set({ isPlanningRoute: loading }),

  planRouteAction: async ({ spotIndex, runner, fallbackError }) => {
    const mySeq = get().routeSeq + 1;
    set({
      routeSeq: mySeq,
      selectedSpotIndex: spotIndex,
      isPlanningRoute: true,
      routeInfo: null,
    });

    try {
      const result = await runner(mySeq);
      if (mySeq !== get().routeSeq) return null;
      set({ routeInfo: result });
      return result;
    } catch (err) {
      if (mySeq !== get().routeSeq) return null;
      const message = err instanceof Error ? err.message : fallbackError;
      useNotificationStore.getState().error(message);
      set({ selectedSpotIndex: null });
      return null;
    } finally {
      if (mySeq === get().routeSeq) {
        set({ isPlanningRoute: false });
      }
    }
  },

  clearRoute: () =>
    set({
      routeInfo: null,
      selectedSpotIndex: null,
      routeSeq: get().routeSeq + 1, // 中断进行中的规划
    }),
}));
