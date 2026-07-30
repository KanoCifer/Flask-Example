/**
 * tideDerivation 单测 —— 潮汐 / 风力 / 数据可用性纯推导 seam。
 *
 * 覆盖:
 * - deriveWindLevel: 正常分档 / clamp 上限 / undefined 与 0 的 fallback
 * - deriveTideMeta: null / 空表 / 单条 / 两条有效的四种形态
 * - deriveTideStatus: 空数据 / 首条 future 的 H·L 分支 / 全部过期 / 固定 now 可预测
 * - hasMeaningfulWeather: 三个来源的任一为真 + 全空为假
 * - TIDE_META_FALLBACK: fallback 单一真源的默认值
 */
import type { TideData, WeatherDay, WeatherNow } from '@readinglist/types';
import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import {
  deriveTideMeta,
  deriveTideStatus,
  deriveWindLevel,
  hasMeaningfulWeather,
  TIDE_META_FALLBACK,
} from '../tideDerivation';

/** 构造最小可用 TideData —— tideHourly 在推导中未使用,留空即可 */
function makeTideData(tideTable: TideData['tideTable']): TideData {
  return {
    updateTime: '2026-07-30T00:00+08:00',
    tideTable,
    tideHourly: [],
  };
}

describe('deriveWindLevel', () => {
  it('按 km/h ÷ 3 向上取整分档,并夹到 [1, 3]', () => {
    expect(deriveWindLevel(3)).toBe(1);
    expect(deriveWindLevel(5)).toBe(2);
    // 超过 9 的风速统一封顶到 3
    expect(deriveWindLevel(12)).toBe(3);
  });

  it('undefined / 0 等假值回落到 scale = 1 → 等级 1', () => {
    expect(deriveWindLevel(undefined)).toBe(1);
    expect(deriveWindLevel(0)).toBe(1);
    // QWeather 返回字符串数值,应能正常解析
    expect(deriveWindLevel('5')).toBe(2);
  });
});

describe('deriveTideMeta', () => {
  it('tideData 为 null 时整体回落 fallback', () => {
    expect(deriveTideMeta(null)).toEqual({
      level: TIDE_META_FALLBACK.level,
      range: TIDE_META_FALLBACK.range,
      hoursToNext: TIDE_META_FALLBACK.hoursToNext,
      type: undefined,
    });
  });

  it('潮汐表为空数组时同样回落 fallback', () => {
    expect(deriveTideMeta(makeTideData([]))).toEqual({
      level: TIDE_META_FALLBACK.level,
      range: TIDE_META_FALLBACK.range,
      hoursToNext: TIDE_META_FALLBACK.hoursToNext,
      type: undefined,
    });
  });

  it('只有一条记录时保留潮位/方向,潮差与间隔取 fallback', () => {
    const meta = deriveTideMeta(
      makeTideData([
        { fxTime: '2026-07-30T06:00+08:00', height: 2.4, type: 'H' },
      ]),
    );

    expect(meta.level).toBe(2.4);
    // 首条为高潮 → 当前正在退潮
    expect(meta.type).toBe('退潮');
    expect(meta.range).toBe(TIDE_META_FALLBACK.range);
    expect(meta.hoursToNext).toBe(TIDE_META_FALLBACK.hoursToNext);
  });

  it('两条有效记录时完整计算 level / range / hoursToNext', () => {
    const meta = deriveTideMeta(
      makeTideData([
        { fxTime: '2026-07-30T06:00+08:00', height: 1.0, type: 'L' },
        { fxTime: '2026-07-30T12:30+08:00', height: 3.5, type: 'H' },
      ]),
    );

    expect(meta.level).toBe(1.0);
    // 首条为低潮 → 当前正在涨潮
    expect(meta.type).toBe('涨潮');
    expect(meta.range).toBeCloseTo(2.5, 6);
    expect(meta.hoursToNext).toBeCloseTo(6.5, 6);
  });
});

