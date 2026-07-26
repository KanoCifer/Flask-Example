import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

type ConfirmVariant = 'default' | 'destructive';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  onClose: () => void;
  onConfirm: () => void;
}

const VARIANT_STYLE = {
  default: {
    iconBg: 'bg-accent/10',
    iconColor: 'text-ink',
    iconPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    confirmClass: 'bg-accent text-ink hover:bg-accent/90',
  },
  destructive: {
    iconBg: 'bg-destructive/10',
    iconColor: 'text-destructive',
    iconPath:
      'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z',
    confirmClass:
      'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/30',
  },
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'default',
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  const v = VARIANT_STYLE[variant];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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
          className="bg-ink/35 fixed inset-0 z-[10000] flex items-center justify-center p-4 backdrop-blur-[6px]"
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
            className="bg-page /60 w-full max-w-[420px] rounded-2xl border p-6 shadow-2xl"
            role="alertdialog"
            aria-modal="true"
          >
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${v.iconBg}`}
              >
                <svg
                  className={`h-[18px] w-[18px] ${v.iconColor}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={v.iconPath}
                  />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-ink text-base font-semibold">{title}</h2>
                <p className="text-muted mt-1 text-sm leading-relaxed">
                  {message}
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="text-muted hover:bg-surface focus-visible:ring-ring cursor-pointer rounded-lg px-3.5 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={`focus-visible:ring-ring cursor-pointer rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${v.confirmClass}`}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
