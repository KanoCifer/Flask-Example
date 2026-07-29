import { fishingGateway } from '@readinglist/api';
import { useNotificationStore } from '@/stores';
import { useSequencedTask } from '@/composables';
import type {
  FishingIndexData,
  TideData,
  WeatherDay,
  WeatherHourly,
  WeatherIndex,
  WeatherNow,
} from '@readinglist/types';
import { defineStore } from 'pinia';
import { ref } from 'vue';

export const DEFAULT_MAP_CENTER: [number, number] = [113.389549, 23.050067];

/**
 * 钓鱼仪表盘的主数据流：位置 → 拉一次 weather/full + fishing/index → 渲染各 tile。
 *
 * TidePanel（手动选 harbor/date）有独立的状态机，搬到 stores/tidePanel.ts。
 */
export const useFishingMapStore = defineStore('fishingMap', () => {
  const notifier = useNotificationStore();

  // 「最新调用胜出」竞态守卫：旧 fetch 的回写被吞掉
  const fetchSeq = useSequencedTask();

  const liveWeather = ref<WeatherNow | null>(null);
  const forecasts = ref<WeatherDay[]>([]);
  const weatherHourly = ref<WeatherHourly[]>([]);
  const locationName = ref('');
  const weatherIndices = ref<WeatherIndex[]>([]);
  const tideData = ref<TideData | null>(null);

  const weatherLoading = ref(false);
  const weatherError = ref('');

  const indexData = ref<FishingIndexData | null>(null);
  const indexLoading = ref(false);
  const indexError = ref('');

  /**
   * 拉钓鱼指数（enriched=true 附带天气数据）。
   *
   * 旧实现并发调 weather/full + fishing/index，导致 Go 端同一 location 被请求
   * 两次（fishing/index 内部又会调一次 Go weather/full）。改为只调 fishing/index
   * enriched=true，从响应中取天气数据，省掉一次 Go 请求。
   *
   * 注意：enriched 响应不含 indices，所以 weatherIndices 保持空数组（UI 已有空态兜底）。
   */
  async function fetchWeatherAndFishing(
    location: [number, number],
  ): Promise<void> {
    const mine = fetchSeq.begin();
    weatherLoading.value = true;
    indexLoading.value = true;
    weatherError.value = '';
    indexError.value = '';

    try {
      const fishingIndex = await fishingGateway.getFishingIndex({
        location,
        enriched: true,
      });

      if (!fetchSeq.isActive(mine)) return;

      const now = fishingIndex.current_weather ?? null;
      const daily = fishingIndex.forecasts ?? [];
      const nameFromEnriched = fishingIndex.location_name?.trim();

      const hourlyWrapper = fishingIndex.hourly_weather as
        | { hourly?: WeatherHourly[] }
        | undefined;

      liveWeather.value = now;
      forecasts.value = daily;
      weatherHourly.value = hourlyWrapper?.hourly ?? [];
      locationName.value = nameFromEnriched || (now?.text ? '当前位置' : '钓鱼地点');
      weatherIndices.value = [];
      tideData.value = fishingIndex.tide_data ?? null;
      indexData.value = fishingIndex;
    } catch (err) {
      if (!fetchSeq.isActive(mine)) return;
      const message =
        err instanceof Error ? err.message : '获取钓鱼地图数据失败';
      weatherError.value = message;
      indexError.value = message;
      notifier.error(message);
    } finally {
      if (fetchSeq.isActive(mine)) {
        weatherLoading.value = false;
        indexLoading.value = false;
      }
    }
  }

  return {
    liveWeather,
    forecasts,
    weatherHourly,
    locationName,
    weatherIndices,
    tideData,
    weatherLoading,
    weatherError,
    indexData,
    indexLoading,
    indexError,
    fetchWeatherAndFishing,
  };
});
