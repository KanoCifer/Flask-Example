import { describe, it, expect } from 'vitest';
import {
  V3_STATUSES,
  PRIORITIES,
  STATUS_CYCLE,
  nextStatus,
  priorityWeight,
  tasksByStatus,
  frontier,
  completedThisWeek,
  inProgress,
  totalActive,
  completedCount,
  urgentActive,
  typeDistribution,
  planSyncColumn,
  buildDevTaskView,
} from '../devTaskPolicy';
import type { DevTask } from '@/features/todos/api';

// ── 测试夹具 ─────────────────────────────────────────────────────────────

function makeTask(overrides: Partial<DevTask> = {}): DevTask {
  return {
    id: '1',
    slug: 'task-1',
    title: 'task',
    type: '功能需求',
    priority: 'P2 中',
    status: '待评估',
    scope: '',
    user_id: 1,
    sort_order: 0,
    is_deleted: false,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ── PRIORITIES ───────────────────────────────────────────────────────────

describe('PRIORITIES', () => {
  it('按权重升序排列', () => {
    expect(PRIORITIES).toEqual(['P0 紧急', 'P1 高', 'P2 中', 'P3 低']);
  });
});

describe('V3_STATUSES', () => {
  it('包含全部 5 个状态', () => {
    expect(V3_STATUSES).toEqual([
      '待评估',
      '待排期',
      '进行中',
      '已搁置',
      '已完成',
    ]);
  });
});

// ── STATUS_CYCLE & nextStatus ─────────────────────────────────────────────

describe('STATUS_CYCLE', () => {
  it.each([
    ['待评估', '待排期'],
    ['待排期', '进行中'],
    ['进行中', '已完成'],
    ['已搁置', '待排期'],
    ['已完成', '待评估'],
  ] as const)('%s → %s', (from, to) => {
    expect(STATUS_CYCLE[from]).toBe(to);
  });

  it('已搁置不参与正向循环（搁置是用户主动选择）', () => {
    // 链式推进: 待评估 → 待排期 → 进行中 → 已完成
    expect(nextStatus(nextStatus(nextStatus('待评估')))).toBe('已完成');
    // 已完成 → 待评估（闭环起点）
    expect(nextStatus('已完成')).toBe('待评估');
  });
});

// ── priorityWeight ───────────────────────────────────────────────────────

describe('priorityWeight', () => {
  it.each([
    ['P0 紧急', 0],
    ['P1 高', 1],
    ['P2 中', 2],
    ['P3 低', 3],
  ] as const)('%s → %d', (p, expected) => {
    expect(priorityWeight(p)).toBe(expected);
  });

  it('未知 / null / undefined 一律降级为 9（队尾）', () => {
    expect(priorityWeight(undefined)).toBe(9);
    expect(priorityWeight(null)).toBe(9);
    expect(priorityWeight(undefined as unknown as 'P0 紧急')).toBe(9);
  });
});

// ── tasksByStatus ────────────────────────────────────────────────────────

describe('tasksByStatus', () => {
  it('按 status 过滤并排除已软删除', () => {
    const tasks = [
      makeTask({ slug: 'a', status: '进行中', sort_order: 2 }),
      makeTask({ slug: 'b', status: '进行中', sort_order: 0 }),
      makeTask({
        slug: 'c',
        status: '进行中',
        is_deleted: true,
        sort_order: 1,
      }),
      makeTask({ slug: 'd', status: '待评估' }),
    ];
    const result = tasksByStatus(tasks, '进行中');
    expect(result.map((t) => t.slug)).toEqual(['b', 'a']);
  });

  it('按 sort_order 升序', () => {
    const tasks = [
      makeTask({ slug: 'a', status: '待评估', sort_order: 5 }),
      makeTask({ slug: 'b', status: '待评估', sort_order: 2 }),
      makeTask({ slug: 'c', status: '待评估', sort_order: 8 }),
    ];
    expect(tasksByStatus(tasks, '待评估').map((t) => t.slug)).toEqual([
      'b',
      'a',
      'c',
    ]);
  });

  it('sort_order 缺失时按 0 处理', () => {
    const tasks = [
      makeTask({ slug: 'a', status: '待评估' }),
      makeTask({ slug: 'b', status: '待评估', sort_order: 1 }),
    ];
    expect(tasksByStatus(tasks, '待评估').map((t) => t.slug)).toEqual([
      'a',
      'b',
    ]);
  });
});

// ── frontier ─────────────────────────────────────────────────────────────

describe('frontier', () => {
  it('排除已完成', () => {
    const tasks = [
      makeTask({ slug: 'a', status: '进行中', priority: 'P2 中' }),
      makeTask({ slug: 'b', status: '已完成', priority: 'P0 紧急' }),
    ];
    expect(frontier(tasks).map((t) => t.slug)).toEqual(['a']);
  });

  it('排除有阻塞依赖的任务', () => {
    const tasks = [
      makeTask({ slug: 'a', status: '进行中', priority: 'P2 中' }),
      makeTask({
        slug: 'b',
        status: '进行中',
        priority: 'P0 紧急',
        blocked_by: ['some-other'],
      }),
    ];
    expect(frontier(tasks).map((t) => t.slug)).toEqual(['a']);
  });

  it('按优先级权重升序', () => {
    const tasks = [
      makeTask({ slug: 'a', status: '进行中', priority: 'P3 低' }),
      makeTask({ slug: 'b', status: '进行中', priority: 'P0 紧急' }),
      makeTask({ slug: 'c', status: '进行中', priority: 'P1 高' }),
    ];
    expect(frontier(tasks).map((t) => t.slug)).toEqual(['b', 'c', 'a']);
  });

  it('同优先级按截止日升序', () => {
    const tasks = [
      makeTask({
        slug: 'late',
        status: '进行中',
        priority: 'P1 高',
        due_date: '2026-12-31',
      }),
      makeTask({
        slug: 'early',
        status: '进行中',
        priority: 'P1 高',
        due_date: '2026-08-01',
      }),
    ];
    expect(frontier(tasks).map((t) => t.slug)).toEqual(['early', 'late']);
  });

  it('同优先级时，有截止日的优先于无截止日的', () => {
    const tasks = [
      makeTask({ slug: 'no-date', status: '进行中', priority: 'P1 高' }),
      makeTask({
        slug: 'has-date',
        status: '进行中',
        priority: 'P1 高',
        due_date: '2026-08-01',
      }),
    ];
    expect(frontier(tasks).map((t) => t.slug)).toEqual(['has-date', 'no-date']);
  });

  it('排除已软删除', () => {
    const tasks = [
      makeTask({ slug: 'a', status: '进行中', is_deleted: true }),
      makeTask({ slug: 'b', status: '进行中' }),
    ];
    expect(frontier(tasks).map((t) => t.slug)).toEqual(['b']);
  });
});

// ── completedThisWeek ────────────────────────────────────────────────────

describe('completedThisWeek', () => {
  it('只包含状态为已完成的本周任务，按 updated_at 倒序', () => {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - now.getDay() + 1);
    monday.setHours(0, 0, 0, 0);
    const weekLater = new Date(monday);
    weekLater.setDate(monday.getDate() + 2);
    const lastWeek = new Date(monday);
    lastWeek.setDate(monday.getDate() - 3);

    const tasks = [
      makeTask({
        slug: 'old',
        status: '已完成',
        updated_at: lastWeek.toISOString(),
      }),
      makeTask({
        slug: 'recent',
        status: '已完成',
        updated_at: weekLater.toISOString(),
      }),
      makeTask({
        slug: 'todo',
        status: '进行中',
        updated_at: weekLater.toISOString(),
      }),
    ];
    const result = completedThisWeek(tasks);
    expect(result.map((t) => t.slug)).toEqual(['recent']);
  });
});

// ── inProgress / counts ──────────────────────────────────────────────────

describe('inProgress', () => {
  it('等同于 tasksByStatus(tasks, "进行中")', () => {
    const tasks = [
      makeTask({ slug: 'a', status: '进行中' }),
      makeTask({ slug: 'b', status: '已完成' }),
      makeTask({ slug: 'c', status: '进行中', is_deleted: true }),
    ];
    expect(inProgress(tasks).map((t) => t.slug)).toEqual(['a']);
  });
});

describe('totalActive', () => {
  it('统计未删除且未完成的任务数', () => {
    const tasks = [
      makeTask({ slug: 'a', status: '进行中' }),
      makeTask({ slug: 'b', status: '已完成' }),
      makeTask({ slug: 'c', status: '进行中', is_deleted: true }),
      makeTask({ slug: 'd', status: '待评估' }),
    ];
    expect(totalActive(tasks)).toBe(2);
  });
});

describe('completedCount', () => {
  it('统计未删除且已完成的任务数', () => {
    const tasks = [
      makeTask({ slug: 'a', status: '已完成' }),
      makeTask({ slug: 'b', status: '已完成', is_deleted: true }),
      makeTask({ slug: 'c', status: '进行中' }),
    ];
    expect(completedCount(tasks)).toBe(1);
  });
});

describe('urgentActive', () => {
  it('统计 P0 且未完成且未删除的任务数', () => {
    const tasks = [
      makeTask({ slug: 'a', status: '进行中', priority: 'P0 紧急' }),
      makeTask({ slug: 'b', status: '已完成', priority: 'P0 紧急' }),
      makeTask({ slug: 'c', status: '进行中', priority: 'P1 高' }),
      makeTask({
        slug: 'd',
        status: '进行中',
        priority: 'P0 紧急',
        is_deleted: true,
      }),
    ];
    expect(urgentActive(tasks)).toBe(1);
  });
});

// ── typeDistribution ─────────────────────────────────────────────────────

describe('typeDistribution', () => {
  it('返回所有类型的计数（缺失类型为 0）', () => {
    const tasks = [
      makeTask({ slug: 'a', type: '功能需求' }),
      makeTask({ slug: 'b', type: '问题' }),
      makeTask({ slug: 'c', type: '功能需求', is_deleted: true }),
    ];
    expect(typeDistribution(tasks)).toEqual({
      功能需求: 1,
      问题: 1,
      优化: 0,
      技术债: 0,
    });
  });

  it('忽略未在 types 列表中的 type 字段', () => {
    const tasks = [makeTask({ slug: 'a', type: '功能需求' })];
    const result = typeDistribution(tasks, ['功能需求']);
    expect(result).toEqual({ 功能需求: 1 });
  });
});

// ── planSyncColumn ───────────────────────────────────────────────────────

describe('planSyncColumn', () => {
  it('重排并赋新 status + sort_order', () => {
    const tasks = [
      makeTask({ slug: 'a', status: '待评估', sort_order: 0 }),
      makeTask({ slug: 'b', status: '待评估', sort_order: 1 }),
      makeTask({ slug: 'c', status: '待评估', sort_order: 2 }),
    ];
    const result = planSyncColumn(tasks, '进行中', ['c', 'a', 'b']);
    expect(result.map((t) => t.slug)).toEqual(['c', 'a', 'b']);
    expect(result.every((t) => t.status === '进行中')).toBe(true);
    expect(result.map((t) => t.sort_order)).toEqual([0, 1, 2]);
  });

  it('保持不在 orderedSlugs 中的任务相对位置（按 sort_order 排序）', () => {
    const tasks = [
      makeTask({ slug: 'a', status: '进行中', sort_order: 0 }),
      makeTask({ slug: 'b', status: '待评估', sort_order: 5 }),
      makeTask({ slug: 'c', status: '进行中', sort_order: 10 }),
    ];
    const result = planSyncColumn(tasks, '待评估', ['a', 'c']);
    // a, c 拿到 sort_order 0, 1；b 保留 sort_order 5，最终排序 [a, c, b]
    expect(result.map((t) => t.slug)).toEqual(['a', 'c', 'b']);
    expect(result.map((t) => t.sort_order)).toEqual([0, 1, 5]);
  });

  it('不可变：不修改入参对象', () => {
    const original = makeTask({ slug: 'a', status: '待评估', sort_order: 0 });
    const snapshot = { ...original };
    planSyncColumn([original], '进行中', ['a']);
    expect(original).toEqual(snapshot);
  });

  it('orderedSlugs 中存在但 tasks 里没有的 slug 静默忽略', () => {
    const tasks = [makeTask({ slug: 'a', status: '待评估' })];
    const result = planSyncColumn(tasks, '进行中', ['a', 'missing']);
    expect(result.map((t) => t.slug)).toEqual(['a']);
  });
});

// ── buildDevTaskView ─────────────────────────────────────────────────────

describe('buildDevTaskView', () => {
  // 锁定"现在"：周三 2026-08-05 12:00，本周一 = 2026-08-03 00:00，
  // 上周一 = 2026-07-27 00:00，今日 = 2026-08-05。
  const now = new Date('2026-08-05T12:00:00.000Z');

  it('一次遍历产出 panel 共用的全部派生字段', () => {
    const tasks = [
      makeTask({
        slug: 'frontier-p0',
        status: '进行中',
        priority: 'P0 紧急',
        due_date: '2026-08-10',
        user_id: 1,
      }),
      makeTask({
        slug: 'blocked',
        status: '进行中',
        priority: 'P0 紧急',
        blocked_by: ['other'],
        user_id: 1,
      }),
      makeTask({
        slug: 'in-progress',
        status: '进行中',
        sort_order: 1,
        user_id: 2,
      }),
      makeTask({
        slug: 'done-this-week',
        status: '已完成',
        updated_at: '2026-08-04T10:00:00.000Z',
        user_id: 1,
      }),
      makeTask({
        slug: 'done-last-week',
        status: '已完成',
        updated_at: '2026-07-30T10:00:00.000Z',
        user_id: 1,
      }),
      makeTask({
        slug: 'created-this-week',
        status: '待评估',
        created_at: '2026-08-04T08:00:00.000Z',
        user_id: 2,
      }),
      makeTask({
        slug: 'overdue',
        status: '待评估',
        due_date: '2026-08-01',
        user_id: 1,
      }),
      makeTask({
        slug: 'p0-active',
        status: '待评估',
        priority: 'P0 紧急',
        user_id: 1,
      }),
      makeTask({
        slug: 'p0-done',
        status: '已完成',
        priority: 'P0 紧急',
        user_id: 1,
        updated_at: '2026-08-04T10:00:00.000Z',
      }),
      makeTask({ slug: 'soft-deleted', is_deleted: true }),
    ];

    const view = buildDevTaskView(tasks, now);

    // live: 排除 is_deleted
    expect(view.live.map((t) => t.slug)).not.toContain('soft-deleted');

    // frontier: 排除已完成 + 排除 blocked；P0 内有 due_date 优先于无 due_date；
    // P2 内 overdue(有 due) 优先于无 due 的两个；同 priority + 同 due 时 stable sort
    // 按入参顺序（与老 frontier() 行为一致 —— 老 frontier 单测未覆盖 tie-breaker）。
    expect(view.frontier.map((t) => t.slug)).toEqual([
      'frontier-p0',
      'p0-active',
      'overdue',
      'in-progress',
      'created-this-week',
    ]);

    // inProgress: status='进行中' 的全部（包含 blocked —— blocked 不影响 inProgress 桶）；
    // sort_order 同为 0 时按入参 stable 顺序：frontier-p0, blocked；再排 sort_order=1 的 in-progress
    expect(view.inProgress.map((t) => t.slug)).toEqual([
      'frontier-p0',
      'blocked',
      'in-progress',
    ]);

    // completedThisWeek: 仅本周更新；updated_at 相同时按入参 stable 顺序
    expect(view.completedThisWeek.map((t) => t.slug)).toEqual([
      'done-this-week',
      'p0-done',
    ]);

    // doneLastWeekCount: 仅上周同口径
    expect(view.doneLastWeekCount).toBe(1);

    // createdThisWeekCount
    expect(view.createdThisWeekCount).toBe(1);

    // overdueCount: 有 due_date + < 今日 + 未完成
    expect(view.overdueCount).toBe(1);

    // urgentActiveCount: P0 + 未完成 —— frontier-p0, blocked, p0-active 都算
    expect(view.urgentActiveCount).toBe(3);

    // activeCount: 未完成 + 未删除 —— 9 条未删除 - 3 条已完成(done-this-week, p0-done, done-last-week) = 6
    expect(view.activeCount).toBe(6);

    // blockedCount: 未完成 + 有 blocked_by
    expect(view.blockedCount).toBe(1);

    // typeDistribution: 默认 4 类全键值
    expect(view.typeDistribution).toEqual({
      功能需求: 9,
      问题: 0,
      优化: 0,
      技术债: 0,
    });

    // userTaskCounts: 排除 is_deleted
    // user 1: frontier-p0, blocked, done-this-week, done-last-week, overdue, p0-active, p0-done = 7
    // user 2: in-progress, created-this-week = 2
    expect(view.userTaskCounts.get(1)).toBe(7);
    expect(view.userTaskCounts.get(2)).toBe(2);

    // byStatus 待评估按 sort_order 升序；sort_order 同为 0 时按入参 stable 顺序
    expect(view.byStatus['待评估'].map((t) => t.slug)).toEqual([
      'created-this-week',
      'overdue',
      'p0-active',
    ]);

    // columnCounts: 待评估/待排期→todo, 进行中→doing, 已搁置→paused, 已完成→done
    expect(view.columnCounts.get('todo')).toBe(3);
    expect(view.columnCounts.get('doing')).toBe(3);
    expect(view.columnCounts.get('paused')).toBe(0);
    expect(view.columnCounts.get('done')).toBe(3);

    // swimlanesByColumn: 每条 lane 内按 sort_order 升序
    const todoLanes = view.swimlanesByColumn.get('todo')!;
    expect(todoLanes.length).toBe(2);
    for (const lane of todoLanes) {
      const orders = lane.tasks.map((t) => t.sort_order ?? 0);
      const sorted = [...orders].sort((a, b) => a - b);
      expect(orders).toEqual(sorted);
    }
  });

  it('空数组下返回全 0 / 空集合（不抛错）', () => {
    const view = buildDevTaskView([], now);
    expect(view.frontier).toEqual([]);
    expect(view.inProgress).toEqual([]);
    expect(view.completedThisWeek).toEqual([]);
    expect(view.doneLastWeekCount).toBe(0);
    expect(view.createdThisWeekCount).toBe(0);
    expect(view.overdueCount).toBe(0);
    expect(view.urgentActiveCount).toBe(0);
    expect(view.activeCount).toBe(0);
    expect(view.blockedCount).toBe(0);
    expect(view.userTaskCounts.size).toBe(0);
    expect(view.columnCounts.get('todo')).toBe(0);
    expect(view.swimlanesByColumn.get('todo')).toEqual([]);
  });

  it('200 条随机任务下不抛错、不退化', () => {
    const tasks: DevTask[] = [];
    const statuses: DevTask['status'][] = [
      '待评估',
      '待排期',
      '进行中',
      '已搁置',
      '已完成',
    ];
    const priorities: DevTask['priority'][] = [
      'P0 紧急',
      'P1 高',
      'P2 中',
      'P3 低',
    ];
    const types: DevTask['type'][] = ['功能需求', '问题', '优化', '技术债'];

    for (let i = 0; i < 200; i++) {
      const status = statuses[i % statuses.length]!;
      const isDone = status === '已完成';
      tasks.push(
        makeTask({
          slug: `task-${i}`,
          status,
          priority: priorities[i % priorities.length]!,
          type: types[i % types.length]!,
          user_id: i % 5,
          sort_order: i,
          is_deleted: i % 17 === 0,
          due_date: i % 3 === 0 ? '2026-08-01' : '2026-08-30',
          created_at: '2026-08-04T08:00:00.000Z',
          updated_at: isDone ? '2026-08-04T10:00:00.000Z' : undefined,
        }),
      );
    }

    const view = buildDevTaskView(tasks, now);

    // 基础不变量
    expect(view.frontier.length).toBeGreaterThan(0);
    expect(view.userTaskCounts.size).toBeGreaterThan(0);
    expect(view.activeCount).toBeGreaterThan(0);

    // activeCount = frontier + blocked + 已搁置 + 待评估 + 待排期 + 进行中 - 已完成 - deleted
    const activeFromTasks = tasks.filter(
      (t) => !t.is_deleted && t.status !== '已完成',
    ).length;
    expect(view.activeCount).toBe(activeFromTasks);

    // live = tasks.filter(!is_deleted)
    expect(view.live.length).toBe(tasks.filter((t) => !t.is_deleted).length);
  });
});
