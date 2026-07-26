import { subscriptionGateway } from '@/features/rss';
import { useNotificationStore } from '@/stores';
import {
  applyFormValues,
  createDefaultSubscriptionForm,
  getDaysUntil,
  getMonthlyEstimate,
  mapSubscriptionToForm,
  toCreatePayload,
  toUpdatePayload,
  upsertSubscription,
  validateSubscriptionForm,
} from '@/features/subscription/subscriptionUtils';
import type {
  Subscription,
  SubscriptionFormState,
} from '@/features/subscription/types';
import type { AxiosError } from 'axios';
import { computed, reactive, ref } from 'vue';

function extractErrorMessage(error: unknown, fallbackMessage: string): string {
  const axiosError = error as AxiosError<{ message?: string }>;
  return (
    axiosError.response?.data?.message ??
    (error instanceof Error ? error.message : fallbackMessage)
  );
}

export const useSubscriptions = () => {
  const notifier = useNotificationStore();

  const subscriptions = ref<Subscription[]>([]);
  const isLoading = ref<boolean>(false);
  const isRefreshing = ref<boolean>(false);
  const errorMessage = ref<string>('');
  const selectedSubId = ref<number | null>(null);

  const isAddModalOpen = ref<boolean>(false);
  const isEditModalOpen = ref<boolean>(false);
  const createForm = reactive<SubscriptionFormState>(
    createDefaultSubscriptionForm(),
  );
  const editForm = reactive<SubscriptionFormState>(
    createDefaultSubscriptionForm(),
  );
  const editTargetId = ref<number | null>(null);

  const addFormError = ref<string>('');
  const editFormError = ref<string>('');

  const isCreating = ref<boolean>(false);
  const isUpdating = ref<boolean>(false);
  const pendingStatusId = ref<number | null>(null);
  const deletePendingId = ref<number | null>(null);

  const sortedSubscriptions = computed<Subscription[]>(() =>
    [...subscriptions.value].sort((a, b) => {
      const aTime = new Date(a.next_billing_date).getTime();
      const bTime = new Date(b.next_billing_date).getTime();
      return aTime - bTime;
    }),
  );

  const selectedSubscription = computed<Subscription | null>(() => {
    if (selectedSubId.value === null) return null;
    return (
      subscriptions.value.find((item) => item.id === selectedSubId.value) ??
      null
    );
  });

  const activeCount = computed<number>(
    () => subscriptions.value.filter((item) => item.status === 'active').length,
  );

  const monthlyEstimate = computed<number>(() =>
    subscriptions.value
      .filter((item) => item.status === 'active')
      .reduce((total, item) => total + getMonthlyEstimate(item), 0),
  );

  const dueSoonCount = computed<number>(
    () =>
      subscriptions.value.filter(
        (item) =>
          item.status === 'active' && getDaysUntil(item.next_billing_date) <= 7,
      ).length,
  );

  async function fetchSubscriptions(): Promise<void> {
    errorMessage.value = '';
    const showSkeleton = subscriptions.value.length === 0;
    if (showSkeleton) {
      isLoading.value = true;
    } else {
      isRefreshing.value = true;
    }

    try {
      const data = await subscriptionGateway.getSubscriptions();
      subscriptions.value = data;
      if (data.length === 0) {
        selectedSubId.value = null;
        return;
      }
      const selectedStillExists =
        selectedSubId.value !== null &&
        data.some((item) => item.id === selectedSubId.value);
      if (!selectedStillExists) {
        selectedSubId.value = data[0].id;
      }
    } catch (error) {
      const message = extractErrorMessage(
        error,
        '加载订阅列表失败，请稍后重试。',
      );
      errorMessage.value = message;
      notifier.error(message);
    } finally {
      isLoading.value = false;
      isRefreshing.value = false;
    }
  }

  function openAddModal(): void {
    addFormError.value = '';
    applyFormValues(createForm, createDefaultSubscriptionForm());
    isAddModalOpen.value = true;
  }

  async function handleCreateSubscription(
    form: SubscriptionFormState,
  ): Promise<void> {
    addFormError.value = '';
    const validationError = validateSubscriptionForm(form);
    if (validationError) {
      addFormError.value = validationError;
      return;
    }

    isCreating.value = true;
    try {
      const created = await subscriptionGateway.createSubscription(
        toCreatePayload(form),
      );
      subscriptions.value = [created, ...subscriptions.value];
      selectedSubId.value = created.id;
      isAddModalOpen.value = false;
      notifier.success('订阅创建成功');
    } catch (error) {
      addFormError.value = extractErrorMessage(
        error,
        '创建订阅失败，请稍后重试。',
      );
    } finally {
      isCreating.value = false;
    }
  }

  function openEditModal(subscription: Subscription): void {
    editTargetId.value = subscription.id;
    editFormError.value = '';
    applyFormValues(editForm, mapSubscriptionToForm(subscription));
    isEditModalOpen.value = true;
  }

  async function handleUpdateSubscription(
    form: SubscriptionFormState,
  ): Promise<void> {
    if (editTargetId.value === null) return;

    editFormError.value = '';
    const validationError = validateSubscriptionForm(form);
    if (validationError) {
      editFormError.value = validationError;
      return;
    }

    isUpdating.value = true;
    try {
      const updated = await subscriptionGateway.updateSubscription(
        editTargetId.value,
        toUpdatePayload(form),
      );
      subscriptions.value = upsertSubscription(subscriptions.value, updated);
      isEditModalOpen.value = false;
      notifier.success('订阅信息已更新');
    } catch (error) {
      editFormError.value = extractErrorMessage(
        error,
        '更新订阅失败，请稍后重试。',
      );
    } finally {
      isUpdating.value = false;
    }
  }

  async function handleToggleStatus(subscription: Subscription): Promise<void> {
    const nextStatus = subscription.status === 'active' ? 'paused' : 'active';
    pendingStatusId.value = subscription.id;
    try {
      const updated = await subscriptionGateway.updateStatus(
        subscription.id,
        nextStatus,
      );
      subscriptions.value = upsertSubscription(subscriptions.value, updated);
      notifier.success(nextStatus === 'paused' ? '订阅已暂停' : '订阅已恢复');
    } catch (error) {
      notifier.error(extractErrorMessage(error, '更新状态失败，请稍后重试。'));
    } finally {
      pendingStatusId.value = null;
    }
  }

  async function handleDeleteSubscription(
    subscription: Subscription,
  ): Promise<void> {
    const shouldDelete = window.confirm(
      `确定要删除「${subscription.name}」吗？此操作不可撤销。`,
    );
    if (!shouldDelete) return;

    deletePendingId.value = subscription.id;
    try {
      await subscriptionGateway.deleteSubscription(subscription.id);
      subscriptions.value = subscriptions.value.filter(
        (item) => item.id !== subscription.id,
      );
      if (selectedSubId.value === subscription.id) {
        selectedSubId.value =
          subscriptions.value.length > 0 ? subscriptions.value[0].id : null;
      }
      notifier.success('订阅已删除');
    } catch (error) {
      notifier.error(extractErrorMessage(error, '删除订阅失败，请稍后重试。'));
    } finally {
      deletePendingId.value = null;
    }
  }

  return {
    subscriptions,
    isLoading,
    isRefreshing,
    errorMessage,
    selectedSubId,
    isAddModalOpen,
    isEditModalOpen,
    createForm,
    editForm,
    editTargetId,
    addFormError,
    editFormError,
    isCreating,
    isUpdating,
    pendingStatusId,
    deletePendingId,
    sortedSubscriptions,
    selectedSubscription,
    activeCount,
    monthlyEstimate,
    dueSoonCount,
    fetchSubscriptions,
    openAddModal,
    handleCreateSubscription,
    openEditModal,
    handleUpdateSubscription,
    handleToggleStatus,
    handleDeleteSubscription,
  };
};
