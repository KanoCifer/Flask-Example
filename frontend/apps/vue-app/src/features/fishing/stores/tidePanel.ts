/**
 * 潮汐面板状态。
 *
 * TideCard 的本地状态（手动选择 harbor / date 拉对应潮汐表），
 * 与 dashboard 主数据流（fishingMap store）无耦合。
 *
 * panelTideSpotName 也会被 useFishingAnalysis 透传给 WeatherAnalysis 作展示。
 */
import { weatherGateway } from '@readinglist/api';
import { useNotificationStore } from '@/stores';
import type { TideData } from '@readinglist/types';
import dayjs from 'dayjs';
import { defineStore } from 'pinia';
import { ref } from 'vue';

export const HARBOR_OPTIONS = [
  { code: 'P2352', name: '黄埔港' },
  { code: 'P2932', name: '舢舨洲' },
  { code: 'P2299', name: '南沙港' },
  { code: 'P2474', name: '海沁' },
  { code: 'P2609', name: '东沙' },
] as const;

export const useTidePanelStore = defineStore('tidePanel', () => {
  const notifier = useNotificationStore();

  const panelTideData = ref<TideData | null>(null);
  const panelTideSpotName = ref('黄埔港');
  const tideLoading = ref(false);
  const selectedHarbor = ref('P2352');
  const selectedDate = ref(dayjs().format('YYYYMMDD'));

  async function fetchPanelTide(
    harbor = selectedHarbor.value,
    date = selectedDate.value,
  ): Promise<void> {
    tideLoading.value = true;
    try {
      const res = await weatherGateway.getTide({ harbor, date });
      panelTideData.value = {
        updateTime: res.data.updateTime,
        tideTable: res.data.tideTable,
        tideHourly: res.data.tideHourly,
      };
      panelTideSpotName.value =
        HARBOR_OPTIONS.find((option) => option.code === harbor)?.name ??
        '黄埔港';
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '获取潮汐信息失败，请稍后再试';
      notifier.error(message);
    } finally {
      tideLoading.value = false;
    }
  }

  function setSelectedHarbor(harbor: string): void {
    selectedHarbor.value = harbor;
    void fetchPanelTide(harbor, selectedDate.value);
  }

  function setSelectedDate(date: string): void {
    selectedDate.value = date;
    void fetchPanelTide(selectedHarbor.value, date);
  }

  return {
    panelTideData,
    panelTideSpotName,
    tideLoading,
    selectedHarbor,
    selectedDate,
    fetchPanelTide,
    setSelectedHarbor,
    setSelectedDate,
  };
});
