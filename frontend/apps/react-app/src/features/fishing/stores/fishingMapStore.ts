import { create } from 'zustand';

import dayjs from 'dayjs';

import { useNotificationStore } from '@/stores/notificationState';
import type { MapMarker } from '@readinglist/types';

import {
  fishingMapService,
  fishingSpotsGateway,
  toMapMarkers,
  type FishingIndexData,
  type TideData,
  type WeatherDay,
  type WeatherHourly,
  type WeatherIndex,
  type WeatherNow,
} from '@/features/fishing';

export const HARBOR_OPTIONS = [
  { code: 'P2352', name: '黄埔港' },
  { code: 'P2932', name: '舢舨洲' },
  { code: 'P2299', name: '南沙港' },
  { code: 'P2474', name: '海沁' },
  { code: 'P2609', name: '东沙' },
] as const;

export interface FishingMapState {
  // weather
  liveWeather: WeatherNow | null;
  forecasts: WeatherDay[];
  locationName: string;
  weatherLoading: boolean;
  weatherError: string;
  weatherIndices: WeatherIndex[];

  // 小时天气预报
  weatherHourly: WeatherHourly[];

  // tide (from weather full)
  tideData: TideData | null;

  // panel tide (selectable harbor / date)
  panelTideData: TideData | null;
  panelTideSpotName: string;
  tideLoading: boolean;
  selectedHarbor: string;
  selectedDate: string;

  // fishing index
  indexData: FishingIndexData | null;
  indexLoading: boolean;
  indexError: string;

  // 钓点标记（后端获取，对齐 frontend fishingSpotsGateway.list）
  markers: MapMarker[];
  spotsLoading: boolean;
  spotsError: string;

  fetchWeatherAndFishing: (location: [number, number]) => Promise<void>;
  fetchPanelTide: (harbor?: string, date?: string) => Promise<void>;
  setSelectedHarbor: (harbor: string) => void;
  setSelectedDate: (date: string) => void;
  fetchSpots: () => Promise<void>;
  setMarkers: (
    updater: MapMarker[] | ((prev: MapMarker[]) => MapMarker[]),
  ) => void;
}

const notifyError = (msg: string) => {
  useNotificationStore.getState().error(msg);
};

// 创建 store
export const useFishingMapStore = create<FishingMapState>((set, get) => ({
  // 初始状态
  liveWeather: null,
  forecasts: [],
  locationName: '',
  weatherLoading: false,
  weatherError: '',
  indexData: null,
  indexLoading: false,
  indexError: '',
  weatherIndices: [],
  tideData: null,

  // 小时天气预报初始状态
  weatherHourly: [],

  // panel tide 初始状态
  panelTideData: null,
  panelTideSpotName: '黄埔港',
  tideLoading: false,
  selectedHarbor: 'P2352',
  selectedDate: dayjs().format('YYYYMMDD'),

  // 钓点标记初始状态
  markers: [],
  spotsLoading: false,
  spotsError: '',

  // actions
  /**
   * 拉钓鱼指数（enriched=true 附带天气数据）。
   *
   * 旧实现并发调 weather/full + fishing/index，导致 Go 端同一 location 被请求
   * 两次（fishing/index 内部又会调一次 Go weather/full）。改为只调 fishing/index
   * enriched=true，从响应中取天气数据，省掉一次 Go 请求。
   *
   * 注意：enriched 响应不含 indices，所以 weatherIndices 保持空数组（UI 已有空态兜底）。
   */
  fetchWeatherAndFishing: async (location: [number, number]) => {
    const service = fishingMapService();
    set({
      weatherLoading: true,
      indexLoading: true,
      weatherError: '',
      indexError: '',
    });
    try {
      const fishingIndex = await service.fetchFishingIndex({
        location,
        enriched: true,
      });

      const now = fishingIndex.current_weather ?? null;
      const daily = fishingIndex.forecasts ?? [];
      const nameFromEnriched = fishingIndex.location_name?.trim();

      set({
        liveWeather: now,
        forecasts: daily,
        weatherHourly: fishingIndex.hourly_weather?.hourly ?? [],
        locationName:
          nameFromEnriched || (now?.text ? '当前位置' : '钓鱼地点'),
        weatherIndices: [],
        tideData: fishingIndex.tide_data ?? null,
        indexData: fishingIndex,
        weatherLoading: false,
        indexLoading: false,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '获取数据失败';
      notifyError(msg);
      set({
        weatherError: msg,
        indexError: msg,
        weatherLoading: false,
        indexLoading: false,
      });
    }
  },

  fetchPanelTide: async (harbor?: string, date?: string) => {
    const { selectedHarbor: currentHarbor, selectedDate: currentDate } = get();
    const harborToUse = harbor ?? currentHarbor;
    const dateToUse = date ?? currentDate;
    set({ tideLoading: true });
    try {
      const service = fishingMapService();
      const res = await service.getTide({
        harbor: harborToUse,
        date: dateToUse,
      });
      const harborOption = HARBOR_OPTIONS.find((o) => o.code === harborToUse);
      set({
        panelTideData: res,
        panelTideSpotName: harborOption?.name ?? '黄埔港',
        tideLoading: false,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '获取潮汐信息失败';
      notifyError(msg);
      set({ tideLoading: false });
    }
  },

  setSelectedHarbor: (harbor: string) => {
    set({ selectedHarbor: harbor });
    void get().fetchPanelTide(harbor, get().selectedDate);
  },

  setSelectedDate: (date: string) => {
    set({ selectedDate: date });
    void get().fetchPanelTide(get().selectedHarbor, date);
  },

  // 钓点标记：从后端获取，对齐 frontend fishingSpotsGateway.list + toMapMarkers
  fetchSpots: async () => {
    set({ spotsLoading: true, spotsError: '' });
    try {
      const spots = await fishingSpotsGateway.list();
      set({ markers: toMapMarkers(spots), spotsLoading: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载钓点失败';
      notifyError(msg);
      set({ spotsError: msg, spotsLoading: false });
    }
  },

  setMarkers: (updater) => {
    set((state) => ({
      markers:
        typeof updater === 'function'
          ? (updater as (prev: MapMarker[]) => MapMarker[])(state.markers)
          : updater,
    }));
  },
}));
