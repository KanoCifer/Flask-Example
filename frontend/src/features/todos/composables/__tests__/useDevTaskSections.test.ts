import { describe, it, expect } from 'vitest';
import { ref } from 'vue';

import { useDevTaskSections } from '../useDevTaskSections';
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
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ── activeCount ──────────────────────────────────────────────────────────

describe('useDevTaskSections · activeCount', () => {
  it('排除已软删除', () => {
    const tasks = ref<DevTask[]>([
      makeTask({ slug: 'a', is_deleted: true }),
      makeTask({ slug: 'b' }),
    ]);
    const { activeCount } = useDevTaskSections(tasks);
    expect(activeCount.value).toBe(1);
  });

  it('排除已完成', () => {
    const tasks = ref<DevTask[]>([
      makeTask({ slug: 'a', status: '已完成' }),
      makeTask({ slug: 'b', status: '进行中' }),
      makeTask({ slug: 'c', status: '待评估' }),
    ]);
    const { activeCount } = useDevTaskSections(tasks);
    expect(activeCount.value).toBe(2);
  });

  it('空数组返回 0', () => {
    const tasks = ref<DevTask[]>([]);
    const { activeCount } = useDevTaskSections(tasks);
    expect(activeCount.value).toBe(0);
  });
});

// ── inProgressTasks ──────────────────────────────────────────────────────

describe('useDevTaskSections · inProgressTasks', () => {
  it('走 devTaskPolicy.inProgress（仅 status === "进行中"，排除软删除）', () => {
    const tasks = ref<DevTask[]>([
      makeTask({ slug: 'a', status: '进行中', sort_order: 2 }),
      makeTask({ slug: 'b', status: '进行中', sort_order: 0 }),
      makeTask({
        slug: 'c',
        status: '进行中',
        is_deleted: true,
        sort_order: 1,
      }),
      makeTask({ slug: 'd', status: '待评估' }),
    ]);
    const { inProgressTasks } = useDevTaskSections(tasks);
    expect(inProgressTasks.value.map((t) => t.slug)).toEqual(['b', 'a']);
  });
});

// ── upcomingTasks ────────────────────────────────────────────────────────

describe('useDevTaskSections · upcomingTasks', () => {
  it('包含 待评估 / 待排期 / 已搁置 三种状态', () => {
    const tasks = ref<DevTask[]>([
      makeTask({ slug: 'a', status: '待评估' }),
      makeTask({ slug: 'b', status: '待排期' }),
      makeTask({ slug: 'c', status: '已搁置' }),
      makeTask({ slug: 'd', status: '进行中' }),
      makeTask({ slug: 'e', status: '已完成' }),
    ]);
    const { upcomingTasks } = useDevTaskSections(tasks);
    expect(upcomingTasks.value.map((t) => t.slug)).toEqual(['a', 'b', 'c']);
  });

  it('排除已软删除', () => {
    const tasks = ref<DevTask[]>([
      makeTask({ slug: 'a', status: '待评估' }),
      makeTask({ slug: 'b', status: '待评估', is_deleted: true }),
    ]);
    const { upcomingTasks } = useDevTaskSections(tasks);
    expect(upcomingTasks.value.map((t) => t.slug)).toEqual(['a']);
  });

  it('按 priorityWeight 升序（P0 → P3）', () => {
    const tasks = ref<DevTask[]>([
      makeTask({ slug: 'p3', status: '待评估', priority: 'P3 低' }),
      makeTask({ slug: 'p0', status: '待排期', priority: 'P0 紧急' }),
      makeTask({ slug: 'p2', status: '已搁置', priority: 'P2 中' }),
      makeTask({ slug: 'p1', status: '待评估', priority: 'P1 高' }),
    ]);
    const { upcomingTasks } = useDevTaskSections(tasks);
    expect(upcomingTasks.value.map((t) => t.slug)).toEqual([
      'p0',
      'p1',
      'p2',
      'p3',
    ]);
  });

  it('同优先级保持原序（稳定排序）', () => {
    const tasks = ref<DevTask[]>([
      makeTask({ slug: 'a', status: '待评估', priority: 'P1 高' }),
      makeTask({ slug: 'b', status: '待评估', priority: 'P1 高' }),
      makeTask({ slug: 'c', status: '待评估', priority: 'P1 高' }),
    ]);
    const { upcomingTasks } = useDevTaskSections(tasks);
    expect(upcomingTasks.value.map((t) => t.slug)).toEqual(['a', 'b', 'c']);
  });
});

