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

/** 本周一 00:00（自然周，周一为起始）。纯函数，包装在 view 顶层只算一次。 */
export function startOfThisWeek(now: Date = new Date()): Date {
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay() + 1);
  start.setHours(0, 0, 0, 0);
  return start;
}

/** `YYYY-MM-DD` 形式的今日字符串 —— 比 Date 实例更便宜，且可字典序比较。 */
export function todayString(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// ── 看板列定义（与后端 DevTaskStatus 一一对应，仅"待办"合并两个未启动状态） ──
//
// 后端状态机 5 段，看板 4 列：
//   待办    ← 待评估 ∪ 待排期  （两个"未启动"状态合并为一列，方便规划视图）
//   进行中  ← 进行中           （直接对应后端）
//   已搁置  ← 已搁置           （直接对应后端，列名沿用后端命名）
//   已完成  ← 已完成           （直接对应后端）
export type KanbanColumnId = 'todo' | 'doing' | 'paused' | 'done';

export interface KanbanColumn {
  id: KanbanColumnId;
  label: string;
  /** 该列覆盖的真实 DevTaskStatus（用于数据过滤）。 */
  statuses: DevTaskStatus[];
  /** 拖入此列时写回的真实 status。合并列默认写"待评估"，与 STATUS_CYCLE 起态一致。 */
  targetStatus: DevTaskStatus;
  /** 列头圆点颜色，对齐 StatusChip 语义色。 */
  dotClass: string;
}

export const KANBAN_COLUMNS: KanbanColumn[] = [
  {
    id: 'todo',
    label: '待办',
    statuses: ['待评估', '待排期'],
    targetStatus: '待评估',
    dotClass: 'bg-surface',
  },
  {
    id: 'doing',
    label: '进行中',
    statuses: ['进行中'],
    targetStatus: '进行中',
    dotClass: 'bg-accent',
  },
  {
    id: 'paused',
    label: '已搁置',
    statuses: ['已搁置'],
    targetStatus: '已搁置',
    dotClass: 'bg-warning',
  },
  {
    id: 'done',
    label: '已完成',
    statuses: ['已完成'],
    targetStatus: '已完成',
    dotClass: 'bg-success',
  },
];

// ── 派生视图：一次性算出所有 panel 共用的数据 ────────────────────────────

const DEFAULT_TYPES: readonly DevTaskType[] = [
  '功能需求',
  '问题',
  '优化',
  '技术债',
] as const;

/**
 * 给定原始任务列表，**一次遍历**产出 4 个 panel 共用的全部派生数据。
 * 之前每个 panel 各算一遍 —— 4 panel × ~5 个 filter/sort，200 条任务下切一次 tab
 * 峰值 ~15+ 次全量遍历；现在降到 1 次遍历 + 末尾几次常数时间的排序。
 *
 * 输入约定：`tasks` 应已过滤 `is_deleted`(由 store 负责)。为安全起见，view 内部
 * 对每条任务再做一次 `is_deleted` 检查，但不会重复去除 —— 计数时忽略已删除条目。
 */
export interface DevTaskView {
  /** 全量未删除任务引用（供下游 panel 做本地的二次筛选时不再 `filter` is_deleted）。 */
  live: DevTask[];
  frontier: DevTask[];
  inProgress: DevTask[];
  completedThisWeek: DevTask[];
  doneLastWeekCount: number;
  createdThisWeekCount: number;
  overdueCount: number;
  urgentActiveCount: number;
  activeCount: number;
  blockedCount: number;
  /** 累计已完成任务数（不限时间），与 sidebar/mobile tab 的回顾计数口径一致。 */
  completedCount: number;
  /** 按状态分桶（每个数组按 sort_order 升序），与 `tasksByStatus` 等价。 */
  byStatus: Record<DevTaskStatus, DevTask[]>;
  typeDistribution: Record<DevTaskType, number>;
  /** userId → 未删除任务数，供 panel 做成员 chip 复用。 */
  userTaskCounts: Map<number, number>;
  /** 每列卡片数；空列也存在（值为 0）。 */
  columnCounts: Map<KanbanColumnId, number>;
  /** 每列按 user_id 分组后的泳道；每条 lane 内按 sort_order 升序。 */
  swimlanesByColumn: Map<
    KanbanColumnId,
    { userId: number; label: string; tasks: DevTask[] }[]
  >;
}

export function buildDevTaskView(
  tasks: DevTask[],
  now: Date = new Date(),
): DevTaskView {
  // ── 1) 一次性累加器：每个 bucket 用临时数组，最后做一次排序 ──
  const frontierArr: DevTask[] = [];
  const inProgressArr: DevTask[] = [];
  const completedThisWeekArr: DevTask[] = [];
  const byStatusArr: Record<DevTaskStatus, DevTask[]> = {
    待评估: [],
    待排期: [],
    进行中: [],
    已搁置: [],
    已完成: [],
  };
  const typeDist = Object.fromEntries(
    DEFAULT_TYPES.map((t) => [t, 0]),
  ) as Record<DevTaskType, number>;

  // column → user_id → lane tasks
  const laneMaps = new Map<
    KanbanColumnId,
    Map<number, { userId: number; label: string; tasks: DevTask[] }>
  >();
  for (const col of KANBAN_COLUMNS) laneMaps.set(col.id, new Map());

  const userCounts = new Map<number, number>();
  const columnCounts = new Map<KanbanColumnId, number>();
  for (const col of KANBAN_COLUMNS) columnCounts.set(col.id, 0);

  // ── 时间口径：本周一 / 上周一 / 今日 YYYY-MM-DD ──
  const weekStart = startOfThisWeek(now);
  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(weekStart.getDate() - 7);
  const todayStr = todayString(now);

  let doneLastWeekCount = 0;
  let createdThisWeekCount = 0;
  let overdueCount = 0;
  let urgentActiveCount = 0;
  let activeCount = 0;
  let blockedCount = 0;
  let completedCount = 0;

  for (const t of tasks) {
    if (t.is_deleted) continue;

    // ── 分桶 ──
    byStatusArr[t.status].push(t);

    // active / urgent 计数
    const isDone = t.status === '已完成';
    if (isDone) {
      completedCount++;
    } else {
      activeCount++;
      if (t.priority === 'P0 紧急') urgentActiveCount++;
      if (t.blocked_by && t.blocked_by.length > 0) blockedCount++;
    }

    // inProgress
    if (t.status === '进行中') inProgressArr.push(t);

    // frontier：未完成且无阻塞
    if (!isDone && (!t.blocked_by || t.blocked_by.length === 0)) {
      frontierArr.push(t);
    }

    // completedThisWeek：本周完成 + 上周同口径计数
    if (isDone && t.updated_at) {
      const updated = new Date(t.updated_at);
      if (updated >= weekStart) {
        completedThisWeekArr.push(t);
      } else if (updated >= prevWeekStart) {
        doneLastWeekCount++;
      }
    }

    // createdThisWeek
    if (t.created_at && new Date(t.created_at) >= weekStart) {
      createdThisWeekCount++;
    }

    // overdue：有截止日 + 已过期 + 未完成；YYYY-MM-DD 可字典序比较
    if (!isDone && t.due_date && t.due_date < todayStr) {
      overdueCount++;
    }

    // typeDistribution
    if (t.type in typeDist) typeDist[t.type]++;

    // userCounts
    userCounts.set(t.user_id, (userCounts.get(t.user_id) ?? 0) + 1);

    // kanban 分桶：每条任务匹配第一个覆盖其 status 的列
    for (const col of KANBAN_COLUMNS) {
      if (!col.statuses.includes(t.status)) continue;
      columnCounts.set(col.id, (columnCounts.get(col.id) ?? 0) + 1);
      const laneMap = laneMaps.get(col.id)!;
      let lane = laneMap.get(t.user_id);
      if (!lane) {
        lane = { userId: t.user_id, label: `用户 ${t.user_id}`, tasks: [] };
        laneMap.set(t.user_id, lane);
      }
      lane.tasks.push(t);
      break;
    }
  }

  // ── 2) 排序（只对最后需要的数组排，常数时间增量） ──
  // frontier：优先级权重升序，同优先级截止日升序，有截止日的优先
  frontierArr.sort((a, b) => {
    const w = priorityWeight(a.priority) - priorityWeight(b.priority);
    if (w !== 0) return w;
    if (a.due_date && b.due_date) {
      return a.due_date.localeCompare(b.due_date);
    }
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return 0;
  });

  // inProgress：按 sort_order 升序
  inProgressArr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  // completedThisWeek：按 updated_at 倒序
  completedThisWeekArr.sort((a, b) =>
    (b.updated_at ?? '').localeCompare(a.updated_at ?? ''),
  );

  // 各状态桶：按 sort_order 升序
  for (const status of V3_STATUSES) {
    byStatusArr[status].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    );
  }

  // kanban 泳道：每条 lane 内按 sort_order 升序
  const swimlanesByColumn = new Map<
    KanbanColumnId,
    { userId: number; label: string; tasks: DevTask[] }[]
  >();
  for (const col of KANBAN_COLUMNS) {
    const lanes = Array.from(laneMaps.get(col.id)!.values());
    for (const lane of lanes) {
      lane.tasks.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    }
    swimlanesByColumn.set(col.id, lanes);
  }

  return {
    live: tasks.filter((t) => !t.is_deleted),
    frontier: frontierArr,
    inProgress: inProgressArr,
    completedThisWeek: completedThisWeekArr,
    doneLastWeekCount,
    createdThisWeekCount,
    overdueCount,
    urgentActiveCount,
    activeCount,
    blockedCount,
    completedCount,
    byStatus: byStatusArr,
    typeDistribution: typeDist,
    userTaskCounts: userCounts,
    columnCounts,
    swimlanesByColumn,
  };
}

// ── 旧 API：保留以兼容 useDevTaskSections / 其它调用方 / 单测 ────────────

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
 *
 * 仍走独立实现 —— `useDevTaskSections` 之外目前无 panel 单独调用，
 * 但旧单测、未来 panel 直接调用都要保持行为不变。
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
  const start = startOfThisWeek();
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
