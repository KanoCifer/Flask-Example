import { computed, type ComputedRef, type Ref } from 'vue';

import type { DevTask } from '@/features/todos/api';
import { inProgress, priorityWeight } from './devTaskPolicy';

/** Drawer / island 共用的三段 section 派生。 */
export interface DevTaskSection {
  key: 'in-progress' | 'upcoming' | 'done';
  title: string;
  tasks: DevTask[];
  dotClass: string;
  emptyText: string;
}

/**
 * 把原始 tasks 列表派生为 activeCount + 三段 section，供 TaskDrawer / DynamicIsland 共享。
 * 纯派生：不发请求、不动 store；调用方负责注入 tasks ref。
 */
export function useDevTaskSections(tasks: Ref<DevTask[]>) {
  const activeCount = computed(
    () =>
      tasks.value.filter((t) => !t.is_deleted && t.status !== '已完成').length,
  );

  const inProgressTasks = computed(() => inProgress(tasks.value));

  // 待排期 = 未启动 / 已搁置，按 priorityWeight 升序（P0 在前）
  const upcomingTasks = computed(() =>
    tasks.value
      .filter(
        (t) =>
          !t.is_deleted &&
          (t.status === '待评估' ||
            t.status === '待排期' ||
            t.status === '已搁置'),
      )
      .sort((a, b) => priorityWeight(a.priority) - priorityWeight(b.priority)),
  );

  // 已完成只取最近 8 条（按列表原序，前端 store 已是 updated_at 倒序）
  const doneTasks = computed(() =>
    tasks.value
      .filter((t) => !t.is_deleted && t.status === '已完成')
      .slice(0, 8),
  );

  // 整组 section 也是一个 ComputedRef，template 顶层自动 unwrap 后每项 tasks 是普通数组。
  const sections: ComputedRef<DevTaskSection[]> = computed(() => [
    {
      key: 'in-progress',
      title: '开发中',
      tasks: inProgressTasks.value,
      dotClass: 'bg-accent',
      emptyText: '没有进行中的任务',
    },
    {
      key: 'upcoming',
      title: '待排期',
      tasks: upcomingTasks.value,
      dotClass: 'bg-chart-3',
      emptyText: '没有待排期任务',
    },
    {
      key: 'done',
      title: '已完成',
      tasks: doneTasks.value,
      dotClass: 'bg-emerald-500',
      emptyText: '没有已完成任务',
    },
  ]);

  return {
    activeCount,
    inProgressTasks,
    upcomingTasks,
    doneTasks,
    sections,
  };
}
