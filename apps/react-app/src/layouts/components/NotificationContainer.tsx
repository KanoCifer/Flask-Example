import errorAnimationData from '@/assets/error.json';
import successAnimationData from '@/assets/success.json';
import { useNotificationStore } from '@/stores/notificationState';
import { AnimatePresence, motion } from 'framer-motion';
import { useLottie } from 'lottie-react';
import { X } from 'lucide-react';
import { useEffect } from 'react';

const AnimationLayer = ({ type }: { type: string }) => {
  const animationData =
    type === 'success' ? successAnimationData : errorAnimationData;
  const options = {
    animationData,
    loop: false,
    autoplay: true,
  };
  const style = { width: 48, height: 48 };
  const { View } = useLottie(options, style);
  return View;
};

export function Notifier() {
  const notificationStore = useNotificationStore();

  const notifications = notificationStore.notifications;

  useEffect(() => {
    notifications.forEach((n) => {
      if (n.timeout) {
        const timer = setTimeout(() => {
          notificationStore.dismiss(n.id);
        }, n.timeout);
        return () => clearTimeout(timer); // 清理
      }
    });
  }, [notifications, notificationStore]);

  const toast = notifications.map((n, i) => {
    const offset = i * 20; // 每条通知向下偏移20px，形成堆叠效果

    return (
      <motion.div
        key={n.id}
        initial={{ opacity: 0, y: -40 - offset, scale: 0.9 }}
        animate={{
          opacity: 1,
          y: offset,
          scale: 1 - i * 0.05,
          zIndex: 9999 - i,
          pointerEvents: i > 2 ? 'none' : 'auto',
        }}
        exit={{ opacity: 0, y: -40, scale: 0.9 }}
        transition={{ type: 'spring', damping: 30, stiffness: 500 }}
        className="squircle bg-page/80 text-ink absolute top-0 left-1/2 flex h-18 w-60 -translate-x-1/2 items-center justify-between gap-3 border shadow-xl backdrop-blur-sm transition-colors duration-200"
      >
        <AnimationLayer type={n.type} />

        <div className="text-muted flex-1 text-sm leading-snug font-semibold">
          {n.message}
        </div>
        <button
          className="text-muted hover:bg-surface hover:text-muted mr-2 shrink-0 cursor-pointer rounded-md p-1 transition-colors"
          onClick={() => notificationStore.dismiss(n.id)}
          aria-label="dismiss"
        >
          <X className="size-4" />
        </button>
      </motion.div>
    );
  });

  return (
    <div className="fixed top-4 left-1/2 z-9999 w-full -translate-x-1/2">
      <AnimatePresence mode="popLayout">{toast}</AnimatePresence>
    </div>
  );
}
