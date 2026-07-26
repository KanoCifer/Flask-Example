import type { ReadDetailSnapshot, ReadStatsMode } from '@/features/books/api';
import { formatDuration } from '@/lib/dayjs';
import type { ComputedRef, Ref } from 'vue';
import { computed } from 'vue';
import { formatCompareSentence } from './useStatsFormat';

type Snapshot = ReadDetailSnapshot | null;

const EYEBROW_BY_MODE: Record<ReadStatsMode, string> = {
  overall: '从开始到现在,你一共读了',
  weekly: '这一周,你读了',
  monthly: '这个月,你读了',
  annually: '这一年,你读了',
};

/**
 * 段落一(总览)的派生量:`eyebrow` 文案 + `subtitle` 文案(带同比/环比)。
 */
export function useOverviewView(
  snapshot: ComputedRef<Snapshot> | Ref<Snapshot>,
  mode: ComputedRef<ReadStatsMode> | Ref<ReadStatsMode>,
) {
  const eyebrow = computed(() => EYEBROW_BY_MODE[mode.value]);

  const subtitle = computed(() => {
    const s = snapshot.value;
    if (!s) return '';
    const days = s.readDays ?? 0;
    const avg = formatDuration(s.dayAverageReadTime ?? 0);
    if (mode.value === 'overall') {
      return `覆盖 ${days} 天 · 日均 ${avg}`;
    }
    const compare = formatCompareSentence(s.compare, mode.value);
    const head = `${days} 天有阅读 · 日均 ${avg}`;
    return compare ? `${head}${compare}` : head;
  });

  return { eyebrow, subtitle };
}
