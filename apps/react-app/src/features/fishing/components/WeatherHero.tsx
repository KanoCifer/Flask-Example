/**
 * WeatherHero —— weather-led 主导模块 (iOS Weather 信息架构)。
 *
 * 顶部: 地点 chip + AI 分析 button
 * 主体: 大号实时温度 + 状况文字 + 高低温
 * 底部 hairline
 * 结论: 一行 verdict 把"天气"桥到"值不值得出钓"。
 * 单一 accent (verdict tone), 不堆叠 SaaS hero-metric KPI。
 */
import { Bot, Fish, MapPin } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';

import { useFishingMapStore } from '@/features/fishing/stores/fishingMapStore';
import type { FishingLevel } from '../types';

interface Verdict {
  text: string;
  tone: string;
}

const VERDICT: Record<FishingLevel, Verdict> = {
  爆护: { text: '今日爆护', tone: 'text-success' },
  好: { text: '今日宜出钓', tone: 'text-ink' },
  一般: { text: '今日可一试', tone: 'text-warning' },
  差: { text: '今日不宜出钓', tone: 'text-destructive' },
  空军: { text: '今日恐空军', tone: 'text-muted' },
};

interface WeatherHeroProps {
  analysisOpen: boolean;
  analysisHasData: boolean;
  onToggleAnalysis: () => void;
}

export function WeatherHero({
  analysisOpen,
  analysisHasData,
  onToggleAnalysis,
}: WeatherHeroProps) {
  const { liveWeather, today, locationName, indexData, loading } =
    useFishingMapStore(
      useShallow((s) => ({
        liveWeather: s.liveWeather,
        today: s.forecasts?.[0] ?? null,
        locationName: s.locationName,
        indexData: s.indexData,
        loading: s.weatherLoading,
      })),
    );

  const verdict = indexData ? VERDICT[indexData.level] : null;

  return (
    <section className="px-1 pt-2 pb-6" aria-label="当前天气">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <MapPin className="text-muted h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="text-muted truncate text-sm font-medium">
            {locationName || '钓鱼地点'}
          </span>
        </div>

        <button
          type="button"
          aria-pressed={analysisOpen}
          aria-label={analysisOpen ? '关闭 AI 分析' : '打开 AI 分析'}
          onClick={onToggleAnalysis}
          className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            analysisOpen
              ? 'bg-accent text-ink'
              : 'text-muted hover:bg-surface hover:text-ink'
          }`}
        >
          <span className="relative inline-flex">
            <Bot className="h-4 w-4" aria-hidden />
            {analysisHasData && !analysisOpen && (
              <span className="bg-success ring-page absolute -top-1 -right-1 inline-flex h-2 w-2 rounded-full ring-2" />
            )}
          </span>
          AI 分析
        </button>
      </div>

      {loading && !liveWeather ? (
        <HeroSkeleton />
      ) : liveWeather ? (
        <>
          <div className="mt-3 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-start">
                <span className="text-ink text-[64px] leading-[0.85] font-light tracking-tight tabular-nums">
                  {liveWeather.temp}
                </span>
                <span className="text-ink/60 mt-1 ml-0.5 text-3xl font-light">
                  °
                </span>
              </div>
              <p className="text-muted mt-2 text-sm">
                {liveWeather.text}
                <span className="text-muted/70 ml-1.5">
                  {'· 体感 '}
                  {liveWeather.feelsLike}°
                </span>
              </p>
            </div>
            <i
              className={`qi-${liveWeather.icon} text-ink/85 -mt-1 text-6xl`}
              aria-hidden
            />
          </div>

          {today && (
            <p className="text-muted mt-3 text-sm tabular-nums">
              最高 {today.tempMax}°
              <span className="text-muted/40 mx-1.5">·</span>
              最低 {today.tempMin}°
            </p>
          )}
        </>
      ) : (
        <p className="text-muted mt-4 text-sm">暂无天气数据</p>
      )}

      {/* Apple HIG hairline separator — 单一 1px hairline, 不用 SaaS divider block */}
      <div className="bg-border/60 mt-5 h-px w-full" />

      <div className="mt-4 flex items-center gap-2">
        <Fish
          className={`h-4 w-4 shrink-0 ${verdict?.tone ?? 'text-muted'}`}
          aria-hidden
        />
        {verdict && indexData ? (
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className={`text-base font-semibold ${verdict.tone}`}>
              {verdict.text}
            </span>
            <span className="text-muted text-xs">
              钓鱼指数 {indexData.level}
              <span className="ml-1.5 tabular-nums">
                {indexData.fishing_index}
              </span>
            </span>
          </p>
        ) : (
          <span className="text-muted text-sm">钓鱼指数计算中…</span>
        )}
      </div>
    </section>
  );
}

function HeroSkeleton() {
  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="bg-surface/15 skeleton-pulse h-16 w-28 rounded-xl" />
        <div className="bg-surface/15 skeleton-pulse h-14 w-14 rounded-xl" />
      </div>
      <div className="bg-surface/15 skeleton-pulse h-3.5 w-40 rounded-md" />
    </div>
  );
}
