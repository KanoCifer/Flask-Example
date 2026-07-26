import { BentoCard } from '@/components';
import { FishingRod } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { SPRING } from '@/constants/springs';

export function BentoMap() {
  return (
    <Link to="/fishing-map" className="group block h-full">
      <BentoCard className="h-full min-w-0 cursor-pointer p-5">
        <motion.div
          className="flex h-full flex-col justify-between gap-3"
          whileTap={{ scale: 0.97 }}
          transition={SPRING.snappy}
        >
          <div className="flex items-center gap-3">
            <div className="bg-accent/10 text-ink ring-accent/20 flex size-10 items-center justify-center rounded-2xl ring-1">
              <FishingRod className="size-5" />
            </div>
            <div className="text-ink font-serif font-medium whitespace-pre">
              我的钓点
            </div>
          </div>
          <div className="text-ink inline-flex items-center gap-1 text-xs font-semibold">
            Open <span aria-hidden="true">→</span>
          </div>
        </motion.div>
      </BentoCard>
    </Link>
  );
}
