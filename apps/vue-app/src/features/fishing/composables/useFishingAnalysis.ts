/**
 * AI 天气分析面板的状态聚合
 *
 * 职责:
 * - 维护 drawer 开关
 * - 从 store 拼装 WeatherAnalysis 所需的 payload (live/forecasts/tide/index/location)
 * - 判定是否有可分析的数据 (用于 header 按钮上的小红点)
 *
 * 抽出原因: 原本散落在 view 顶层, view 里业务状态太多。
 */
import { useFishingMapStore } from '@/features/fishing/stores/fishingMap';
import { useTidePanelStore } from '@/features/fishing/stores/tidePanel';
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';

export function useFishingAnalysis() {
  const fishingMapStore = useFishingMapStore();
  const tidePanelStore = useTidePanelStore();
  const {
    liveWeather,
    forecasts,
    tideData,
    weatherIndices,
    locationName,
    indexData,
  } = storeToRefs(fishingMapStore);
  const { panelTideSpotName } = storeToRefs(tidePanelStore);

  const open = ref(false);

  const payload = computed(() => {
    if (!liveWeather.value && forecasts.value.length === 0 && !tideData.value) {
      return null;
    }
    return {
      liveWeather: liveWeather.value,
      forecasts: forecasts.value,
      tideData: tideData.value,
      weatherIndices: weatherIndices.value,
      fishingIndex: indexData.value ?? undefined,
      locationName: locationName.value,
      tideSpotName: panelTideSpotName.value,
    };
  });

  const hasData = computed(
    () =>
      liveWeather.value !== null ||
      forecasts.value.length > 0 ||
      tideData.value !== null,
  );

  function toggle() {
    open.value = !open.value;
  }

  function close() {
    open.value = false;
  }

  return { open, payload, hasData, toggle, close };
}
