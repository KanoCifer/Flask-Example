<template>
  <BasicDetail title="设备管理" subtitle="追踪你的电子设备资产与价格">
    <div
      id="device-tracker-content"
      class="col-span-full mx-auto w-full max-w-6xl space-y-8"
    >
      <!-- Summary Cards Section -->
      <DeviceSummary :devices="devices" />

      <div class="mx-auto flex w-full items-center justify-center">
        <button
          type="button"
          @click="isAddModalOpen = true"
          class="mx-auto inline-flex w-full max-w-md items-center justify-center gap-2 rounded-full bg-blue-700 px-6 py-3 text-sm font-bold text-white shadow-xl shadow-blue-500/30 transition-all hover:scale-[1.02] hover:bg-blue-800 active:scale-[0.98]"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="2"
            stroke="currentColor"
            class="h-5 w-5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
          添加设备
        </button>
      </div>

      <!-- Analytics Buttons -->
      <div
        class="mx-auto flex w-full max-w-md items-center justify-center gap-4"
      >
        <button
          type="button"
          @click="isPriceAnalyticsOpen = true"
          class="inline-flex items-center justify-center gap-2 rounded-full bg-purple-700 px-6 py-3 text-sm font-bold text-white shadow-xl shadow-purple-500/30 transition-all hover:scale-[1.02] hover:bg-purple-800 active:scale-[0.98]"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="2"
            stroke="currentColor"
            class="h-5 w-5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          价格分布
        </button>
        <button
          type="button"
          @click="openDailyCostChart"
          class="inline-flex items-center justify-center gap-2 rounded-full bg-green-700 px-6 py-3 text-sm font-bold text-white shadow-xl shadow-green-500/30 transition-all hover:scale-[1.02] hover:bg-green-800 active:scale-[0.98]"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="2"
            stroke="currentColor"
            class="h-5 w-5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
            />
          </svg>
          日均成本
        </button>
      </div>

      <!-- Loading State -->
      <div
        v-if="isLoading"
        class="col-span-full grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
      >
        <div
          v-for="i in 3"
          :key="i"
          class="animate-pulse rounded-xl border border-slate-100 bg-white p-6 shadow-lg dark:border-white/10 dark:bg-slate-800/70"
        >
          <div class="flex items-start gap-4">
            <div class="h-14 w-14 rounded-2xl bg-slate-200 dark:bg-slate-700" />
            <div class="flex-1 space-y-2">
              <div class="h-5 w-24 rounded bg-slate-200 dark:bg-slate-700" />
              <div class="h-4 w-16 rounded bg-slate-200 dark:bg-slate-700" />
            </div>
          </div>
        </div>
      </div>

      <!-- Error State -->
      <div
        v-else-if="error"
        class="col-span-full flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-800 dark:bg-red-900/20"
      >
        <svg
          class="h-12 w-12 text-red-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <p class="mt-4 text-sm font-medium text-red-600 dark:text-red-400">
          {{ error }}
        </p>
        <button
          type="button"
          @click="fetchDevices"
          class="mt-4 rounded-full bg-red-100 px-6 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
        >
          重试
        </button>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="devices.length === 0"
        class="col-span-full flex flex-col items-center justify-center rounded-xl border border-slate-100 bg-white p-12 text-center shadow-lg dark:border-white/10 dark:bg-slate-800/70"
      >
        <svg
          class="h-16 w-16 text-slate-300 dark:text-slate-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
        <p class="mt-4 text-lg font-medium text-slate-500 dark:text-slate-400">
          暂无设备
        </p>
        <p class="mt-1 text-sm text-slate-400 dark:text-slate-500">
          点击上方按钮添加你的第一个设备
        </p>
      </div>

      <!-- Device List -->
      <DeviceList
        v-else
        :devices="devices"
        :pending-id="pendingId"
        @toggle-status="handleToggleStatus"
        @delete="handleDeleteDevice"
        @config-success="fetchDevices"
      />
    </div>

    <Teleport to="body">
      <!-- Add Device Modal -->
      <AddDeviceModal v-model="isAddModalOpen" @success="handleAddSuccess" />

      <!-- Price Analytics Chart -->
      <PriceAnalyticsChart
        v-model="isPriceAnalyticsOpen"
        :data="devices"
        :is-open="isPriceAnalyticsOpen"
        :on-close="() => (isPriceAnalyticsOpen = false)"
      />

      <!-- Daily Cost Chart -->
      <DailyCostChart
        v-if="selectedDevice"
        :data="selectedDevice"
        :is-open="!!selectedDevice"
        :on-close="() => (selectedDevice = null)"
      />
    </Teleport>
  </BasicDetail>
</template>

<script setup lang="ts">
import type { Device, DeviceInput } from '@/features/device/types';
import { deviceGateway } from '@/features/device/api/deviceGateway';
import { useNotificationStore } from '@/stores';
import { ref } from 'vue';

import { BasicDetail } from '@/components';
import AddDeviceModal from './components/AddDeviceModal.vue';
import DailyCostChart from './components/DailyCostChart.vue';
import DeviceList from './components/DeviceList.vue';
import DeviceSummary from './components/DeviceSummary.vue';
import PriceAnalyticsChart from './components/PriceAnalyticsChart.vue';

const notificationStore = useNotificationStore();

const devices = ref<Device[]>([]);
const isLoading = ref(true);
const error = ref<string | null>(null);
const pendingId = ref<number | null>(null);
const isAddModalOpen = ref(false);
const isPriceAnalyticsOpen = ref(false);
const selectedDevice = ref<Device | null>(null);

async function fetchDevices() {
  isLoading.value = true;
  error.value = null;
  try {
    const data = await deviceGateway.getUserDevices();
    devices.value = data;
  } catch (fetchError) {
    error.value =
      fetchError instanceof Error
        ? fetchError.message
        : '设备列表加载失败，请稍后重试。';
    notificationStore.error(error.value);
  } finally {
    isLoading.value = false;
  }
}

async function handleToggleStatus(device: Device) {
  const nextStatus = device.status === 'active' ? 'retired' : 'active';
  pendingId.value = device.id;
  try {
    await deviceGateway.updateDeviceStatus(device.id, nextStatus);
    notificationStore.success(
      nextStatus === 'retired' ? '设备已标记为退役' : '设备已恢复使用',
    );
    await fetchDevices();
  } catch (updateError) {
    notificationStore.error(
      updateError instanceof Error
        ? updateError.message
        : '状态更新失败，请重试。',
    );
  } finally {
    pendingId.value = null;
  }
}

async function handleDeleteDevice(device: Device) {
  if (!window.confirm(`确定要删除设备 "${device.name}" 吗？此操作不可恢复。`)) {
    return;
  }
  pendingId.value = device.id;
  try {
    await deviceGateway.deleteDevice(device.id);
    devices.value = devices.value.filter((item) => item.id !== device.id);
    notificationStore.success('设备已删除');
  } catch (deleteError) {
    notificationStore.error(
      deleteError instanceof Error ? deleteError.message : '删除失败，请重试。',
    );
  } finally {
    pendingId.value = null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function handleAddSuccess(_device: DeviceInput) {
  void fetchDevices();
}

function openDailyCostChart() {
  if (devices.value.length > 0) {
    selectedDevice.value = devices.value[0];
  }
}

// Initial fetch
void fetchDevices();
</script>
