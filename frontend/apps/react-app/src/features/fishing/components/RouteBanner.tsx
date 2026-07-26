/**
 * RouteBanner —— 路线状态条, 在 DashboardSheet 顶部显示。
 *
 * 三态:
 * - 空 (无规划中 + 无路线): 提示 "点击地图标记自动规划路线"
 * - 规划中: 加载状态
 * - 已规划: 距离 + 时间 + 清除按钮
 *
 * 之前是地图上的 overlay, 现在路线状态搬进 DashboardSheet,
 * 地图只剩地图 + 标记 (路线数字仍属于地图语境, 但承载 UI 在 sheet 里更稳)。
 */
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, MapPin, X } from 'lucide-react';
import { useRouteMapStore } from '@/stores/routeMapStore';
import { formatDistance, formatDuration } from '../utils';

interface RouteBannerProps {
  onClearRoute: () => void;
}

export function RouteBanner({ onClearRoute }: RouteBannerProps) {
  const isPlanning = useRouteMapStore((s) => s.isPlanningRoute);
  const routeInfo = useRouteMapStore((s) => s.routeInfo);

  return (
    <AnimatePresence mode="wait">
      {!isPlanning && !routeInfo && (
        <motion.div
          key="hint"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="bg-secondary/60 mx-1 flex items-center gap-2 rounded-xl px-3 py-2 text-xs"
        >
          <MapPin className="text-muted h-3.5 w-3.5 shrink-0" />
          <span className="text-muted">点击地图标记自动规划路线</span>
        </motion.div>
      )}

      {isPlanning && (
        <motion.div
          key="planning"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="bg-secondary/60 mx-1 flex items-center gap-2 rounded-xl px-3 py-2 text-xs"
        >
          <Loader2 className="text-muted h-3.5 w-3.5 animate-spin" />
          <span className="text-muted">正在规划路线…</span>
        </motion.div>
      )}

      {routeInfo && !isPlanning && (
        <motion.div
          key="route"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="bg-secondary/60 mx-1 flex items-center justify-between gap-3 rounded-xl px-3 py-2"
        >
          <div className="min-w-0 flex-1">
            <p className="text-muted text-[11px] font-medium">路线信息</p>
            <p className="text-ink font-family-averia mt-0.5 text-lg leading-none tabular-nums">
              <span>{formatDistance(routeInfo.distance)}</span>
              <span className="text-muted mx-1.5 text-sm">·</span>
              <span>{formatDuration(routeInfo.time)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClearRoute}
            aria-label="清除路线"
            className="bg-surface text-muted hover:bg-surface/70 inline-flex h-7 w-7 items-center justify-center rounded-full"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
