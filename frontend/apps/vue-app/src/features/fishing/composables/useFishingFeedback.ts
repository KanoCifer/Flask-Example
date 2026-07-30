/**
 * 钓点反馈表单数据拼装
 *
 * 职责：
 * - 从 store 取实时天气 / 潮汐数据 → 拼成 FishingFeedbackData
 * - 维护 modal 开关 + 选中的钓点 id/name
 *
 * 派生逻辑（风级 / 潮位 / 距下一潮）已抽到 `@/features/fishing/lib/tideDerivation`，
 * 本文件只负责「取 store 值 → 调 seam → 装入 feedback payload」。
 */
import { useFishingMapStore } from '@/features/fishing/stores/fishingMap';
import {
  deriveTideMeta,
  deriveWindLevel,
} from '@/features/fishing/lib/tideDerivation';
import type { FishingFeedbackData, FishingIndexData } from '@readinglist/types';
import { storeToRefs } from 'pinia';
import { ref } from 'vue';

export function useFishingFeedback() {
  const fishingMapStore = useFishingMapStore();
  const {
    liveWeather,
    tideData,
    locationName: storeLocationName,
  } = storeToRefs(fishingMapStore);

  const open = ref(false);
  const locationId = ref('default');
  const locationName = ref('钓鱼地点');
  const currentFishingData = ref<FishingFeedbackData | null>(null);

  function openFeedback(
    data: FishingIndexData,
    spotIndex: number | null,
  ): void {
    const tideMeta = deriveTideMeta(tideData.value);

    currentFishingData.value = {
      fishing_index: data.fishing_index,
      level: data.level,
      temperature: Number(liveWeather.value?.temp ?? 20),
      humidity: Number(liveWeather.value?.humidity ?? 50),
      pressure: Number(liveWeather.value?.pressure) || 1013,
      wind_speed: Number(liveWeather.value?.windSpeed) || 0,
      precipitation: Number(liveWeather.value?.precip) || 0,
      indices: deriveWindLevel(liveWeather.value?.windScale),
      tide_level: tideMeta.level,
      tide_type: tideMeta.type,
      tide_range: tideMeta.range,
      hours_to_next_tide: tideMeta.hoursToNext,
    };

    locationId.value = spotIndex !== null ? String(spotIndex) : 'default';
    locationName.value = storeLocationName.value || '钓鱼地点';
    open.value = true;
  }

  function closeFeedback(): void {
    open.value = false;
  }

  return {
    open,
    locationId,
    locationName,
    currentFishingData,
    openFeedback,
    closeFeedback,
  };
}
