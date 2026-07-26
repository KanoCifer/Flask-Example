import { useCallback, useEffect, useRef, useState } from 'react';

const SHIMMER_TIPS = ['分析文章结构…', '提取关键信息…', '生成总结内容…'];

/**
 * 轮播一组提示文案，active 为 true 时启动、false 时清理。
 */
export function useShimmerTips(intervalMs = 2000) {
  const [tips, setTips] = useState([...SHIMMER_TIPS]);
  const [active, setActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (active) {
      timerRef.current = setInterval(() => {
        setTips((prev) => {
          const [first, ...rest] = prev;
          return first ? [...rest, first] : prev;
        });
      }, intervalMs);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [active, intervalMs]);

  const reset = useCallback(() => {
    setTips([...SHIMMER_TIPS]);
    setActive(false);
  }, []);

  return { tips, active, setActive, reset };
}
