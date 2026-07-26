import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export function BackToTop() {
  const [isVisible, setIsVisible] = useState(false);
  const rafRef = useRef<number | null>(null);

  const backToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const updateScroll = () => {
    const scrollTop = window.scrollY;
    setIsVisible(scrollTop > 300);
  };

  // 使用 requestAnimationFrame 节流，确保每帧只更新一次
  const onScroll = () => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      updateScroll();
      rafRef.current = null;
    });
  };

  useEffect(() => {
    updateScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);
  return (
    <>
      <AnimatePresence>
        {isVisible && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.28, ease: 'easeInOut' }}
            onClick={backToTop}
            aria-label="Back to Top"
            title="Back to Top"
            className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 transform-gpu cursor-pointer items-center justify-center gap-1.5 overflow-hidden rounded-full bg-black px-4 py-2 font-serif text-white shadow-lg transition-transform duration-200 ease-out hover:shadow-xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.97] [@media(hover:hover)_and_(pointer:fine)]:hover:scale-105"
          >
            Back to Top
            <ArrowUp />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