// ── doneTasks ────────────────────────────────────────────────────────────

describe('useDevTaskSections · doneTasks', () => {
  it('只保留 status === "已完成" 且未软删除', () => {
    const tasks = ref<DevTask[]>([
      makeTask({ slug: 'a', status: '已完成' }),
      makeTask({ slug: 'b', status: '已完成', is_deleted: true }),
      makeTask({ slug: 'c', status: '进行中' }),
    ]);
    const { doneTasks } = useDevTaskSections(tasks);
    expect(doneTasks.value.map((t) => t.slug)).toEqual(['a']);
  });

  it('截前 8 条', () => {
    const tasks = ref<DevTask[]>(
      Array.from({ length: 12 }, (_, i) =>
        makeTask({ slug: `d${i}`, status: '已完成' }),
      ),
    );
    const { doneTasks } = useDevTaskSections(tasks);
    expect(doneTasks.value).toHaveLength(8);
    expect(doneTasks.value[0].slug).toBe('d0');
    expect(doneTasks.value[7].slug).toBe('d7');
  });

  it('不足 8 条全部返回', () => {
    const tasks = ref<DevTask[]>([
      makeTask({ slug: 'a', status: '已完成' }),
      makeTask({ slug: 'b', status: '已完成' }),
    ]);
    const { doneTasks } = useDevTaskSections(tasks);
    expect(doneTasks.value).toHaveLength(2);
  });
});

// ── sections ─────────────────────────────────────────────────────────────

describe('useDevTaskSections · sections', () => {
  it('产出三段固定顺序：in-progress / upcoming / done', () => {
    const tasks = ref<DevTask[]>([]);
    const { sections } = useDevTaskSections(tasks);
    expect(sections.value.map((s) => s.key)).toEqual([
      'in-progress',
      'upcoming',
      'done',
    ]);
  });

  it('每段带 title / dotClass / emptyText', () => {
    const tasks = ref<DevTask[]>([]);
    const { sections } = useDevTaskSections(tasks);
    expect(sections.value[0].title).toBe('开发中');
    expect(sections.value[0].dotClass).toBe('bg-accent');
    expect(sections.value[0].emptyText).toBe('没有进行中的任务');

    expect(sections.value[1].title).toBe('待排期');
    expect(sections.value[1].dotClass).toBe('bg-chart-3');
    expect(sections.value[1].emptyText).toBe('没有待排期任务');

    expect(sections.value[2].title).toBe('已完成');
    expect(sections.value[2].dotClass).toBe('bg-emerald-500');
    expect(sections.value[2].emptyText).toBe('没有已完成任务');
  });

  it('每段 tasks 是 ComputedRef，模板自动 unwrap 正确', () => {
    const tasks = ref<DevTask[]>([
      makeTask({ slug: 'a', status: '进行中' }),
      makeTask({ slug: 'b', status: '待评估' }),
      makeTask({ slug: 'c', status: '已完成' }),
    ]);
    const { sections } = useDevTaskSections(tasks);
    expect(sections.value[0].tasks.map((t) => t.slug)).toEqual(['a']);
    expect(sections.value[1].tasks.map((t) => t.slug)).toEqual(['b']);
    expect(sections.value[2].tasks.map((t) => t.slug)).toEqual(['c']);
  });
});

// ── 响应式 ──────────────────────────────────────────────────────────────

describe('useDevTaskSections · reactivity', () => {
  it('tasks 变化后所有派生同步更新', () => {
    const tasks = ref<DevTask[]>([]);
    const { activeCount, sections } = useDevTaskSections(tasks);

    expect(activeCount.value).toBe(0);

    tasks.value = [makeTask({ slug: 'a', status: '进行中' })];
    expect(activeCount.value).toBe(1);
    expect(sections.value[0].tasks.map((t) => t.slug)).toEqual(['a']);

    tasks.value = [
      makeTask({ slug: 'a', status: '进行中' }),
      makeTask({ slug: 'b', status: '已完成' }),
    ];
    expect(activeCount.value).toBe(1);
    expect(sections.value[2].tasks.map((t) => t.slug)).toEqual(['b']);
  });
});
