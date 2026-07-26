/**
 * 特征详情 sheet —— iOS SnapSheet: 三档吸附 [33vh / 60vh / 80vh]。
 *
 * 初始 1/3 露出顶部信息, 用户可上拖查看更多, 最小档下拖关闭。
 * 9 项子特征以 .fm-tile 双列网格呈现。
 */
import { X } from 'lucide-react';

import type { FishingIndexData } from '../types';
import { SnapSheet } from './SnapSheet';

interface Props {
  open: boolean;
  data: FishingIndexData | null;
  onClose: () => void;
}

const LABELS: Record<string, string> = {
  w1_temp: '气温',
  w2_humidity: '湿度',
  w3_pressure: '气压',
  w4_wind: '风速',
  w5_rain: '降水',
  w6_tide_rising: '涨潮',
  w7_hours_to_tide: '距潮',
  w8_tide_range: '潮差',
  w9_indices: '指数',
};

// 分档 → 语义 token (无硬编码色、无装饰性 glow)
function gaugeClass(p: number): string {
  if (p >= 85) return 'bg-success';
  if (p >= 70) return 'bg-accent';
  if (p >= 50) return 'bg-warning';
  if (p <= 30) return 'bg-destructive';
  return 'bg-surface';
}

// SnapSheet 档位: 初始 1/3, 中档 60vh, 大档 4/5 (80vh)
const SNAP_POINTS = ['33vh', '60vh', '80vh'];

export function FishingIndexDetailSheet({ open, data, onClose }: Props) {
  return (
    <SnapSheet
      open={open && !!data}
      onClose={onClose}
      snapPoints={SNAP_POINTS}
      initialSnap={0}
      renderHeader={() => (
        <header className="shrink-0 px-5 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-ink text-base font-semibold">特征详情</h2>
              {data && (
                <p className="text-muted mt-0.5 text-xs">
                  9 项子特征 · 综合指数 {data.fishing_index} · {data.level}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭"
              className="hover:bg-surface text-muted inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>
      )}
    >
      {data && (
        <div className="grid grid-cols-2 gap-2 px-5 pt-1 pb-8">
          {Object.entries(data.feature_breakdown).map(
            ([key, value]: [string, number]) => {
              const vals = Object.values(data.feature_breakdown);
              const max = vals.length ? Math.max(...vals) : 0;
              const pct = max > 0 ? (value / max) * 100 : 50;
              const label = LABELS[key] || key;
              return (
                <div key={key} className="fm-tile p-3">
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="text-muted text-xs font-medium">
                      {label}
                    </span>
                    <span className="text-ink text-sm font-semibold tabular-nums">
                      {value}
                    </span>
                  </div>
                  <div className="bg-ink/10 relative h-1.5 w-full overflow-hidden rounded-full">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full ${gaugeClass(pct)}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            },
          )}
        </div>
      )}
    </SnapSheet>
  );
}
