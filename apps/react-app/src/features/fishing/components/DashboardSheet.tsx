/**
 * DashboardSheet —— 持久的可拖拽 bottom-sheet (Apple Maps 风格)。
 *
 * 与 SnapSheet 共享同一套 drag 策略: 手动 pointer tracking + MotionValue 直驱 height,
 * 不用 framer-motion 的 drag (那个会 translate, 让底部露出地图)。
 *
 * 差异:
 * - 持久挂载, 无 backdrop / 无 close 语义
 * - snap 0 下拖不关闭, 只是收缩到 peek 高度
 * - z-30 (低于 modal z-200)
 */
import { animate, motion, useMotionValue } from 'framer-motion';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { SPRING } from '@/constants/springs';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

type Snap = 0 | 1 | 2;

interface DashboardSheetProps {
  children: ReactNode;
  /** 初始档位 (默认 half = 1) */
  initialSnap?: Snap;
}

const SNAP_POINTS: Record<Snap, string> = {
  0: '160px', // 收起 — 仅露出 drag handle + 顶部一行信息
  1: '52vh', // 默认 — 露出大半地图 + 大部分数据
  2: '88vh', // 展开 — 几乎盖满地图
};

const DRAG_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 500;
const MIN_DRAGGABLE_PX = 120;
const MAX_DRAGGABLE_PX_RATIO = 0.95;

function snapToPx(value: string, viewportHeight: number): number {
  if (value.endsWith('vh')) return (parseFloat(value) / 100) * viewportHeight;
  if (value.endsWith('px')) return parseFloat(value);
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export function DashboardSheet({
  children,
  initialSnap = 1,
}: DashboardSheetProps) {
  const reduce = usePrefersReducedMotion();
  const [snap, setSnap] = useState<Snap>(initialSnap);
  const vh = (): number =>
    typeof window !== 'undefined' ? window.innerHeight : 800;

  const heightMV = useMotionValue(snapToPx(SNAP_POINTS[initialSnap], vh()));

  // snap 切换后 spring 到目标高度
  useEffect(() => {
    const target = snapToPx(SNAP_POINTS[snap], vh());
    animate(heightMV, target, SPRING.modal);
  }, [snap, heightMV]);

  // 拖拽状态
  const dragRef = useRef<{ startPointerY: number; startHeight: number } | null>(
    null,
  );
  const lastMoveRef = useRef<{ y: number; t: number } | null>(null);
  const velocityRef = useRef(0);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!e.isPrimary) return;
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);
      dragRef.current = {
        startPointerY: e.clientY,
        startHeight: heightMV.get(),
      };
      lastMoveRef.current = { y: e.clientY, t: performance.now() };
      velocityRef.current = 0;
    },
    [heightMV],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const deltaY = dragRef.current.startPointerY - e.clientY;
      const minH = MIN_DRAGGABLE_PX;
      const maxH = vh() * MAX_DRAGGABLE_PX_RATIO;
      const next = Math.max(
        minH,
        Math.min(maxH, dragRef.current.startHeight + deltaY),
      );
      heightMV.set(next);

      if (lastMoveRef.current) {
        const dy = lastMoveRef.current.y - e.clientY;
        const dt = (performance.now() - lastMoveRef.current.t) / 1000;
        if (dt > 0) velocityRef.current = dy / dt;
        lastMoveRef.current = { y: e.clientY, t: performance.now() };
      }
    },
    [heightMV],
  );

  const handlePointerEnd = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      const finalH = heightMV.get();
      const baseH = dragRef.current.startHeight;
      const delta = finalH - baseH;
      dragRef.current = null;
      lastMoveRef.current = null;

      const velocity = velocityRef.current;

      if (delta < -DRAG_THRESHOLD || velocity < -VELOCITY_THRESHOLD) {
        // 向下: 收缩 (即使在最小档也只是收缩, 不关闭)
        setSnap((prev) => Math.max(0, prev - 1) as Snap);
        return;
      }
      if (delta > DRAG_THRESHOLD || velocity > VELOCITY_THRESHOLD) {
        setSnap((prev) => Math.min(2, prev + 1) as Snap);
      }
      // 不到阈值: 当前 snap 的 useEffect 会把高度 spring 回去
    },
    [heightMV],
  );

  return (
    <motion.div
      role="region"
      aria-label="钓鱼数据面板"
      initial={reduce ? false : { y: '100%' }}
      animate={{ y: 0 }}
      transition={SPRING.modal}
      style={{ height: heightMV }}
      className="bg-page /40 fixed inset-x-0 bottom-0 z-30 flex flex-col overflow-hidden rounded-t-3xl border-t shadow-[0_-8px_28px_color-mix(in_oklch,var(--ink)_10%,transparent)]"
    >
      {/* Drag handle */}
      <div
        role="button"
        aria-label="拖动调整高度"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        className="shrink-0 cursor-grab touch-none px-5 pt-3 pb-2 select-none active:cursor-grabbing"
      >
        <div className="bg-surface mx-auto h-1.5 w-10 rounded-full" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
        {children}
      </div>
    </motion.div>
  );
}
