import dayjs from 'dayjs';
import { useEffect, useState } from 'react';

export function BentoClock() {
  const [timeLabel, setTimeLabel] = useState<string>('--:--');
  const [dateLabel, setDateLabel] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = dayjs();
      setTimeLabel(now.format('HH:mm'));
      setDateLabel(now.format('YYYY-MM-DD'));
    };

    updateTime();
    const timerId = setInterval(updateTime, 1000);
    return () => clearInterval(timerId);
  }, []);

  return (
    <div className="flex items-center justify-between px-2">
      {/* 左侧：日期 */}
      <span className="text-muted text-sm font-medium">{dateLabel}</span>

      {/* 右侧：大数字时间 */}
      <span className="text-ink font-serif text-2xl font-extrabold tracking-tight tabular-nums">
        {timeLabel}
      </span>
    </div>
  );
}
