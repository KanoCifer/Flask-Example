import { devTaskGateway } from '@/features/todos/api';
import type {
  CreateDevTaskPayload,
  DevTask,
  DevTaskStatus,
  UpdateDevTaskPayload,
} from '@/features/todos/api';
import { useNotificationStore } from '@/stores';
import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  nextStatus,
  planSyncColumn,
  V3_STATUSES,
} from '@/features/todos/composables/devTaskPolicy';

// 重新导出供未迁移的消费方（如 router meta）继续使用 V3_STATUSES。
export { V3_STATUSES };

export const useV3DevTaskStore = defineStore('v3-devtasks', () => {
  const tasks = ref<DevTask[]>([]);
  const loading = ref(false);
  const notifier = useNotificationStore();

  async function fetchTasks(): Promise<void> {
    loading.value = true;
    try {
      // 看板展示全量；v3 分页默认 per_page=10，提高到 200 覆盖个人工作台量级。
      const res = await devTaskGateway.list({ per_page: 200 });
      // 过滤已软删除的；后端 filter 默认 is_deleted=false，此处做防御性兜底
      tasks.value = res.tasks.filter((t) => !t.is_deleted);
    } catch (err) {
      console.error('fetch v3 devtasks error:', err);
      notifier.error('加载开发任务失败');
    } finally {
      loading.value = false;
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
      console.error('create v3 devtask error:', err);
      notifier.error('创建任务失败');
      return null;
    }
  }

  async function updateTask(
    slug: string,
    patch: UpdateDevTaskPayload,
  ): Promise<boolean> {
    try {
      await devTaskGateway.update(slug, patch);
      tasks.value = tasks.value.map((t) =>
        t.slug === slug ? { ...t, ...patch } : t,
      );
      return true;
    } catch (err) {
      console.error('update v3 devtask error:', err);
      notifier.error('更新任务失败');
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
