import type { ReadStatsMode } from '@/features/books/api';
import type { useReadStatsStore } from '@/features/books/stores/readStats';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { computed, ref, watch } from 'vue';

dayjs.extend(isoWeek);

type Store = ReturnType<typeof useReadStatsStore>;

const UNIT_LABEL: Record<ReadStatsMode, string> = {
  weekly: '周',
  monthly: '月',
  annually: '年',
  overall: '',
};

/**
 * BookStats 周期导航状态机：4 个 mode tab + 翻页 + 当前周期判定。
 *
 * - viewBaseTime[mode]：该 mode 当前正在看的 baseTime（null=当前周期）
 * - anchorBaseTime[mode]：第一次拉到的"当前周期 baseTime"，用于禁止翻到未来
 */
export function usePeriodNavigation(statsStore: Store) {
  const activeMode = ref<ReadStatsMode>('weekly');
  const viewBaseTime = ref<Record<ReadStatsMode, number | null>>({
    weekly: null,
    monthly: null,
    annually: null,
    overall: null,
  });
  const anchorBaseTime = ref<Record<ReadStatsMode, number | null>>({
    weekly: null,
    monthly: null,
    annually: null,
    overall: null,
  });

  const activeSnapshot = computed(() =>
    statsStore.getSnapshot(
      activeMode.value,
      viewBaseTime.value[activeMode.value],
    ),
  );

  const isAtCurrent = computed(
    () => viewBaseTime.value[activeMode.value] === null,
  );

  const unitLabel = computed(() => UNIT_LABEL[activeMode.value]);

  const periodLabel = computed(() => {
    const s = activeSnapshot.value;
    if (!s) return '—';
    if (activeMode.value === 'overall') return '累计';
    const d = dayjs.unix(s.baseTime);
    if (!d.isValid()) return '—';
    if (activeMode.value === 'weekly') {
      return `${d.isoWeekYear()}-W${String(d.isoWeek()).padStart(2, '0')}`;
    }
    if (activeMode.value === 'monthly') return d.format('YYYY 年 M 月');
    return d.format('YYYY 年');
  });

  function shiftBaseTime(baseTime: number, mode: ReadStatsMode, delta: -1 | 1) {
    const d = dayjs.unix(baseTime);
    if (mode === 'weekly') return d.add(delta * 7, 'day').unix();
    if (mode === 'monthly') return d.add(delta, 'month').unix();
    if (mode === 'annually') return d.add(delta, 'year').unix();
    return baseTime;
  }

  async function navigate(delta: -1 | 1) {
    const mode = activeMode.value;
    if (mode === 'overall') return;
    const current = activeSnapshot.value;
    if (!current) return;

    const next = shiftBaseTime(current.baseTime, mode, delta);
    const anchor = anchorBaseTime.value[mode];

    // 不让翻到未来：到达 / 越过 anchor 时回归 null（=当前周期）
    if (anchor != null && next >= anchor) {
      viewBaseTime.value = { ...viewBaseTime.value, [mode]: null };
      await statsStore.fetchPeriod(mode, null);
      return;
    }

    viewBaseTime.value = { ...viewBaseTime.value, [mode]: next };
    await statsStore.fetchPeriod(mode, next);
  }

  async function goPrev() {
    await navigate(-1);
  }

  async function goNext() {
    if (isAtCurrent.value) return;
    await navigate(1);
  }

  async function switchMode(mode: ReadStatsMode) {
    activeMode.value = mode;
    if (!statsStore.getSnapshot(mode, viewBaseTime.value[mode])) {
      await statsStore.fetchPeriod(mode, viewBaseTime.value[mode]);
    }
  }

  async function reloadCurrent() {
    await statsStore.fetchPeriod(
      activeMode.value,
      viewBaseTime.value[activeMode.value],
    );
  }

  // 同步 anchorBaseTime（只在 isAtCurrent 时更新）
  watch(
    () => activeSnapshot.value,
    (s) => {
      if (!s) return;
      const mode = activeMode.value;
      if (
        viewBaseTime.value[mode] === null &&
        anchorBaseTime.value[mode] === null
      ) {
        anchorBaseTime.value = { ...anchorBaseTime.value, [mode]: s.baseTime };
      }
    },
    { immediate: true },
  );

  return {
    activeMode,
    activeSnapshot,
    isAtCurrent,
    unitLabel,
    periodLabel,
    goPrev,
    goNext,
    switchMode,
    reloadCurrent,
  };
}
