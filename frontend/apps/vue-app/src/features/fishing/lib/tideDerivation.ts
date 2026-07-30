/**
 * tideDerivation —— 潮汐 / 风力 / 数据可用性的纯推导 seam。
 *
 * 职责:
 * - 把原本各自复制在 useFishingFeedback / useFishingMapSummary / useFishingAnalysis
 *   里的 derive 逻辑收敛成一组可独立测试的纯函数
 * - 让 fallback 常量(潮位 / 潮差 / 距下一潮小时数)有单一真源 TIDE_META_FALLBACK,
 *   避免三处 magic number 各自漂移
 *
 * 为什么独立:
 * - 这些推导此前只能通过挂载 composable + mock store 才能测,断言成本高
 * - 抽出后调用点只剩「取 store 值 → 传入纯函数」,测试直接喂裸对象即可
 *
 * 约束:
 * - 纯函数 —— 无副作用、不读写 store、不调用任何 `useXxx()`
 * - 不引入新依赖(dayjs 为既有依赖)
 */
import type { TideData, WeatherDay, WeatherNow } from '@readinglist/types';
import dayjs from 'dayjs';

/** 默认 fallback —— 与旧 useFishingFeedback 内联的 FALLBACK 数值一致,单一真源 */
export const TIDE_META_FALLBACK = {
  level: 1.5,
  range: 1.5,
  hoursToNext: 3.0,
  type: undefined as '涨潮' | '退潮' | undefined,
} as const;

export interface TideMeta {
  /** 当前潮位(米);无表时取 fallback */
  level: number;
  /** 潮汐方向 —— 首条为高潮(H)则当前正在退潮,反之涨潮;无表时 undefined */
  type?: '涨潮' | '退潮';
  /** 与下一潮的潮位差(米,绝对值);缺下一条时取 fallback */
  range: number;
  /** 距下一潮的小时数;缺下一条或时间不可解析时取 fallback */
  hoursToNext: number;
}

/** 风力等级（1-3）：风速 km/h 除以 3 向上取整再夹到 [1, 3] */
export function deriveWindLevel(
  windScale: string | number | undefined,
): number {
  const scale = Number(windScale) || 1;
  return Math.min(3, Math.max(1, Math.ceil(scale / 3)));
}

/** 从潮汐表推算下一潮差 / 距下一潮小时数 */
export function deriveTideMeta(tideData: TideData | null): TideMeta {
  const table = tideData?.tideTable;
  if (!table || table.length === 0) return { ...TIDE_META_FALLBACK };

  const current = table[0];
  const next = table[1];
  const level = Number(current.height ?? TIDE_META_FALLBACK.level);
  const type = current.type === 'H' ? '退潮' : '涨潮';

  // 只有一条记录时无法算潮差 / 间隔,退回 fallback,但潮位与方向仍然可信
  if (!next) {
    return {
      level,
      type,
      range: TIDE_META_FALLBACK.range,
      hoursToNext: TIDE_META_FALLBACK.hoursToNext,
    };
  }

  const nextLevel = Number(next.height ?? TIDE_META_FALLBACK.level);
  const currentTime = new Date(current.fxTime).getTime();
  const nextTime = new Date(next.fxTime).getTime();
  const hoursToNext =
    Number.isFinite(currentTime) && Number.isFinite(nextTime)
      ? (nextTime - currentTime) / (1000 * 60 * 60)
      : TIDE_META_FALLBACK.hoursToNext;

  return {
    level,
    type,
    range: Math.abs(nextLevel - level),
    hoursToNext,
  };
}

export type TideStatus = '涨潮中' | '退潮中' | '未知潮汐';

/**
 * 根据当前时刻与潮汐表首条 future 项判定潮汐状态。
 *
 * 现在 = now 之后的第一条即「下一潮」;
 * 该条 type === 'H' 说明正朝高潮走 —— 与既有 useFishingMapSummary 语义一致,
 * 视为「退潮中」,否则视为「涨潮中」。
 * 表为空 / 所有条目都已过期 → '未知潮汐'。
 *
 * @param now 注入当前时刻,便于测试固定时间;默认取 dayjs()
 */
export function deriveTideStatus(
  tideData: TideData | null,
  now: dayjs.Dayjs = dayjs(),
): TideStatus {
  if (!tideData?.tideTable?.length) return '未知潮汐';

  const table = tideData.tideTable;
  for (let i = 0; i < table.length; i++) {
    const tideTime = dayjs(table[i].fxTime);
    if (tideTime.isAfter(now)) {
      return table[i].type === 'H' ? '退潮中' : '涨潮中';
    }
  }

  return '未知潮汐';
}

/**
 * 判定 store 中是否有「值得分析」的数据：
 * 实时天气非空、预报非空数组、或潮汐非空。任一为真即可。
 * 与 useFishingAnalysis 的 hasData 当前语义对齐。
 */
export function hasMeaningfulWeather(input: {
  liveWeather: WeatherNow | null;
  forecasts: WeatherDay[];
  tideData: TideData | null;
}): boolean {
  return (
    input.liveWeather !== null ||
    input.forecasts.length > 0 ||
    input.tideData !== null
  );
}