describe('deriveTideStatus', () => {
  const now = dayjs('2026-07-30T08:00+08:00');

  it('tideData 为 null 或潮汐表为空时返回未知潮汐', () => {
    expect(deriveTideStatus(null, now)).toBe('未知潮汐');
    expect(deriveTideStatus(makeTideData([]), now)).toBe('未知潮汐');
  });

  it('now 之后第一条为高潮(H)→ 退潮中', () => {
    const status = deriveTideStatus(
      makeTideData([
        // 已过期,应被跳过
        { fxTime: '2026-07-30T02:00+08:00', height: 1.0, type: 'L' },
        { fxTime: '2026-07-30T12:00+08:00', height: 3.2, type: 'H' },
      ]),
      now,
    );

    expect(status).toBe('退潮中');
  });

  it('now 之后第一条为低潮(L)→ 涨潮中', () => {
    const status = deriveTideStatus(
      makeTideData([
        { fxTime: '2026-07-30T12:00+08:00', height: 0.8, type: 'L' },
        { fxTime: '2026-07-30T18:00+08:00', height: 3.2, type: 'H' },
      ]),
      now,
    );

    expect(status).toBe('涨潮中');
  });

  it('所有条目都已过期时返回未知潮汐', () => {
    const status = deriveTideStatus(
      makeTideData([
        { fxTime: '2026-07-29T18:00+08:00', height: 3.2, type: 'H' },
        { fxTime: '2026-07-30T02:00+08:00', height: 1.0, type: 'L' },
      ]),
      now,
    );

    expect(status).toBe('未知潮汐');
  });

  it('同一份数据在不同 now 下结果随之改变(纯函数、时间可注入)', () => {
    const tide = makeTideData([
      { fxTime: '2026-07-30T06:00+08:00', height: 3.2, type: 'H' },
      { fxTime: '2026-07-30T12:00+08:00', height: 0.9, type: 'L' },
    ]);

    expect(deriveTideStatus(tide, dayjs('2026-07-30T04:00+08:00'))).toBe(
      '退潮中',
    );
    expect(deriveTideStatus(tide, dayjs('2026-07-30T08:00+08:00'))).toBe(
      '涨潮中',
    );
    expect(deriveTideStatus(tide, dayjs('2026-07-30T20:00+08:00'))).toBe(
      '未知潮汐',
    );
  });
});

describe('hasMeaningfulWeather', () => {
  const liveWeather = { temp: '28' } as WeatherNow;
  const forecast = { fxDate: '2026-07-30' } as WeatherDay;
  const tide = makeTideData([]);

  it('实时天气非空即为真', () => {
    expect(
      hasMeaningfulWeather({ liveWeather, forecasts: [], tideData: null }),
    ).toBe(true);
  });

  it('实时天气为空但预报非空即为真', () => {
    expect(
      hasMeaningfulWeather({
        liveWeather: null,
        forecasts: [forecast],
        tideData: null,
      }),
    ).toBe(true);
  });

  it('前两者皆空但潮汐非空即为真(空 tideTable 也算有数据)', () => {
    expect(
      hasMeaningfulWeather({
        liveWeather: null,
        forecasts: [],
        tideData: tide,
      }),
    ).toBe(true);
  });

  it('三个来源全空时为假', () => {
    expect(
      hasMeaningfulWeather({
        liveWeather: null,
        forecasts: [],
        tideData: null,
      }),
    ).toBe(false);
  });
});

describe('TIDE_META_FALLBACK', () => {
  it('保持 fallback 单一真源的默认值', () => {
    expect(TIDE_META_FALLBACK.level).toBe(1.5);
    expect(TIDE_META_FALLBACK.range).toBe(1.5);
    expect(TIDE_META_FALLBACK.hoursToNext).toBe(3.0);
    expect(TIDE_META_FALLBACK.type).toBeUndefined();
  });
});
