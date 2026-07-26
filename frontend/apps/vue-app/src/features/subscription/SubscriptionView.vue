<script setup lang="ts">
import { BasicDetail } from '@/components';
import { formatDate } from '@/lib/dayjs';
import ReminderConfigModal from './components/ReminderConfigModal.vue';
import SubscriptionCardList from './components/SubscriptionCardList.vue';
import SubscriptionDetailPanel from './components/SubscriptionDetailPanel.vue';
import SubscriptionFormModal from './components/SubscriptionFormModal.vue';
import SubscriptionStatsPanel from './components/SubscriptionStatsPanel.vue';
import { useReminderConfig } from './composables/useReminderConfig';
import { useSubscriptions } from './composables/useSubscriptions';
import {
  currencySuggestions,
  formatPrice,
  getCycleLabel,
  getDaysUntil,
  getReminderChannelsText,
  getReminderPointsText,
  getStatusMeta,
  toDateInputValue,
} from './subscriptionUtils';
import { onMounted } from 'vue';

const {
  subscriptions,
  isLoading,
  isRefreshing,
  errorMessage,
  selectedSubId,
  isAddModalOpen,
  isEditModalOpen,
  createForm,
  editForm,
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
} = useSubscriptions();

const {
  isReminderModalOpen,
  reminderForm,
  reminderFormError,
  isSavingReminder,
  isTestingReminder,
  reminderTestResult,
  openReminderModal,
  handleSaveReminderConfigFromForm,
  handleTestNotificationFromForm,
} = useReminderConfig(subscriptions);

onMounted(() => {
  void fetchSubscriptions();
});
</script>

<template>
  <BasicDetail
    title="SubTracker | 订阅管理"
    subtitle="桌面端统一管理订阅信息、账单周期与通知配置"
  >
    <div class="col-span-full mx-auto w-full max-w-6xl space-y-8">
      <SubscriptionStatsPanel
        :total-count="subscriptions.length"
        :active-count="activeCount"
        :monthly-estimate="monthlyEstimate"
        :due-soon-count="dueSoonCount"
        :is-loading="isLoading"
        :is-refreshing="isRefreshing"
        @refresh="fetchSubscriptions"
        @add="openAddModal"
      />

      <div class="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)]">
        <SubscriptionCardList
          :subscriptions="sortedSubscriptions"
          :selected-sub-id="selectedSubId"
          :is-loading="isLoading"
          :error-message="errorMessage"
          :pending-status-id="pendingStatusId"
          :delete-pending-id="deletePendingId"
          :to-date-input-value="toDateInputValue"
          :get-days-until="getDaysUntil"
          :get-cycle-label="getCycleLabel"
          :format-price="formatPrice"
          :get-status-meta="getStatusMeta"
          :get-reminder-channels-text="getReminderChannelsText"
          :get-reminder-points-text="getReminderPointsText"
          @select="selectedSubId = $event"
          @retry="fetchSubscriptions"
          @edit="openEditModal"
          @reminder="openReminderModal"
          @toggle-status="handleToggleStatus"
          @delete="handleDeleteSubscription"
        />

        <SubscriptionDetailPanel
          :selected-subscription="selectedSubscription"
          :pending-status-id="pendingStatusId"
          :delete-pending-id="deletePendingId"
          :to-date-input-value="toDateInputValue"
          :get-cycle-label="getCycleLabel"
          :format-price="formatPrice"
          :format-date="formatDate"
          :get-status-meta="getStatusMeta"
          :get-reminder-channels-text="getReminderChannelsText"
          :get-reminder-points-text="getReminderPointsText"
          @edit="openEditModal"
          @reminder="openReminderModal"
          @toggle-status="handleToggleStatus"
          @delete="handleDeleteSubscription"
        />
      </div>
    </div>

    <Teleport to="body">
      <SubscriptionFormModal
        mode="create"
        :is-open="isAddModalOpen"
        title="新增订阅"
        description="创建新的订阅记录，默认状态为进行中。"
        submit-text="确认创建"
        loading-text="创建中..."
        :is-submitting="isCreating"
        :form="createForm"
        :error-message="addFormError"
        :currency-suggestions="currencySuggestions"
        @close="isAddModalOpen = false"
        @submit="handleCreateSubscription"
      />
    </Teleport>

    <Teleport to="body">
      <SubscriptionFormModal
        mode="edit"
        :is-open="isEditModalOpen"
        title="编辑订阅"
        description="更新订阅信息、状态和账单日期。"
        submit-text="保存更改"
        loading-text="保存中..."
        :is-submitting="isUpdating"
        :form="editForm"
        :error-message="editFormError"
        :currency-suggestions="currencySuggestions"
        :include-status="true"
        @close="isEditModalOpen = false"
        @submit="handleUpdateSubscription"
      />
    </Teleport>

    <Teleport to="body">
      <ReminderConfigModal
        :is-open="isReminderModalOpen"
        :form="reminderForm"
        :is-testing="isTestingReminder"
        :is-saving="isSavingReminder"
        :error-message="reminderFormError"
        :test-result="reminderTestResult"
        @close="isReminderModalOpen = false"
        @test="handleTestNotificationFromForm"
        @save="handleSaveReminderConfigFromForm"
      />
    </Teleport>
  </BasicDetail>
</template>
