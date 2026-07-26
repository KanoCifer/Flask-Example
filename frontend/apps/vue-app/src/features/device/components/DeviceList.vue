<template>
  <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
    <DeviceCard
      v-for="device in devices"
      :key="device.id"
      :device="device"
      :pending-id="pendingId"
      @toggle-status="(d) => emit('toggleStatus', d)"
      @delete="(d) => emit('delete', d)"
      @config-success="(d) => emit('configSuccess', d)"
    />
  </div>
</template>

<script setup lang="ts">
import DeviceCard from './DeviceCard.vue';
import type { Device } from '@/features/device/types';

interface Props {
  devices: Device[];
  pendingId: number | null;
}

defineProps<Props>();

const emit = defineEmits<{
  toggleStatus: [device: Device];
  delete: [device: Device];
  configSuccess: [device: Device];
}>();
</script>
