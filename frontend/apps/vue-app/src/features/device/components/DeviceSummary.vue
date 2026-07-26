<template>
  <section class="grid grid-cols-2 gap-4">
    <!-- Total Price (Spans 2 columns on large screens) -->
    <div
      class="squircle /10 bg-page col-span-2 flex items-center justify-between border p-10 shadow-lg"
    >
      <div>
        <p class="text-muted text-sm font-medium">设备总价格</p>
        <p class="text-brand-devices mt-1 text-3xl font-bold tracking-tight">
          ¥{{ totalPrice.toFixed(2) }}
        </p>
      </div>
      <div
        class="text-brand-devices bg-brand-devices/10 flex h-12 w-12 items-center justify-center rounded-full"
      >
        <svg
          class="h-6 w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
    </div>

    <!-- Active -->
    <div
      class="squircle /10 bg-page flex items-center gap-4 border p-8 shadow-lg"
    >
      <div
        class="bg-success/20 text-success flex h-10 w-10 items-center justify-center rounded-full"
      >
        <svg
          class="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <div>
        <p class="text-muted text-xs font-medium">使用中</p>
        <p class="text-ink mt-1 text-xl font-bold">
          {{ activeCount }}
        </p>
      </div>
    </div>

    <!-- Total -->
    <div
      class="squircle /10 bg-page flex items-center gap-4 border p-8 shadow-lg"
    >
      <div
        class="bg-warning/20 text-warning flex h-10 w-10 items-center justify-center rounded-full"
      >
        <svg
          class="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      </div>
      <div>
        <p class="text-muted text-xs font-medium">设备总数</p>
        <p class="text-ink mt-1 text-xl font-bold">
          {{ totalCount }}
        </p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { Device } from '@/features/device/types';
import { computed } from 'vue';

interface Props {
  devices: Device[];
}

const props = defineProps<Props>();

const activeCount = computed(
  () => props.devices.filter((d) => d.status === 'active').length,
);
const totalPrice = computed(() =>
  props.devices.reduce((total, device) => total + device.price, 0),
);
const totalCount = computed(() => props.devices.length);
</script>
