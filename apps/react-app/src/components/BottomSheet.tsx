import { motion, AnimatePresence, type PanInfo } from 'framer-motion';
import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { SPRING } from '@/constants/springs';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** 纯标题文本（与 renderHeader 互斥） */
  title?: string;
  /** 自定义顶部栏，返回 null 则完全隐藏（含把手） */
  renderHeader?: () => ReactNode;
  /** 内容区最大高度，默认 85vh */
  maxH?: string;
  /** 是否启用下拉关闭，默认 true */
  draggable?: boolean;
  /** 是否启用 Esc 关闭，默认 true */
  escapable?: boolean;
  /** 点击遮罩是否关闭，默认 true */
  backdropDismiss?: boolean;
  /** 开启时锁 body 滚动 */
  lockScroll?: boolean;
}

// 通用底部浮层模板 — backdrop + sheet 壳，内容由 children 注入。
// z-200 为定位锚（backdrop z-100，sheet z-210）。
export function BottomSheet({
  open,
  onClose,
  children,
  title,
  renderHeader,
  maxH = '85vh',
  draggable = true,
  escapable = true,
  backdropDismiss = true,
  lockScroll = false,
}: BottomSheetProps) {
  const reduce = usePrefersReducedMotion();
  const sheetRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // 记录触发焦点，关闭时返还
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement;
      setTimeout(() => {
        sheetRef.current?.focus();
      }, 100);
    } else {
      const t = triggerRef.current;
      triggerRef.current = null;
      t?.focus();
    }
  }, [open]);

  // Esc 关闭
  useEffect(() => {
    if (!open || !escapable) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, escapable]);

  // 锁滚动
  useEffect(() => {
    if (!open || !lockScroll) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, lockScroll]);

  const handleClose = () => {
    onClose();
    const t = triggerRef.current;
    triggerRef.current = null;
    t?.focus();
  };

  const handleDragEnd = (
    _: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    // 向下拖动超过 80px 或速度超过 500px/s → 关闭
    if (info.offset.y > 80 || info.velocity.y > 500) {
      handleClose();
    }
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-200">
          {/* 背景遮罩 */}
          <motion.div
            className="bg-ink/30 fixed inset-0 z-100 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => {
              if (backdropDismiss) handleClose();
            }}
          />

          {/* 浮层面板 */}
          <motion.div
            ref={sheetRef}
            role="dialog"
            aria-label={title}
            aria-modal="true"
            tabIndex={-1}
            style={{ maxHeight: maxH }}
            className="bg-page fixed right-0 bottom-0 left-0 z-210 flex flex-col rounded-t-3xl border-t pb-[calc(1rem+env(safe-area-inset-bottom,0px))] shadow-2xl outline-none"
            initial={reduce ? false : { y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={SPRING.modal}
            drag={!reduce && draggable ? 'y' : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.15}
            onDragEnd={handleDragEnd}
            onClick={(e) => e.stopPropagation()}
          >
            {renderHeader ? (
              renderHeader()
            ) : (
              <div className="shrink-0 px-5 pt-3 pb-2">
                {/* 拖拽把手 */}
                {draggable && (
                  <div className="bg-surface mx-auto mb-3 h-1.5 w-10 rounded-full" />
                )}
                {title && (
                  <h2 className="text-ink text-center text-base font-semibold">
                    {title}
                  </h2>
                )}
              </div>
            )}

            {/* 内容区 — 滚动 */}
            <div className="flex-1 overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
