import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: 'sm:max-w-[420px]',
  md: 'sm:max-w-[560px]',
  lg: 'sm:max-w-[720px]',
  xl: 'sm:max-w-[880px]',
};

interface TodoModalProps {
  open: boolean;
  size?: ModalSize;
  onClose: () => void;
  children: React.ReactNode;
}

/** 基础对话框：居中弹出 + backdrop blur + 滚动锁定。 */
export function TodoModal({
  open,
  size = 'md',
  onClose,
  children,
}: TodoModalProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="bg-ink/35 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-[6px] sm:p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.97, y: 6, opacity: 0 }}
            transition={{
              type: 'spring',
              stiffness: 340,
              damping: 32,
              mass: 0.8,
            }}
            onClick={(e) => e.stopPropagation()}
            className={`bg-page /60 relative max-h-[85vh] w-full overflow-hidden rounded-2xl border shadow-2xl ${SIZE_CLASS[size]}`}
            role="dialog"
            aria-modal="true"
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
