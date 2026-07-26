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
