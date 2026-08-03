import { devTaskGateway } from '@/features/todos/api';
import type {
  CreateDevTaskPayload,
  DevTask,
  DevTaskStatus,
  UpdateDevTaskPayload,
} from '@/features/todos/api';
import { useNotificationStore } from '@/stores';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import {
  buildDevTaskView,
  nextStatus,
  planSyncColumn,
  V3_STATUSES,
  type DevTaskView,
} from '@/features/todos/composables/devTaskPolicy';

export { V3_STATUSES };

export const useV3DevTaskStore = defineStore('v3-devtasks', () => {
  const tasks = ref<DevTask[]>([]);
  const loading = ref(false);
  const notifier = useNotificationStore();

  /**
   * 派生视图 —— 4 个 panel 共享。
   * 只在 `tasks` 引用变化时重算一次（Vue `computed` 自带缓存）。
   * 之前每个 panel 各自 filter/sort 全量数组，200 条规模下切一次 tab 峰值 ~15+ 次遍历。
   */
  const derived = computed<DevTaskView>(() => buildDevTaskView(tasks.value));

  async function fetchTasks(): Promise<void> {
    // 首次加载显示骨架屏（loading=true），后续刷新静默替换（loading 不变）
    const isFirstLoad = tasks.value.length === 0;
    if (isFirstLoad) loading.value = true;
    try {
      const res = await devTaskGateway.list({ per_page: 200 });
      tasks.value = res.tasks.filter((t) => !t.is_deleted);
    } catch (err) {
      if (err instanceof Error) {
        notifier.error(err.message);
      } else {
        notifier.error('获取任务失败');
      }
      console.error('fetch v3 devtasks error:', err);
    } finally {
      if (isFirstLoad) loading.value = false;
    }
  }

  async function createTask(
    payload: CreateDevTaskPayload,
  ): Promise<DevTask | null> {
    try {
      const task = await devTaskGateway.create(payload);
      tasks.value = [task, ...tasks.value];
      return task;
    } catch (err) {
      if (err instanceof Error) {
        notifier.error(err.message);
      } else {
        notifier.error('创建任务失败');
      }
      console.error('create v3 devtask error:', err);
      return null;
    }
  }

  async function updateTask(
    slug: string,
    patch: UpdateDevTaskPayload,
  ): Promise<boolean> {
    // 乐观更新：只替换目标条目，其它元素引用保持不变。
    // 这比 `tasks.value.map(...)` 省下 n-1 次浅拷贝 + 让 derived 只在 patch 真正改变
    // 派生字段时才失效重算。
    const idx = tasks.value.findIndex((t) => t.slug === slug);
    if (idx >= 0) {
      const next = tasks.value.slice();
      next[idx] = { ...next[idx], ...patch };
      tasks.value = next;
    }
    try {
      await devTaskGateway.update(slug, patch);
      return true;
    } catch (err) {
      // 后端失败 → 回滚
      await fetchTasks();
      if (err instanceof Error) {
        notifier.error(err.message);
      } else {
        notifier.error('更新任务失败');
      }
      console.error('update v3 devtask error:', err);
      return false;
    }
  }

  async function cycleStatus(slug: string): Promise<void> {
    const t = tasks.value.find((x) => x.slug === slug);
    if (!t) return;
    await updateTask(slug, { status: nextStatus(t.status) });
  }

  /** 软删除（默认删除语义）。UI 上"永久删除"调用 hardDeleteTask。 */
  async function deleteTask(slug: string): Promise<void> {
    try {
      await devTaskGateway.remove(slug);
      tasks.value = tasks.value.filter((t) => t.slug !== slug);
    } catch (err) {
      console.error('delete v3 devtask error:', err);
      notifier.error('删除任务失败');
    }
  }

  async function hardDeleteTask(slug: string): Promise<void> {
    try {
      await devTaskGateway.hardDelete(slug);
      tasks.value = tasks.value.filter((t) => t.slug !== slug);
    } catch (err) {
      console.error('hard delete v3 devtask error:', err);
      notifier.error('永久删除失败');
    }
  }

  /**
   * 拖拽跨列后批量同步：先用 policy 做不可变重排，再按差异逐条 PATCH。
   * 仅当 status / sort_order 真的变了才打后端。
   */
  async function syncColumn(
    status: DevTaskStatus,
    orderedSlugs: string[],
  ): Promise<void> {
    tasks.value = planSyncColumn(tasks.value, status, orderedSlugs);

    for (const [idx, slug] of orderedSlugs.entries()) {
      const original = tasks.value.find((x) => x.slug === slug);
      if (!original) continue;
      if (original.status === status && original.sort_order === idx) continue;
      try {
        await devTaskGateway.update(slug, { status, sort_order: idx });
      } catch (err) {
        console.error('sync column error:', err);
        notifier.error('排序同步失败');
        return;
      }
    }
  }

  return {
    tasks,
    loading,
    derived,
    V3_STATUSES,
    fetchTasks,
    createTask,
    updateTask,
    cycleStatus,
    deleteTask,
    hardDeleteTask,
    syncColumn,
  };
});
