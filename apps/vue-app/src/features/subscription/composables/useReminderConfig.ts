import { subscriptionGateway } from '@/features/rss';
import { useNotificationStore } from '@/stores';
import {
  applyReminderFormValues,
  createDefaultReminderForm,
  createReminderFormState,
  createReminderPayload,
  hasEnabledReminderPoint,
  upsertSubscription,
} from '@/features/subscription/subscriptionUtils';
import type {
  ReminderFormState,
  Subscription,
  TestNotificationPayload,
} from '@/features/subscription/types';
import type { AxiosError } from 'axios';
import { reactive, ref, type Ref } from 'vue';

function extractErrorMessage(error: unknown, fallbackMessage: string): string {
  const axiosError = error as AxiosError<{ message?: string }>;
  return (
    axiosError.response?.data?.message ??
    (error instanceof Error ? error.message : fallbackMessage)
  );
}

export const useReminderConfig = (subscriptions: Ref<Subscription[]>) => {
  const notifier = useNotificationStore();

  const isReminderModalOpen = ref<boolean>(false);
  const reminderForm = reactive<ReminderFormState>(createDefaultReminderForm());
  const reminderTargetId = ref<number | null>(null);
  const reminderFormError = ref<string>('');
  const isSavingReminder = ref<boolean>(false);
  const isTestingReminder = ref<boolean>(false);
  const reminderTestResult = ref<Record<string, boolean> | null>(null);

  function openReminderModal(subscription: Subscription): void {
    reminderTargetId.value = subscription.id;
    reminderFormError.value = '';
    reminderTestResult.value = null;
    applyReminderFormValues(
      reminderForm,
      createReminderFormState(subscription.reminder_config),
    );
    isReminderModalOpen.value = true;
  }

  function syncReminderForm(source: ReminderFormState): void {
    applyReminderFormValues(reminderForm, source);
  }

  async function handleSaveReminderConfig(): Promise<void> {
    if (reminderTargetId.value === null) return;

    reminderFormError.value = '';
    if (reminderForm.channels.length === 0) {
      reminderFormError.value = '请至少选择一个通知渠道。';
      return;
    }
    if (!hasEnabledReminderPoint(reminderForm)) {
      reminderFormError.value = '请至少选择一个提醒时间点。';
      return;
    }

    isSavingReminder.value = true;
    try {
      const updated = await subscriptionGateway.updateReminders(
        reminderTargetId.value,
        createReminderPayload(reminderForm),
      );
      subscriptions.value = upsertSubscription(subscriptions.value, updated);
      isReminderModalOpen.value = false;
      notifier.success('通知配置已保存');
    } catch (error) {
      reminderFormError.value = extractErrorMessage(
        error,
        '保存通知配置失败，请稍后重试。',
      );
    } finally {
      isSavingReminder.value = false;
    }
  }

  async function handleSaveReminderConfigFromForm(
    form: ReminderFormState,
  ): Promise<void> {
    syncReminderForm(form);
    await handleSaveReminderConfig();
  }

  async function handleTestNotification(): Promise<void> {
    if (reminderTargetId.value === null) return;

    reminderFormError.value = '';
    reminderTestResult.value = null;
    if (reminderForm.channels.length === 0) {
      reminderFormError.value = '测试前请先选择至少一个通知渠道。';
      return;
    }

    isTestingReminder.value = true;
    try {
      const payload: TestNotificationPayload = {
        channels: reminderForm.channels,
        config: createReminderPayload(reminderForm),
      };
      const result = await subscriptionGateway.testNotification(
        reminderTargetId.value,
        payload,
      );
      reminderTestResult.value = result;
      const successCount = Object.values(result).filter(Boolean).length;
      if (successCount > 0) {
        notifier.success(
          `测试通知发送成功（${successCount}/${payload.channels.length}）`,
        );
      } else {
        notifier.error('测试通知发送失败，请检查渠道配置。');
      }
    } catch (error) {
      reminderFormError.value = extractErrorMessage(
        error,
        '测试通知失败，请稍后重试。',
      );
    } finally {
      isTestingReminder.value = false;
    }
  }

  async function handleTestNotificationFromForm(
    form: ReminderFormState,
  ): Promise<void> {
    syncReminderForm(form);
    await handleTestNotification();
  }

  return {
    isReminderModalOpen,
    reminderForm,
    reminderTargetId,
    reminderFormError,
    isSavingReminder,
    isTestingReminder,
    reminderTestResult,
    openReminderModal,
    handleSaveReminderConfigFromForm,
    handleTestNotificationFromForm,
  };
};
