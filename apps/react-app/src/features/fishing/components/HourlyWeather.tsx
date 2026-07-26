/**
 * 逐时预报 —— iOS Weather 招牌的横向滚动条。
 * 每格: 时刻 · 天气图标 · 降水概率 · 温度。首格为「现在」。
 * 没有外框, 没有 elevation; 滚动行本身就是 surface (iOS Weather 模式)。
 */
import { Droplets } from 'lucide-react';
import dayjs from 'dayjs';

import { useFishingMapStore } from '@/features/fishing/stores/fishingMapStore';

export function HourlyWeather() {
  const weatherHourly = useFishingMapStore((state) => state.weatherHourly);
  const hours = weatherHourly?.slice(0, 24) ?? [];

  return (
    <section className="px-1 pt-2 pb-6" aria-label="逐时预报">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-ink text-sm font-semibold">逐时预报</h3>
        <span className="text-muted text-xs">未来 24 小时</span>
      </div>

      {weatherHourly ? (
        <div className="fm-hscroll -mx-2 flex gap-0.5 px-2">
          {hours.map((h, i) => {
            const pop = Number(h.pop) || 0;
            const isNow = i === 0;
            return (
              <div
                key={h.fxTime}
                className={`flex w-[54px] shrink-0 snap-start flex-col items-center gap-1.5 py-2 ${
                  isNow ? 'text-ink' : 'text-muted'
                }`}
              >
                <span
                  className={`text-xs font-medium ${isNow ? 'text-ink' : ''}`}
                >
                  {isNow ? '现在' : dayjs(h.fxTime).format('HH:mm')}
                </span>
                <i className={`qi-${h.icon} text-ink/85 text-xl`} aria-hidden />
                <span className="text-muted/80 flex h-3 items-center gap-0.5 text-[10px] tabular-nums">
                  {pop > 0 && (
                    <>
                      <Droplets className="h-2.5 w-2.5" aria-hidden />
                      {pop}%
                    </>
                  )}
                </span>
                <span className="text-ink text-sm font-semibold tabular-nums">
                  {h.temp}°
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="fm-hscroll -mx-2 flex gap-1 px-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex w-[54px] shrink-0 flex-col items-center gap-2 py-2"
            >
              <div className="bg-surface/15 skeleton-pulse h-3 w-8 rounded" />
              <div className="bg-surface/15 skeleton-pulse h-5 w-5 rounded-full" />
              <div className="bg-surface/15 skeleton-pulse h-3.5 w-6 rounded" />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
