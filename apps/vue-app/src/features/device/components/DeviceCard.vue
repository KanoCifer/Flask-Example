<template>
  <article
    class="group squircle /10 bg-page overflow-hidden p-6 shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-xl"
  >
    <div class="mb-6 flex items-start justify-between">
      <div class="flex items-center gap-4">
        <!-- Logo placeholder -->
        <div
          class="/50 bg-page flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border shadow-inner"
        >
          <span class="text-muted text-2xl font-bold">
            {{ device.name.charAt(0).toUpperCase() }}
          </span>
        </div>
        <div>
          <h3 class="text-ink text-lg font-bold">
            {{ device.name }}
          </h3>
          <p
            v-if="isActive"
            class="bg-success/20 text-success mt-0.5 w-fit rounded-full px-2 py-0.5 text-center text-sm font-medium"
          >
            使用中
          </p>
          <p
            v-else
            class="bg-destructive/20 text-destructive mt-0.5 w-fit rounded-full px-2 py-0.5 text-center text-sm font-medium"
          >
            已退役
          </p>
          <span class="text-muted text-xs">
            {{ formatPurchaseDate(device.purchase_date) }}
          </span>
          <p class="font-family-dongfang text-muted mt-2 text-xs font-bold">
            {{
              `日均 ${formatPrice(calcSpendPerDay(device), device.currency)}/天`
            }}
          </p>
        </div>
      </div>
      <div class="text-right">
        <p class="text-brand-devices text-xl font-bold">
          {{ formatPrice(device.price, device.currency) }}
        </p>
        <p class="text-muted text-[10px] font-bold tracking-wider uppercase">
          {{ device.currency }}
        </p>
      </div>
    </div>

    <!-- Notes Banner -->
    <div
      v-if="device.notes"
      class="bg-surface/50 mb-6 flex items-center gap-2 rounded-2xl px-4 py-3"
    >
      <svg
        class="text-brand-devices h-4 w-4 scale-75"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      <span class="text-muted truncate text-sm font-medium">
        {{ device.notes }}
      </span>
    </div>

    <div class="grid grid-cols-3 gap-3">
      <button
        type="button"
        :disabled="isPending"
        @click="handleToggleStatus"
        class="bg-brand-devices text-ink rounded-full px-4 py-3 text-sm font-bold shadow-md transition-all hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {{ isPending ? '处理中...' : isActive ? '标记退役' : '恢复使用' }}
      </button>
      <button
        type="button"
        @click="isMilestoneModalOpen = true"
        class="bg-brand-devices text-ink rounded-full px-4 py-3 text-sm font-bold shadow-md transition-all hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        编辑配置
      </button>
      <button
        type="button"
        @click="handleDelete"
        class="border-destructive/30 bg-destructive/20 text-destructive hover:bg-destructive/10 rounded-full border px-4 py-3 text-sm font-bold transition-all active:scale-95"
      >
        删除设备
      </button>
    </div>

    <!-- Milestone Config Modal -->
    <MilestoneConfigForm
      v-model="isMilestoneModalOpen"
      :device="device"
      @success="(updated) => emit('configSuccess', updated)"
    />
  </article>
</template>

<script setup lang="ts">
import type { Device } from '@/features/device/types';
import dayjs from 'dayjs';
import { computed, ref } from 'vue';
import MilestoneConfigForm from './MilestoneConfigForm.vue';

interface Props {
  device: Device;
  pendingId: number | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  toggleStatus: [device: Device];
  delete: [device: Device];
  configSuccess: [device: Device];
}>();

const isPending = computed(() => props.pendingId === props.device.id);
const isActive = computed(() => props.device.status === 'active');
const isMilestoneModalOpen = ref(false);

function formatPrice(price: number, currency: string): string {
  const normalized = currency?.toUpperCase() ?? 'CNY';
  if (normalized === 'CNY') {
    return `¥${price.toFixed(2)}`;
  }
  return `$${price.toFixed(2)}`;
}

function formatPurchaseDate(dateStr: string): string {
  if (!dateStr) return '';
  return dayjs(dateStr).format('YYYY-MM-DD');
}

function calcSpendPerDay(device: Device): number {
  const daysInUse = Math.max(
    1,
    dayjs().diff(dayjs(device.purchase_date), 'day'),
  );
  return device.price / daysInUse;
}

function handleToggleStatus() {
  emit('toggleStatus', props.device);
}

function handleDelete() {
  emit('delete', props.device);
}
</script>
