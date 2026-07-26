import { BentoCard } from '@/components';
import websitesData from '@/data/websites.json';
import { useState, useMemo } from 'react';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';
import { SPRING } from '@/constants/springs';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

interface Website {
  id: string;
  name: string;
  description: string;
  url: string;
  icon: string;
  category: string;
  tags: string[];
}

// 洗牌数组（稳定初始顺序）
function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function BentoWeb() {
  const websites = websitesData.sites as Website[];
  const reduce = usePrefersReducedMotion();

  // 洗牌后循环浏览
  const shuffled = useMemo(() => shuffleArray(websites), []);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const currentSite = shuffled[index % shuffled.length];

  const handleImageError = (
    e: React.SyntheticEvent<HTMLImageElement, Event>,
  ) => {
    e.currentTarget.style.display = 'none';
  };

  // 导航到上一个/下一个
  const navigate = (dir: number) => {
    setDirection(dir);
    setIndex((prev) => (prev + dir + shuffled.length) % shuffled.length);
  };

  // drag-to-dismiss 速度判断 — 横向滑动切换
  const handleDragEnd = (
    _: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    const threshold = 50;
    const velocityThreshold = 500;

    // 速度传递 + 动量投影：快速轻扫或超过阈值 → 切换
    if (info.offset.x < -threshold || info.velocity.x < -velocityThreshold) {
      navigate(1); // 向左滑 → 下一个
    } else if (
      info.offset.x > threshold ||
      info.velocity.x > velocityThreshold
    ) {
      navigate(-1); // 向右滑 → 上一个
    }
    // 否则弹簧回原位（offset.x 自动归零）
  };

  // 滑动卡片变体
  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -300 : 300,
      opacity: 0,
    }),
  };

  return (
    <div>
      {/* 标签 + 导航 */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-muted text-xs font-bold tracking-wide uppercase">
          Daily Pick
        </span>
        {!reduce && (
          <div className="flex gap-1">
            <button
              onClick={() => navigate(-1)}
              className="text-muted hover:bg-surface rounded-full p-1.5 transition-colors"
              aria-label="上一个"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <button
              onClick={() => navigate(1)}
              className="text-muted hover:bg-surface rounded-full p-1.5 transition-colors"
              aria-label="下一个"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* 可滑动卡片 */}
      <motion.div
        drag={reduce ? false : 'x'}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.15}
        onDragEnd={handleDragEnd}
        className={reduce ? '' : 'cursor-grab active:cursor-grabbing'}
      >
        <BentoCard>
          <AnimatePresence mode="popLayout" custom={direction}>
            <motion.div
              key={index}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={SPRING.card}
              className="flex h-full flex-col justify-between"
            >
              {/* 站点图标 + 名字 */}
              <div className="my-1 flex items-center">
                <div className="bg-surface text-muted group-hover:bg-secondary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors duration-300">
                  {currentSite.icon && (
                    <img
                      src={currentSite.icon}
                      alt={currentSite.name}
                      onError={handleImageError}
                      className="h-6 w-6 object-contain"
                    />
                  )}
                  {!currentSite.icon && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0 3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                      />
                    </svg>
                  )}
                </div>
                <h3 className="text-ink ml-2 text-lg leading-tight font-bold transition-colors duration-300">
                  {currentSite.name}
                </h3>
              </div>

              {/* 描述 */}
              <p className="text-muted group-hover:text-muted line-clamp-2 text-sm transition-colors duration-300">
                {currentSite.description}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* 圆点指示器 */}
          <div className="mt-4 flex justify-center gap-1.5">
            {shuffled.slice(0, Math.min(shuffled.length, 5)).map((_, i) => (
              <motion.div
                key={i}
                className="h-1.5 rounded-full"
                animate={{
                  width: i === index % 5 ? 20 : 6,
                  backgroundColor:
                    i === index % 5
                      ? 'var(--color-accent)'
                      : 'var(--color-muted)',
                }}
                transition={SPRING.snappy}
              />
            ))}
          </div>
        </BentoCard>
      </motion.div>
    </div>
  );
}
