/**
 * 钓鱼地图摘要 seam —— 供 entry 仪表盘 BentoMap 卡片消费。
 *
 * 封装：
 * - 一次性并行拉取天气/钓鱼指数 + 钓点列表 + 统计（Promise.allSettled）
 * - 潮汐状态推导（涨潮中/退潮中/未知潮汐）
 * - 最近记录时间 formatRelative
 *
 * 模板只消费字符串 / 数字，不再碰 gateway / store / derive 逻辑。
 */
import { fishingGateway, fishingSpotsGateway } from '@/features/fishing/api';
import {
  DEFAULT_MAP_CENTER,
  useFishingMapStore,
} from '@/features/fishing/stores/fishingMap';
import type { TideData } from '@readinglist/types';
import { formatRelative } from '@/lib/dayjs';
import dayjs from 'dayjs';
import { computed, ref, type Ref } from 'vue';

export interface UseFishingMapSummaryReturn {
  spotCount: Ref<number>;
  totalRecords: Ref<number>;
  lastRecordText: Ref<string>;
  weatherText: Ref<string>;
  tideStatus: Ref<string>;
  refresh: () => Promise<void>;
}

function deriveTideStatus(tideData: TideData | null): string {
  if (!tideData?.tideTable?.length) return '未知潮汐';

  const now = dayjs();
  const table = tideData.tideTable;

  for (let i = 0; i < table.length; i++) {
    const tideTime = dayjs(table[i].fxTime);
    if (tideTime.isAfter(now)) {
      return table[i].type === 'H' ? '退潮中' : '涨潮中';
    }
  }

  return '未知潮汐';
}

export function useFishingMapSummary(): UseFishingMapSummaryReturn {
  const store = useFishingMapStore();

  const spotCount = ref(0);
  const totalRecords = ref(0);
  const lastRecordText = ref('--');
  const weatherText = ref('');

  const tideStatus = computed(() => deriveTideStatus(store.tideData));

  async function refresh(): Promise<void> {
    const [, statsRes, spotsRes] = await Promise.allSettled([
      store.fetchWeatherAndFishing(DEFAULT_MAP_CENTER),
      fishingGateway.getFishingStats(),
      fishingSpotsGateway.list(),
    ]);

    if (statsRes.status === 'fulfilled') {
      totalRecords.value = statsRes.value.total_records;
      if (statsRes.value.latest_record_time) {
        lastRecordText.value = formatRelative(
          statsRes.value.latest_record_time,
        );
      }
    }

    if (spotsRes.status === 'fulfilled') {
      spotCount.value = spotsRes.value.length;
    }

    weatherText.value = store.liveWeather?.text || '';
  }

  return {
    spotCount,
    totalRecords,
    lastRecordText,
    weatherText,
    tideStatus,
    refresh,
  };
}
