import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { SPRING } from '@/constants/springs';

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

// 标准滚动显现包装器 — whileInView 弹簧显现 + reduced-motion 降级为即时可见。
// 复用 ChangelogView / MomentCard 的显现模式。
export function ScrollReveal({
  children,
  className,
  delay = 0,
}: ScrollRevealProps) {
  const reduce = usePrefersReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING.reveal, delay }}
      viewport={{ once: true, amount: 0.2 }}
    >
      {children}
    </motion.div>
  );
}
