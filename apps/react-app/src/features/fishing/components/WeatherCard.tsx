import dayjs from 'dayjs';
import {
  Droplets,
  ExternalLink,
  Eye,
  Gauge,
  Navigation,
  Thermometer,
} from 'lucide-react';
import { useWeatherData } from '../hooks/useWeatherData';
import { SkeletonCard } from './SkeletonCard';

interface WeatherCardProps {
  location?: [number, number];
}

type PressureLevel = '偏低' | '正常' | '偏高' | '很高';

// 气压等级 → 语义 token (状态色, 非装饰色)
function getPressureLevel(pressure: number): {
  label: PressureLevel;
  tone: string;
  dot: string;
} {
  if (pressure < 1000)
    return { label: '偏低', tone: 'text-warning', dot: 'bg-warning' };
  if (pressure < 1020)
    return { label: '正常', tone: 'text-success', dot: 'bg-success' };
  if (pressure < 1030)
    return { label: '偏高', tone: 'text-warning', dot: 'bg-warning' };
  return { label: '很高', tone: 'text-destructive', dot: 'bg-destructive' };
}

interface MetricRowProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  /** Optional tonal right-side indicator (e.g. pressure status). */
  accessory?: React.ReactNode;
}

function MetricRow({ icon, label, value, accessory }: MetricRowProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className="text-muted inline-flex h-4 w-4 shrink-0 items-center justify-center">
        {icon}
      </span>
      <span className="text-muted text-xs font-medium">{label}</span>
      {accessory}
      <span className="text-ink ml-auto text-sm font-semibold tabular-nums">
        {value}
      </span>
    </div>
  );
}

/**
 * WeatherCard — Apple HIG inset-grouped 数据列表 + 3 日预报 strip。
 * 每行 icon + 标签 + 值, 不再使用 uppercase tracking eyebrow。
 */
export function WeatherCard({
  location = [113.389549, 23.050067],
}: WeatherCardProps) {
  const { liveWeather, forecasts, loading, error } = useWeatherData(location);

  const openQWeather = () => {
    window.open('https://www.qweather.com/', '_blank');
  };

  const pressureLevel = liveWeather
    ? getPressureLevel(Number(liveWeather.pressure))
    : null;

  return (
    <article className="px-1 pt-2 pb-6" aria-label="天气详情">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-ink text-sm font-semibold">天气详情</h3>
        <button
          type="button"
          onClick={openQWeather}
          aria-label="查看和风天气"
          className="text-muted hover:text-ink inline-flex items-center gap-1 text-xs transition-colors"
        >
          和风天气
          <ExternalLink className="h-3 w-3" aria-hidden />
        </button>
      </div>

      {loading ? (
        <SkeletonCard hasBottomRow />
      ) : error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : liveWeather ? (
        <div className="space-y-4">
          {/* Inset-grouped metric rows */}
          <div className="fm-grouped divide-border/40 divide-y">
            <MetricRow
              icon={<Thermometer className="h-4 w-4" />}
              label="体感"
              value={`${liveWeather.feelsLike}°C`}
            />
            <MetricRow
              icon={<Eye className="h-4 w-4" />}
              label="能见度"
              value={`${liveWeather.vis} km`}
            />
            <MetricRow
              icon={
                <Navigation
                  className="h-4 w-4"
                  style={{
                    transform: `rotate(${Number(liveWeather.wind360)}deg)`,
                  }}
                />
              }
              label={liveWeather.windDir}
              value={`${(Number(liveWeather.windSpeed) / 3.6).toFixed(1)} m/s`}
            />
            <MetricRow
              icon={<Droplets className="h-4 w-4" />}
              label="湿度"
              value={`${liveWeather.humidity}%`}
            />
            <MetricRow
              icon={<Gauge className="h-4 w-4" />}
              label="气压"
              value={`${liveWeather.pressure} hPa`}
            />
            <div className="flex items-center gap-3 px-4 py-2.5">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  pressureLevel?.dot ?? 'bg-surface'
                }`}
                aria-hidden
              />
              <span className="text-muted text-xs font-medium">气压状态</span>
              <span
                className={`ml-auto text-sm font-semibold ${
                  pressureLevel?.tone ?? 'text-muted'
                }`}
              >
                {pressureLevel?.label ?? '--'}
              </span>
            </div>
          </div>

          {/* 3-day forecast strip — flat horizontal cells, no card chrome */}
          {!!forecasts.length && (
            <div className="divide-border/40 flex items-stretch divide-x">
              {forecasts.slice(0, 3).map((day, i) => (
                <div
                  key={day.fxDate}
                  className="flex flex-1 flex-col items-center gap-1.5 py-2"
                >
                  <p className="text-muted text-xs font-medium">
                    {i === 0 ? '今天' : dayjs(day.fxDate).format('MM/DD')}
                  </p>
                  <i
                    className={`qi-${day.iconDay} text-ink/85 text-2xl`}
                    aria-hidden
                  />
                  <p className="text-ink text-xs font-semibold tabular-nums">
                    {day.tempMax}° / {day.tempMin}°
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="text-muted text-sm">暂无天气数据</p>
      )}
    </article>
  );
}
