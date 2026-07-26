import { useCallback } from 'react';

import { RotateCw } from 'lucide-react';
import { useFishingIndex } from '../hooks/useFishingIndex';
import type { FishingIndexData } from '../types';
import { SkeletonCard } from './SkeletonCard';

interface FishingIndexCardProps {
  location?: [number, number];
  onFeedbackClick?: (data: FishingIndexData) => void;
  onDetailClick?: (data: FishingIndexData) => void;
}

const LEVEL_COLORS: Record<string, string> = {
  爆护: 'text-success',
  好: 'text-ink',
  一般: 'text-warning',
  差: 'text-destructive',
  空军: 'text-muted',
};

/**
 * FishingIndexCard — Apple HIG 信息架构:
 *   header (标题 + 副 + refresh icon button)
 *   hero number (大字 + 等级, Apple Weather 大数字 + 单位风格)
 *   inset-grouped 数据行 (默认权重 / 权重调整 / 综合指数)
 *   action row (反馈主按钮 + 详情次按钮)
 */
export function FishingIndexCard({
  location = [113.389549, 23.050067],
  onFeedbackClick,
  onDetailClick,
}: FishingIndexCardProps) {
  const { indexData, loading, error, refetch } = useFishingIndex(location);

  const handleFeedback = useCallback(() => {
    if (indexData && onFeedbackClick) {
      onFeedbackClick(indexData);
    }
  }, [indexData, onFeedbackClick]);

  const handleDetail = useCallback(() => {
    if (indexData && onDetailClick) {
      onDetailClick(indexData);
    }
  }, [indexData, onDetailClick]);

  const levelColor = indexData
    ? (LEVEL_COLORS[indexData.level] ?? 'text-muted')
    : '';

  return (
    <article className="px-1 pt-2 pb-6" aria-label="钓鱼指数">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-ink text-sm font-semibold">钓鱼指数</h3>
          <p className="text-muted mt-0.5 text-xs">
            基于实时天气、潮汐综合计算
          </p>
        </div>
        <button
          onClick={() => void refetch()}
          aria-label="刷新钓鱼指数"
          disabled={loading}
          className="text-muted hover:text-ink hover:bg-surface inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RotateCw
            className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
            aria-hidden
          />
        </button>
      </div>

      {loading && !indexData ? (
        <div className="min-h-[200px]">
          <SkeletonCard />
        </div>
      ) : error && !indexData ? (
        <div className="flex min-h-[200px] items-center">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      ) : indexData ? (
        <div className="min-h-[200px] space-y-5">
          {/* Hero number — Apple Weather 大数字风格 */}
          <div className="flex items-end gap-3 px-1">
            <span
              className={`text-[56px] leading-none font-light tracking-tight tabular-nums ${levelColor}`}
            >
              {indexData.fishing_index}
            </span>
            <span className={`mb-1.5 text-base font-medium ${levelColor}`}>
              {indexData.level}
            </span>
          </div>

          {/* Inset-grouped data rows */}
          <div className="fm-grouped divide-border/40 divide-y">
            <DataRow label="默认权重" value={indexData.expert_score} />
            <DataRow
              label="权重调整"
              value={`${indexData.residual > 0 ? '+' : ''}${indexData.residual}`}
            />
            <DataRow
              label="综合指数"
              value={indexData.fishing_index}
              emphasis
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 px-0.5">
            <button
              onClick={handleFeedback}
              className="bg-accent text-ink hover:bg-accent/90 min-h-11 flex-1 rounded-full px-3 text-sm font-medium transition-colors"
            >
              反馈今日指数
            </button>
            {onDetailClick &&
              Object.keys(indexData.feature_breakdown).length > 0 && (
                <button
                  onClick={handleDetail}
                  className="bg-surface text-ink hover:bg-surface/70 min-h-11 rounded-full px-5 text-sm font-medium transition-colors"
                >
                  详情
                </button>
              )}
          </div>
        </div>
      ) : (
        <div className="flex min-h-[200px] items-center">
          <p className="text-muted text-sm">暂无数据</p>
        </div>
      )}
    </article>
  );
}

interface DataRowProps {
  label: string;
  value: number | string;
  emphasis?: boolean;
}

function DataRow({ label, value, emphasis = false }: DataRowProps) {
  return (
    <div className="flex items-baseline justify-between px-4 py-2.5">
      <span className="text-muted text-xs font-medium">{label}</span>
      <span
        className={`tabular-nums ${
          emphasis ? 'text-base font-semibold' : 'text-sm font-semibold'
        } text-ink`}
      >
        {value}
      </span>
    </div>
  );
}
