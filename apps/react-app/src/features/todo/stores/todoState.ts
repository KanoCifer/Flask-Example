import { devTaskService, type DevTaskService } from '@/features/todo';
import { create } from 'zustand';
import type {
  CreateDevTaskPayload,
  DevTask,
  DevTaskStatus,
  DevTaskType,
} from '@/features/todo/api/types';

// v3 全量状态标签
export const STATUS_LABELS: Record<DevTaskStatus, string> = {
  待评估: '待评估',
  待排期: '待排期',
  进行中: '进行中',
  已搁置: '已搁置',
  已完成: '已完成',
};

// Semantic status badge styles（与 TaskDetailPanel / BentoTodo chip 共用）
export const STATUS_STYLES: Record<
  DevTaskStatus,
  { bg: string; border: string; text: string }
> = {
  待评估: {
    bg: 'bg-accent/10',
    border: 'border-accent/30',
    text: 'text-ink',
  },
  待排期: {
    bg: 'bg-warning/10',
    border: 'border-warning/30',
    text: 'text-warning',
  },
  进行中: {
    bg: 'bg-info/10',
    border: 'border-info/30',
    text: 'text-info',
  },
  已搁置: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-600 dark:text-amber-400',
  },
  已完成: {
    bg: 'bg-success/10',
    border: 'border-success/30',
    text: 'text-success',
  },
};

// 状态推进：跳开"已搁置"——搁置与恢复是用户主动选择，不在循环里
const STATUS_CYCLE: Record<DevTaskStatus, DevTaskStatus> = {
  待评估: '待排期',
  待排期: '进行中',
  进行中: '已完成',
  已搁置: '待排期',
  已完成: '待评估',
};

// 主线状态流转（有顺序）：已搁置是旁路，不进主线
export const V3_STATUSES: DevTaskStatus[] = [
  '待评估',
  '待排期',
  '进行中',
  '已完成',
];

interface DevTaskState {
  tasks: DevTask[];
  hydrateTasks: () => void;
  createTask: (payload: CreateDevTaskPayload) => Promise<void>;
  cycleStatus: (slug: string) => Promise<void>;
  updateTask: (slug: string, patch: Partial<DevTask>) => Promise<void>;
  deleteTask: (slug: string) => Promise<void>;
  hardDeleteTask: (slug: string) => Promise<void>;
}

const service: DevTaskService = devTaskService();

export const useTodoState = create<DevTaskState>((set, get) => ({
  tasks: [],

  hydrateTasks: () => {
    service
      .list({ per_page: 200 })
      .then((res) => set({ tasks: res.tasks.filter((t) => !t.is_deleted) }));
  },

  createTask: async (payload) => {
    const newTask = await service.create(payload);
    if (newTask) {
      set((state) => ({ tasks: [newTask, ...state.tasks] }));
    }
  },

  cycleStatus: async (slug) => {
    const task = get().tasks.find((t) => t.slug === slug);
    if (!task) return;
    const nextStatus = STATUS_CYCLE[task.status];
    await service.update(slug, { status: nextStatus });
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.slug === slug ? { ...t, status: nextStatus } : t,
      ),
    }));
  },

  updateTask: async (slug, patch) => {
    await service.update(slug, patch);
    set((state) => ({
      tasks: state.tasks.map((t) => (t.slug === slug ? { ...t, ...patch } : t)),
    }));
  },

  deleteTask: async (slug) => {
    await service.remove(slug);
    set((state) => ({ tasks: state.tasks.filter((t) => t.slug !== slug) }));
  },

  hardDeleteTask: async (slug) => {
    await service.hardDelete(slug);
    set((state) => ({ tasks: state.tasks.filter((t) => t.slug !== slug) }));
  },
}));

// ── Derived selectors（与 Vue v3devtasks store 对齐） ──

function priorityWeight(p: DevTask['priority']): number {
  return { 'P0 紧急': 0, 'P1 高': 1, 'P2 中': 2, 'P3 低': 3 }[p] ?? 9;
}

/** frontier = 非已完成 且 无阻塞依赖 的任务。按优先级权重 + 截止日排序。 */
export function selectFrontier(tasks: DevTask[]): DevTask[] {
  return tasks
    .filter((t) => t.status !== '已完成' && !t.is_deleted)
    .filter((t) => !t.blocked_by || t.blocked_by.length === 0)
    .sort((a, b) => {
      const w = priorityWeight(a.priority) - priorityWeight(b.priority);
      if (w !== 0) return w;
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return 0;
    });
}

/** 本周已完成（自然周，周一为起始）。 */
export function selectCompletedThisWeek(tasks: DevTask[]): DevTask[] {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay() + 1); // Monday
  start.setHours(0, 0, 0, 0);
  return tasks
    .filter((t) => t.status === '已完成' && !t.is_deleted)
    .filter((t) => t.updated_at && new Date(t.updated_at) >= start)
    .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''));
}

export function selectInProgress(tasks: DevTask[]): DevTask[] {
  return tasks.filter((t) => t.status === '进行中' && !t.is_deleted);
}

export function selectTotalActive(tasks: DevTask[]): number {
  return tasks.filter((t) => !t.is_deleted && t.status !== '已完成').length;
}

export function selectCompletedCount(tasks: DevTask[]): number {
  return tasks.filter((t) => !t.is_deleted && t.status === '已完成').length;
}

export function selectUrgentActive(tasks: DevTask[]): number {
  return tasks.filter(
    (t) => !t.is_deleted && t.priority === 'P0 紧急' && t.status !== '已完成',
  ).length;
}

export function selectTypeDistribution(
  tasks: DevTask[],
): Record<DevTaskType, number> {
  const dist: Record<string, number> = {
    功能需求: 0,
    问题: 0,
    优化: 0,
    技术债: 0,
  };
  for (const t of tasks) {
    if (!t.is_deleted && t.type in dist) dist[t.type]++;
  }
  return dist as Record<DevTaskType, number>;
}

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 本周起止日期范围，用于回顾 tab 标题。 */
export function selectWeekRangeDisplay(): string {
  const now = new Date();
  const mon = new Date(now);
  mon.setDate(now.getDate() - now.getDay() + 1);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return `${fmtDate(mon)} ~ ${fmtDate(sun)}`;
}

export function selectTodayDisplay(): string {
  return fmtDate(new Date());
}
