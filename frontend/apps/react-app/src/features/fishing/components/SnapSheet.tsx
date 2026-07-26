/**
 * SnapSheet —— iOS 风格的 bottom-sheet, 支持多个 snap 点。
 *
 * 与 BottomSheet 的差别:
 * - BottomSheet 是模态: drag-down 关闭
 * - SnapSheet 是 iOS Maps 风格: drag-up 在多个 snap 之间切换,
 *   drag-down 在最小档时关闭
 *
 * 关键设计:
 * - drag 跟手指: 用 MotionValue 直驱 height (不用 framer-motion 的 drag transform,
 *   否则 translate 会把整个面板往下挪, 露出底下的地图)
 * - 底边保持 anchored: 只改 height, 不改 transform, bottom-0 自动让面板向上生长
 * - drag 完吸附: framer-motion 的 animate() 函数 spring heightMV 到目标 snap
 */
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
} from 'framer-motion';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { SPRING } from '@/constants/springs';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

interface SnapSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** snap 点, 由小到大, 字符串如 '33vh' / '420px' */
  snapPoints: string[];
  /** 起始 snap 索引, 默认 0 */
  initialSnap?: number;
  /** 自定义顶部栏 (返回 null 完全隐藏) */
  renderHeader?: () => ReactNode;
  /** 拖动阈值: 拖动 > N px 才换档, 默认 80 */
  dragThreshold?: number;
  /** 拖动速度阈值: > N px/s 直接换档 */
  velocityThreshold?: number;
  /** Esc 关闭, 默认 true */
  escapable?: boolean;
  /** backdrop 点击关闭, 默认 true */
  backdropDismiss?: boolean;
  /** 锁背景滚动, 默认 true */
  lockScroll?: boolean;
}

const BACKDROP_SPRING = { duration: 0.2, ease: 'easeOut' as const };
const DRAG_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 500;
const MIN_DRAGGABLE_PX = 120; // height 最小值, 防止拖到负
const MAX_DRAGGABLE_PX_RATIO = 0.95; // height 最大为 viewport 的 95%

function snapToPx(value: string, viewportHeight: number): number {
  if (value.endsWith('vh')) return (parseFloat(value) / 100) * viewportHeight;
  if (value.endsWith('px')) return parseFloat(value);
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export function SnapSheet({
  open,
  onClose,
  children,
  snapPoints,
  initialSnap = 0,
  renderHeader,
  dragThreshold = DRAG_THRESHOLD,
  velocityThreshold = VELOCITY_THRESHOLD,
  escapable = true,
  backdropDismiss = true,
  lockScroll = true,
}: SnapSheetProps) {
  const reduce = usePrefersReducedMotion();
  const [snap, setSnap] = useState(initialSnap);
  const vh = (): number =>
    typeof window !== 'undefined' ? window.innerHeight : 800;

  // 初始 height (snap 对应的 px), 组件挂载时设置一次
  const heightMV = useMotionValue(snapToPx(snapPoints[initialSnap], vh()));

  // open 切换时重置 snap
  useEffect(() => {
    if (open) setSnap(initialSnap);
  }, [open, initialSnap]);

  // snap 切换后 spring 到目标高度 (用户点按钮 / drag 完 / open)
  useEffect(() => {
    if (!open) return;
    const target = snapToPx(snapPoints[snap], vh());
    animate(heightMV, target, SPRING.modal);
  }, [snap, snapPoints, open, heightMV]);

  // open 切换时初始入场动画
  useEffect(() => {
    if (!open) return;
    heightMV.set(snapToPx(snapPoints[initialSnap], vh()));
  }, [open, initialSnap, snapPoints, heightMV]);

  // 锁背景滚动
  useEffect(() => {
    if (!open || !lockScroll) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, lockScroll]);

  // Esc 关闭
  useEffect(() => {
    if (!open || !escapable) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, escapable]);

  // 拖拽状态 (指针 Y + 起始 height)
  const dragRef = useRef<{ startPointerY: number; startHeight: number } | null>(
    null,
  );
  // 拖拽中累积的最近一次速度 (在 pointermove 里维护)
  const lastMoveRef = useRef<{ y: number; t: number } | null>(null);
  const velocityRef = useRef(0);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // 只响应主指针 (鼠标左 / 触屏首指)
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
      const deltaY = dragRef.current.startPointerY - e.clientY; // up = positive
      const minH = MIN_DRAGGABLE_PX;
      const maxH = vh() * MAX_DRAGGABLE_PX_RATIO;
      const next = Math.max(
        minH,
        Math.min(maxH, dragRef.current.startHeight + deltaY),
      );
      heightMV.set(next);

      // 维护最近一次速度 (px / s)
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
      const target = e.currentTarget;
      try {
        target.releasePointerCapture(e.pointerId);
      } catch {
        // some browsers throw if not captured
      }
      const finalH = heightMV.get();
      const baseH = dragRef.current.startHeight;
      const delta = finalH - baseH; // up = positive
      dragRef.current = null;
      lastMoveRef.current = null;

      const velocity = velocityRef.current;

      // 向下 (panel 变小): 阈值判定收缩或关闭
      if (delta < -dragThreshold || velocity < -velocityThreshold) {
        if (snap === 0) {
          onClose();
          return;
        }
        setSnap((prev) => Math.max(0, prev - 1));
        return;
      }
      // 向上 (panel 变大): 阈值判定展开
      if (delta > dragThreshold || velocity > velocityThreshold) {
        setSnap((prev) => Math.min(snapPoints.length - 1, prev + 1));
        return;
      }
      // 不到阈值: spring 回当前 snap (animate() 在 useEffect[snap] 里已经会触发)
    },
    [
      heightMV,
      snap,
      snapPoints.length,
      dragThreshold,
      velocityThreshold,
      onClose,
    ],
  );

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-200">
          {/* Backdrop */}
          <motion.div
            className="bg-ink/30 fixed inset-0 z-100 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={BACKDROP_SPRING}
            onClick={() => {
              if (backdropDismiss) onClose();
            }}
          />

          {/* Sheet panel
              - bottom-0 + height 由 MotionValue 直驱: 底边永远 anchored,
                drag 改变 height 让面板从底部向上生长, 不会露出地图
              - 没有 framer-motion drag (那会 translate 整个 panel, 露出底部)
              - 入场用 motion.div 的 y: '100%' → 0 (slide up)
              - drag 完通过 useEffect[snap] spring 到目标 */}
          <motion.div
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            initial={reduce ? false : { y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={SPRING.modal}
            onClick={(e) => e.stopPropagation()}
            style={{ height: heightMV }}
            className="bg-page /40 fixed inset-x-0 bottom-0 z-210 flex flex-col overflow-hidden rounded-t-3xl border-t pb-[calc(1rem+env(safe-area-inset-bottom,0px))] shadow-2xl outline-none"
          >
            {/* Drag handle — 单独区域, pointer 事件专属此区域 */}
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

            {renderHeader && renderHeader()}

            {/* Content — scrollable, 不受 drag 影响 */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
