<template>
  <div class="space-y-2.5 px-3.5 py-3">
    <div
      :class="[
        overallStatus.bgClass,
        'flex items-center gap-2 rounded-md px-3 py-2',
      ]"
    >
      <span class="relative flex h-2 w-2">
        <span
          class="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
          :class="overallStatus.dotClass"
        />
        <span
          class="relative inline-flex h-2 w-2 rounded-full"
          :class="overallStatus.dotClass"
        />
      </span>
      <span
        :class="overallStatus.textClass"
        class="font-serif text-[13px] italic"
        >{{ overallStatus.label }}</span
      >
    </div>

    <ul class="divide-border/40 divide-y">
      <li
        v-for="row in rows"
        :key="row.key"
        class="flex items-center gap-2.5 py-2"
      >
        <span class="relative flex h-1.5 w-1.5">
          <span
            class="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
            :class="row.pingClass"
          />
          <span
            class="relative inline-flex h-1.5 w-1.5 rounded-full"
            :class="row.dotClass"
          />
        </span>
        <span
          class="text-ink/80 font-mono text-[11px] tracking-[0.1em] uppercase"
          >{{ row.label }}</span
        >
        <span class="text-muted/70 text-[11px]">{{ row.status }}</span>
        <span class="text-ink ml-auto font-mono text-[12px] tabular-nums">{{
          row.value
        }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { fetchStatusDetail } from '@/features/status/api/statusGateway';
import type { StatusDetailData } from '@/features/status/types';
import { connectionDelay, isConnected, sendPing } from '@/lib';
import { computed, onMounted, onUnmounted, ref } from 'vue';

const serverStatus = ref<StatusDetailData | null>(null);
let statusTimer: ReturnType<typeof setInterval> | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;

const apiLatency = ref(0);
const apiHealthy = ref(true);
let apiTimer: ReturnType<typeof setInterval> | null = null;

async function loadStatus() {
  try {
    serverStatus.value = await fetchStatusDetail();
  } catch {
    /* silent */
  }
}

async function pingApi() {
  const base = import.meta.env.VITE_API_BASE || '/';
  const start = performance.now();
  try {
    const res = await fetch(`${base}/v3/status/detail`, {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error();
    apiLatency.value = Math.round(performance.now() - start);
    apiHealthy.value = true;
  } catch {
    apiHealthy.value = false;
  }
}

const wsLatency = computed(() => {
  const ms = connectionDelay?.value ?? 0;
  return ms ? `${Math.round(ms)} ms` : '-- ms';
});

const wsDotClass = computed(() => {
  const ms = connectionDelay?.value ?? 0;
  if (!ms) return 'bg-surface/40';
  if (ms < 200) return 'bg-emerald-500';
  if (ms < 2000) return 'bg-yellow-500';
  return 'bg-red-500';
});

const overallStatus = computed(() => {
  if (!apiHealthy.value)
    return {
      label: '服务中断',
      dotClass: 'bg-red-500',
      bgClass: 'bg-destructive/10',
      textClass: 'text-destructive',
    };
  const delay = connectionDelay?.value ?? 0;
  if (!isConnected?.value || delay > 2000)
    return {
      label: '性能降级',
      dotClass: 'bg-yellow-500',
      bgClass: 'bg-warning/10',
      textClass: 'text-warning',
    };
  return {
    label: '运行正常',
    dotClass: 'bg-emerald-500',
    bgClass: 'bg-success/15',
    textClass: 'text-success',
  };
});

interface ServiceRow {
  key: string;
  label: string;
  status: string;
  value: string;
  dotClass: string;
  pingClass: string;
}

const rows = computed<ServiceRow[]>(() => {
  const dbOk = serverStatus.value?.service.db_ok;
  return [
    {
      key: 'api',
      label: 'API',
      status: apiHealthy.value ? '正常' : '无法连接',
      value: apiHealthy.value ? `${apiLatency.value} ms` : '--',
      dotClass: apiHealthy.value ? 'bg-emerald-500' : 'bg-red-500',
      pingClass: apiHealthy.value ? 'bg-emerald-500' : 'bg-red-500',
    },
    {
      key: 'ws',
      label: 'WebSocket',
      status: isConnected?.value ? '已连接' : '未连接',
      value: wsLatency.value,
      dotClass: wsDotClass.value,
      pingClass: wsDotClass.value,
    },
    {
      key: 'db',
      label: 'Database',
      status: dbOk ? '连接正常' : '检测中…',
      value: dbOk ? 'OK' : '--',
      dotClass: dbOk ? 'bg-emerald-500' : 'bg-surface/40',
      pingClass: dbOk ? 'bg-emerald-500' : 'bg-surface/40',
    },
  ];
});

onMounted(() => {
  loadStatus();
  statusTimer = setInterval(loadStatus, 30_000);
  pingApi();
  apiTimer = setInterval(pingApi, 10_000);
  pingTimer = setInterval(sendPing, 1000);
});

onUnmounted(() => {
  if (statusTimer) clearInterval(statusTimer);
  if (apiTimer) clearInterval(apiTimer);
  if (pingTimer) clearInterval(pingTimer);
});
</script>
