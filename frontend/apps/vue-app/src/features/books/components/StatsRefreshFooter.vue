<script setup lang="ts">
import type dayjs from 'dayjs';
import { Button } from '@/components';

defineProps<{
  lastRefreshedAt: dayjs.Dayjs | null;
  loading: boolean;
}>();

defineEmits<{ refresh: [] }>();
</script>

<template>
  <p class="text-muted mt-12 flex items-center justify-between text-xs">
    <span class="tabular-nums">
      <template v-if="lastRefreshedAt">
        数据更新于 {{ lastRefreshedAt.format('HH:mm') }}
      </template>
      <template v-else>—</template>
    </span>
    <Button
      variant="ghost"
      size="sm"
      :disabled="loading"
      class="!active:scale-100 hover:text-ink inline-flex items-center gap-1.5 text-xs font-normal"
      @click="$emit('refresh')"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="2"
        stroke="currentColor"
        class="h-3.5 w-3.5"
        :class="{ 'animate-spin': loading }"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182"
        />
      </svg>
      刷新
    </Button>
  </p>
</template>
