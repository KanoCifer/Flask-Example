/**
 * 钓点反馈表单数据拼装
 *
 * 职责：
 * - 从 store 取实时天气 / 潮汐数据 → 拼成 FishingFeedbackData
 * - 维护 modal 开关 + 选中的钓点 id/name
 *
 * 把「哪些字段从 liveWeather 取、哪些从 tideTable 推、默认值是什么」集中到这里，
 * 避免污染 view 组件。
 */
import { useFishingMapStore } from '@/features/fishing/stores/fishingMap';
import type {
  FishingFeedbackData,
  FishingIndexData,
} from '@/features/fishing/types';
import type { TideData } from '@/features/fishing/types';
import { storeToRefs } from 'pinia';
import { ref } from 'vue';

/** 风力等级（1-3）：风速 km/h 除以 3 向上取整再夹到 [1, 3] */
function deriveWindLevel(windScale: string | number | undefined): number {
  const scale = Number(windScale) || 1;
  return Math.min(3, Math.max(1, Math.ceil(scale / 3)));
}

/** 从潮汐表推算下一潮差 / 距下一潮小时数 */
function deriveTideMeta(tideData: TideData | null): {
  level: number;
  type?: '涨潮' | '退潮';
  range: number;
  hoursToNext: number;
} {
  const fallback = {
    level: 1.5,
    type: undefined,
    range: 1.5,
    hoursToNext: 3.0,
  };
  const table = tideData?.tideTable;
  if (!table || table.length === 0) return fallback;

  const current = table[0];
  const next = table[1];
  const level = Number(current.height ?? fallback.level);
  const type = current.type === 'H' ? '退潮' : '涨潮';

  if (!next) {
    return {
      level,
      type,
      range: fallback.range,
      hoursToNext: fallback.hoursToNext,
    };
  }

  const nextLevel = Number(next.height ?? fallback.level);
  const currentTime = new Date(current.fxTime).getTime();
  const nextTime = new Date(next.fxTime).getTime();
  const hoursToNext =
    Number.isFinite(currentTime) && Number.isFinite(nextTime)
      ? (nextTime - currentTime) / (1000 * 60 * 60)
      : fallback.hoursToNext;

  return {
    level,
    type,
    range: Math.abs(nextLevel - level),
    hoursToNext,
  };
}

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
