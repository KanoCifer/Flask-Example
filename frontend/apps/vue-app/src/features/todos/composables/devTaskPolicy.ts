// DevTask 看板的纯规则与派生 —— 不依赖 Vue / Pinia，可独立单测。
import type {
  DevTask,
  DevTaskPriority,
  DevTaskStatus,
  DevTaskType,
} from '@/features/todos/api';

/** v3 全量状态，顺序即看板从左到右的阅读流。 */
export const V3_STATUSES: readonly DevTaskStatus[] = [
  '待评估',
  '待排期',
  '进行中',
  '已搁置',
  '已完成',
] as const;

/** 优先级列表，按权重升序。UI 选择器按此顺序展示。 */
export const PRIORITIES: readonly DevTaskPriority[] = [
  'P0 紧急',
  'P1 高',
  'P2 中',
  'P3 低',
] as const;

/**
 * 默认状态推进（跳开"已搁置"——搁置与恢复是用户主动选择，不在循环里）。
 * 已搁置 → 待排期，已完成 → 待评估（闭环起点）。
 */
export const STATUS_CYCLE: Record<DevTaskStatus, DevTaskStatus> = {
  待评估: '待排期',
  待排期: '进行中',
  进行中: '已完成',
  已搁置: '待排期',
  已完成: '待评估',
};

/** 给定当前状态，返回循环推进后的下一状态。 */
export function nextStatus(current: DevTaskStatus): DevTaskStatus {
  return STATUS_CYCLE[current];
}

const PRIORITY_WEIGHT: Record<DevTaskPriority, number> = {
  'P0 紧急': 0,
  'P1 高': 1,
  'P2 中': 2,
  'P3 低': 3,
};

const UNKNOWN_PRIORITY_WEIGHT = 9;

/**
 * 优先级权重：P0 最高（0），P3 最低（3）。
 * 未知 / 缺失值降级为 9，确保排到队尾。
 */
export function priorityWeight(p: DevTaskPriority | undefined | null): number {
  if (!p) return UNKNOWN_PRIORITY_WEIGHT;
  return PRIORITY_WEIGHT[p] ?? UNKNOWN_PRIORITY_WEIGHT;
}

/** 按状态分组（排除已软删除，按 sort_order 升序）。 */
export function tasksByStatus(
  tasks: DevTask[],
  status: DevTaskStatus,
): DevTask[] {
  return tasks
    .filter((t) => t.status === status && !t.is_deleted)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

/**
 * Frontier = 未完成且无阻塞依赖的任务。
 * 排序：先按优先级权重，再按截止日（有截止日的优先）。
 */
export function frontier(tasks: DevTask[]): DevTask[] {
  return tasks
    .filter((t) => t.status !== '已完成' && !t.is_deleted)
    .filter((t) => !t.blocked_by || t.blocked_by.length === 0)
    .sort((a, b) => {
      const w = priorityWeight(a.priority) - priorityWeight(b.priority);
      if (w !== 0) return w;
      if (a.due_date && b.due_date) {
        return a.due_date.localeCompare(b.due_date);
      }
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return 0;
    });
}

/** 本周已完成（自然周，周一为起始）。按 updated_at 倒序。 */
export function completedThisWeek(tasks: DevTask[]): DevTask[] {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay() + 1);
  start.setHours(0, 0, 0, 0);
  return tasks
    .filter((t) => t.status === '已完成' && !t.is_deleted)
    .filter((t) => t.updated_at && new Date(t.updated_at) >= start)
    .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''));
}

/** 在进行中。 */
export function inProgress(tasks: DevTask[]): DevTask[] {
  return tasksByStatus(tasks, '进行中');
}

/** 累计活跃任务数（未软删除且未完成）。 */
export function totalActive(tasks: DevTask[]): number {
  return tasks.filter((t) => !t.is_deleted && t.status !== '已完成').length;
}

/** 累计已完成任务数。 */
export function completedCount(tasks: DevTask[]): number {
  return tasks.filter((t) => !t.is_deleted && t.status === '已完成').length;
}

/** 紧急活跃任务数（P0 且未完成）。 */
export function urgentActive(tasks: DevTask[]): number {
  return tasks.filter(
    (t) => !t.is_deleted && t.priority === 'P0 紧急' && t.status !== '已完成',
  ).length;
}

const DEFAULT_TYPES: readonly DevTaskType[] = [
  '功能需求',
  '问题',
  '优化',
  '技术债',
] as const;

/** 任务类型分布计数。 */
export function typeDistribution(
  tasks: DevTask[],
  types: readonly DevTaskType[] = DEFAULT_TYPES,
): Record<DevTaskType, number> {
  const dist = Object.fromEntries(types.map((t) => [t, 0])) as Record<
    DevTaskType,
    number
  >;
  for (const t of tasks) {
    if (!t.is_deleted && t.type in dist) dist[t.type]++;
  }
  return dist;
}

/**
 * 拖拽跨列后计算新的任务列表（纯函数）。
 * 给定旧任务列表 + 目标状态 + 目标顺序 slug 数组，返回重排后的新列表（不可变）。
 * 网络同步由 store / composable 负责。
 */
export function planSyncColumn(
  tasks: DevTask[],
  status: DevTaskStatus,
  orderedSlugs: string[],
): DevTask[] {
  const slugSet = new Set(orderedSlugs);
  const others = tasks.filter((t) => !slugSet.has(t.slug));
  const reordered: DevTask[] = orderedSlugs
    .map((slug, idx) => {
      const t = tasks.find((x) => x.slug === slug);
      return t ? { ...t, status, sort_order: idx } : null;
    })
    .filter((t): t is DevTask => t !== null);
  return [...others, ...reordered].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );
}
