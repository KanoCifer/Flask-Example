import { BentoCard, BottomSheet } from '@/components';
import dayjs from 'dayjs';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { SPRING } from '@/constants/springs';

export function BentoCalendar() {
  const [expanded, setExpanded] = useState(false);
  const now = dayjs();

  const monthLabel = now.format('MMMM');
  const yearLabel = now.format('YYYY');
  const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // 本周日期
  const weekStart = now.startOf('week');
  const weekDays = Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'));

  // 月份网格
  const startOffset = now.startOf('month').day();
  const daysInMonth = now.daysInMonth();

  return (
    <>
      <BentoCard className="flex flex-col">
        {/* 标题行 */}
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-ink text-lg font-semibold">{monthLabel}</h3>
          <div className="flex items-center gap-2">
            <span className="text-muted text-sm tabular-nums">{yearLabel}</span>
            <motion.button
              whileTap={{ scale: 0.94 }}
              transition={SPRING.snappy}
              onClick={() => setExpanded(true)}
              className="text-muted hover:bg-surface rounded-full p-1.5 transition-colors"
              aria-label="展开日历"
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
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                />
              </svg>
            </motion.button>
          </div>
        </div>

        {/* 表头 */}
        <div className="mb-1 grid grid-cols-7 text-center">
          {weekdayLabels.map((label, idx) => (
            <span
              key={idx}
              className="text-muted py-1 text-xs font-medium tabular-nums"
            >
              {label}
            </span>
          ))}
        </div>

        {/* 本周视图 */}
        <div className="grid grid-cols-7 text-center">
          {weekDays.map((day, idx) => {
            const isToday = day.date() === now.date();
            return (
              <span
                key={idx}
                className={`mx-auto flex aspect-square w-full max-w-8 items-center justify-center rounded-full text-sm transition-colors ${
                  isToday
                    ? 'bg-accent text-ink font-bold'
                    : 'text-muted hover:bg-accent/10'
                }`}
              >
                {day.date()}
              </span>
            );
          })}
        </div>
      </BentoCard>

      {/* 展开态 — 整月网格（底部浮层） */}
      <BottomSheet
        open={expanded}
        onClose={() => setExpanded(false)}
        title={`${monthLabel} ${yearLabel}`}
      >
        <div className="px-5 pb-8">
          <div className="flex flex-col">
            {/* 表头 */}
            <div className="mb-2 grid grid-cols-7 text-center">
              {weekdayLabels.map((label, idx) => (
                <span
                  key={idx}
                  className="text-muted py-1 text-xs font-medium tabular-nums"
                >
                  {label}
                </span>
              ))}
            </div>

            {/* 月份网格 */}
            <motion.div
              className="grid grid-cols-7 text-center"
              initial="hidden"
              animate="visible"
              variants={{
                visible: {
                  transition: { staggerChildren: 0.02 },
                },
              }}
            >
              {/* 月初偏移 */}
              {Array.from({ length: startOffset }).map((_, idx) => (
                <span key={`offset-${idx}`} />
              ))}

              {/* 日期 */}
              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const dayNum = idx + 1;
                const isToday = dayNum === now.date();
                return (
                  <motion.span
                    key={dayNum}
                    variants={{
                      hidden: { opacity: 0, scale: 0.9 },
                      visible: { opacity: 1, scale: 1 },
                    }}
                    transition={SPRING.reveal}
                    className={`mx-auto flex aspect-square w-full max-w-8 items-center justify-center rounded-full text-sm ${
                      isToday ? 'bg-accent text-ink font-bold' : 'text-ink'
                    }`}
                  >
                    {dayNum}
                  </motion.span>
                );
              })}
            </motion.div>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
