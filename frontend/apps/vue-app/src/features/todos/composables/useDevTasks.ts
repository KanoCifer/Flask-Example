import { ref } from 'vue';

import { devTaskGateway } from '@/features/todos/api';
import type {
  CreateDevTaskPayload,
  DevTask,
  DevTaskListResponse,
  ListDevTasksParams,
  UpdateDevTaskPayload,
} from '@/features/todos/api';
import { useNotificationStore } from '@/stores';

export const useDevTasks = () => {
  const notifier = useNotificationStore();

  const tasks = ref<DevTask[]>([]);
  const pagination = ref<DevTaskListResponse['pagination'] | null>(null);
  const loading = ref(false);
  const error = ref('');

  const fetchTasks = async (params?: ListDevTasksParams): Promise<void> => {
    loading.value = true;
    error.value = '';

    try {
      const data = await devTaskGateway.list(params);
      tasks.value = data.tasks;
      pagination.value = data.pagination;
    } catch (err: unknown) {
      console.error('fetch dev tasks error:', err);
      error.value = err instanceof Error ? err.message : '加载任务失败';
      notifier.error(error.value);
    } finally {
      loading.value = false;
    }
  };

  const getTask = async (id: string): Promise<DevTask | null> => {
    try {
      return await devTaskGateway.get(id);
    } catch (err: unknown) {
      console.error('get dev task error:', err);
      notifier.error(err instanceof Error ? err.message : '获取任务失败');
      return null;
    }
  };

  const createTask = async (
    payload: CreateDevTaskPayload,
  ): Promise<DevTask | null> => {
    try {
      const task = await devTaskGateway.create(payload);
      notifier.success('任务创建成功');
      return task;
    } catch (err: unknown) {
      console.error('create dev task error:', err);
      notifier.error(err instanceof Error ? err.message : '创建任务失败');
      return null;
    }
  };

  const updateTask = async (
    id: string,
    payload: UpdateDevTaskPayload,
  ): Promise<boolean> => {
    try {
      await devTaskGateway.update(id, payload);
      notifier.success('任务更新成功');
      return true;
    } catch (err: unknown) {
      console.error('update dev task error:', err);
      notifier.error(err instanceof Error ? err.message : '更新任务失败');
      return false;
    }
  };

  const deleteTask = async (id: string): Promise<boolean> => {
    try {
      await devTaskGateway.remove(id);
      notifier.success('任务已删除');
      return true;
    } catch (err: unknown) {
      console.error('delete dev task error:', err);
      notifier.error(err instanceof Error ? err.message : '删除任务失败');
      return false;
    }
  };

  const hardDeleteTask = async (id: string): Promise<boolean> => {
    const confirmed = window.confirm('确定永久删除该任务？此操作不可撤销。');
    if (!confirmed) {
      return false;
    }
    try {
      await devTaskGateway.hardDelete(id);
      notifier.success('任务已永久删除');
      return true;
    } catch (err: unknown) {
      console.error('hard delete dev task error:', err);
      notifier.error(err instanceof Error ? err.message : '永久删除失败');
      return false;
    }
  };

  return {
    tasks,
    pagination,
    loading,
    error,
    fetchTasks,
    getTask,
    createTask,
    updateTask,
    deleteTask,
    hardDeleteTask,
  };
};
