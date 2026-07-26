/**
 * 钓点反馈表单数据拼装。
 *
 * 职责：
 * - 从 store 取实时天气 / 潮汐数据 → 拼成 FishingFeedbackData
 * - 维护 modal 开关 + 选中的钓点 id / name
 *
 * 把「哪些字段从 liveWeather 取、哪些从 tideTable 推、默认值是什么」集中到这里，
 * 避免污染 view 组件。FishingFeedbackForm 只负责 UI 与提交，不做派生。
 */
import { useCallback, useState } from 'react';

import { useFishingMapStore } from '@/features/fishing/stores/fishingMapStore';

import type { FishingFeedbackData, FishingIndexData, TideData } from '../types';

/** 风力等级（1-3）：风速 km/h 除以 3 向上取整再夹到 [1, 3] */
export function deriveWindLevel(
  windScale: string | number | undefined,
): number {
  const scale = Number(windScale) || 1;
  return Math.min(3, Math.max(1, Math.ceil(scale / 3)));
}

/** 从潮汐表推算当前潮位 / 涨退 / 潮差 / 距下一潮小时数 */
export function deriveTideMeta(tideData: TideData | null): {
  level: number;
  type?: '涨潮' | '退潮';
  range: number;
  hoursToNext: number;
} {
  const fallback = {
    level: 1.5,
    type: undefined as '涨潮' | '退潮' | undefined,
    range: 1.5,
    hoursToNext: 3.0,
  };
  const table = tideData?.tideTable;
  if (!table || table.length === 0) return fallback;

  const current = table[0];
  const next = table[1];
  const level = Number(current.height ?? fallback.level);
  // 表格中 H=高潮(过后转退潮) L=低潮(过后转涨潮)
  const type: '涨潮' | '退潮' | undefined =
    current.type === 'H' ? '退潮' : '涨潮';

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

export interface UseFishingFeedbackResult {
  open: boolean;
  locationId: string;
  locationName: string;
  currentFishingData: FishingFeedbackData | null;
  openFeedback: (data: FishingIndexData, spotIndex: number | null) => void;
  closeFeedback: () => void;
}

export function useFishingFeedback(): UseFishingFeedbackResult {
  const liveWeather = useFishingMapStore((s) => s.liveWeather);
  const tideData = useFishingMapStore((s) => s.tideData);
  const storeLocationName = useFishingMapStore((s) => s.locationName);

  const [open, setOpen] = useState(false);
  const [locationId, setLocationId] = useState('default');
  const [locationName, setLocationName] = useState('钓鱼地点');
  const [currentFishingData, setCurrentFishingData] =
    useState<FishingFeedbackData | null>(null);

  const openFeedback = useCallback(
    (data: FishingIndexData, spotIndex: number | null) => {
      const tideMeta = deriveTideMeta(tideData);

      setCurrentFishingData({
        fishing_index: data.fishing_index,
        level: data.level,
        temperature: Number(liveWeather?.temp ?? 20),
        humidity: Number(liveWeather?.humidity ?? 50),
        pressure: Number(liveWeather?.pressure) || 1013,
        wind_speed: Number(liveWeather?.windSpeed) || 0,
        precipitation: Number(liveWeather?.precip) || 0,
        indices: deriveWindLevel(liveWeather?.windScale),
        tide_level: tideMeta.level,
        tide_type: tideMeta.type,
        tide_range: tideMeta.range,
        hours_to_next_tide: tideMeta.hoursToNext,
      });

      setLocationId(spotIndex !== null ? String(spotIndex) : 'default');
      setLocationName(storeLocationName || '钓鱼地点');
      setOpen(true);
    },
    [liveWeather, tideData, storeLocationName],
  );

  const closeFeedback = useCallback(() => setOpen(false), []);

  return {
    open,
    locationId,
    locationName,
    currentFishingData,
    openFeedback,
    closeFeedback,
  };
}
