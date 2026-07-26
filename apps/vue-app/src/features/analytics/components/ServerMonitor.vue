<template>
  <div :class="cardClass">
    <div
      class="grid transition-[grid-template-rows] duration-300 ease-out"
      :class="collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'"
    >
      <!-- Expandable detail row -->
      <div id="server-monitor-detail" class="min-h-0 overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between">
          <h2
            class="text-ink flex items-center gap-2 text-lg font-bold tracking-tight"
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
                d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
              />
            </svg>
            服务器系统监控
          </h2>
          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="toggleCollapsed"
              class="bg-card text-ink hover:bg-secondary rounded-xl px-3 py-1.5 text-xs font-medium transition-colors"
              :aria-expanded="!collapsed"
              aria-controls="server-monitor-detail"
            >
              收起
            </button>
            <button
              type="button"
              @click="toggleAutoRefresh"
              class="bg-card text-ink hover:bg-secondary rounded-xl px-3 py-1.5 text-xs font-medium transition-colors"
            >
              {{ isSSEConnected ? '暂停' : '开始' }} 自动刷新
            </button>
          </div>
        </div>

        <!-- Server Status — single card, three cells -->
        <div class="bg-card mt-4 overflow-hidden rounded-2xl border p-6">
          <div
            class="grid grid-cols-1 divide-y lg:grid-cols-3 lg:divide-x lg:divide-y-0"
          >
            <!-- CPU Gauge -->
            <div class="lg:px-6 lg:first:pl-0 lg:last:pr-0">
              <div class="mb-4 flex items-center justify-between">
                <h3 class="text-ink text-sm font-medium">
                  <span class="flex items-center gap-2">
                    <svg
                      class="h-4 w-4"
                      :style="{ color: chartColors.cpu }"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                      />
                    </svg>
                    CPU
                  </span>
                </h3>
                <span class="text-muted text-xs font-medium tabular-nums">
                  {{ serverStatus?.cpu_cores ?? 0 }} 核
                </span>
              </div>
              <div class="h-44">
                <div
                  v-if="!serverStatus"
                  class="bg-surface h-full w-full animate-pulse rounded-xl"
                ></div>
                <v-chart
                  v-else
                  :option="cpuGaugeOption"
                  autoresize
                  class="h-full w-full"
                />
              </div>
            </div>

            <!-- Memory Gauge -->
            <div class="lg:px-6">
              <div class="mb-4 flex items-center justify-between">
                <h3 class="text-ink text-sm font-medium">
                  <span class="flex items-center gap-2">
                    <svg
                      class="h-4 w-4"
                      :style="{ color: chartColors.mem }"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                    内存
                  </span>
                </h3>
                <span class="text-muted text-xs font-medium tabular-nums">
                  {{ serverStatus ? serverStatus.mem_used.toFixed(0) : '—' }} MB
                  /
                  {{ serverStatus ? serverStatus.mem_total.toFixed(0) : '—' }}
                  MB
                </span>
              </div>
              <div class="h-44">
                <div
                  v-if="!serverStatus"
                  class="bg-surface h-full w-full animate-pulse rounded-xl"
                ></div>
                <v-chart
                  v-else
                  :option="memoryGaugeOption"
                  autoresize
                  class="h-full w-full"
                />
              </div>
            </div>

            <!-- Disk Usage -->
            <div class="lg:px-6">
              <div class="mb-4 flex items-center justify-between">
                <h3 class="text-ink text-sm font-medium">
                  <span class="flex items-center gap-2">
                    <svg
                      class="text-ink h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
                      />
                    </svg>
                    磁盘
                  </span>
                </h3>
                <span
                  class="text-xs font-medium tabular-nums"
                  :style="{
                    color: getStatusColor(serverStatus?.disk_usage ?? 0),
                  }"
                >
                  {{ serverStatus ? serverStatus.disk_usage.toFixed(1) : '—' }}%
                </span>
              </div>
              <div class="space-y-4">
                <div class="space-y-2">
                  <div class="flex justify-between text-sm">
                    <span class="text-muted">已用</span>
                    <span class="text-ink font-medium tabular-nums">
                      {{ serverStatus?.disk_used.toFixed(2) ?? '—' }} GB
                    </span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-muted">总计</span>
                    <span class="text-ink font-medium tabular-nums">
                      {{ serverStatus?.disk_total.toFixed(2) ?? '—' }} GB
                    </span>
                  </div>
                </div>
                <div class="bg-border h-4 w-full overflow-hidden rounded-full">
                  <div
                    :style="{
                      width: `${serverStatus?.disk_usage ?? 0}%`,
                      backgroundColor: getStatusColor(
                        serverStatus?.disk_usage ?? 0,
                      ),
                    }"
                    class="h-full rounded-full transition-all duration-500"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Server History Chart -->
        <div class="bg-card mt-4 overflow-hidden rounded-2xl border p-6">
          <h3 class="text-ink mb-4 flex items-center gap-2 text-sm font-medium">
            <svg
              class="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
              />
            </svg>
            资源使用历史
          </h3>
          <div
            v-if="!hasHistory"
            class="bg-surface h-64 animate-pulse rounded-xl"
          ></div>
          <div v-else class="h-64 w-full overflow-hidden">
            <v-chart
              :option="historyChartOption"
              autoresize
              class="h-full w-full"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Sticky status bar row (always visible) -->
    <div
      class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div class="flex items-center gap-4">
        <h2 class="text-ink flex items-center gap-2 text-sm font-medium">
          <svg
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
            />
          </svg>
          服务器状态
        </h2>
        <div class="flex items-center gap-3">
          <!-- CPU -->
          <div class="flex items-center gap-1.5">
            <span
              class="h-1.5 w-1.5 rounded-full"
              :style="{ backgroundColor: chartColors.cpu }"
            ></span>
            <span class="text-muted text-xs">CPU</span>
            <span class="text-ink text-xs font-medium tabular-nums">
              {{ serverStatus ? serverStatus.cpu_percent.toFixed(0) : '—' }}%
            </span>
          </div>
          <!-- Memory -->
          <div class="flex items-center gap-1.5">
            <span
              class="h-1.5 w-1.5 rounded-full"
              :style="{ backgroundColor: chartColors.mem }"
            ></span>
            <span class="text-muted text-xs">内存</span>
            <span class="text-ink text-xs font-medium tabular-nums">
              {{ serverStatus ? serverStatus.mem_usage.toFixed(0) : '—' }}%
            </span>
          </div>
          <!-- Disk -->
          <div class="flex items-center gap-1.5">
            <span
              class="h-1.5 w-1.5 rounded-full"
              :style="{
                backgroundColor: getStatusColor(serverStatus?.disk_usage ?? 0),
              }"
            ></span>
            <span class="text-muted text-xs">磁盘</span>
            <span class="text-ink text-xs font-medium tabular-nums">
              {{ serverStatus ? serverStatus.disk_usage.toFixed(0) : '—' }}%
            </span>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <!-- Connection status -->
        <div
          class="bg-surface text-muted flex items-center gap-2 rounded-full px-3 py-1 text-xs"
        >
          <div
            :class="[
              'h-1.5 w-1.5 rounded-full',
              isSSEConnected
                ? 'bg-success'
                : sseError
                  ? 'bg-destructive'
                  : 'bg-border',
            ]"
          ></div>
          {{ connectionLabel }}
        </div>
        <button
          type="button"
          @click="toggleCollapsed"
          class="bg-surface text-ink hover:bg-surface/80 rounded-full px-3 py-1 text-xs font-medium transition-colors"
          :aria-expanded="!collapsed"
          aria-controls="server-monitor-detail"
        >
          {{ collapsed ? '展开' : '收起' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useThemeStore } from '@/stores';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import dayjs from 'dayjs';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import VChart from 'vue-echarts';
import { useOrigin } from '@/composables';
import { tokenService } from '@/api/tokenService';

// Types
interface ServerStatus {
  cpu_percent: number;
  cpu_cores: number;
  mem_total: number;
  mem_used: number;
  mem_usage: number;
  disk_total: number;
  disk_used: number;
  disk_usage: number;
}

interface HistoryItem {
  timestamp: string;
  cpu: number;
  memory: number;
}

defineOptions({
  name: 'ServerMonitor',
});

const props = defineProps<{
  autoStart?: boolean;
  customClass?: string;
  /** Start in collapsed (status-bar) mode. Defaults to false for backward compat. */
  defaultCollapsed?: boolean;
}>();

const emit = defineEmits<{
  (e: 'status-update', status: ServerStatus): void;
}>();

const MAX_HISTORY = 100;

const serverStatus = ref<ServerStatus | null>(null);
const history = ref<HistoryItem[]>([]);
const isSSEConnected = ref(false);
const sseError = ref(false);
const collapsed = ref<boolean>(props.defaultCollapsed ?? false);

const eventSourceAbort = ref<AbortController | null>(null);
const reconnectTimer = ref<ReturnType<typeof setTimeout> | null>(null);
const reconnectAttempt = ref(0);
const manualPause = ref(false);

// ---- theme / token bridge ----------------------------------------------
// ECharts paints to canvas and cannot read Tailwind classes, so we resolve the
// active brand tokens (paper/sage/mist/blush × light/dark) from the DOM and
// feed them into the chart options. themeTick bumps after the theme attribute
// has actually swapped on <html>, so charts recolour on theme change.
const themeStore = useThemeStore();
const isDark = computed(() => {
  if (themeStore.theme === 'dark') return true;
  if (themeStore.theme === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
});

const themeTick = ref(0);
watch(
  () => themeStore.theme,
  async () => {
    await nextTick();
    themeTick.value++;
  },
);

let mediaQuery: MediaQueryList | null = null;
const onSystemThemeChange = () => {
  themeTick.value++;
};

const readToken = (token: string, fallback: string): string => {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim();
  return value || fallback;
};

const chartColors = computed(() => {
  // touch reactive deps so options recompute on theme / system change
  void themeStore.theme;
  void isDark.value;
  void themeTick.value;

  const dark = isDark.value;
  return {
    text: readToken('--color-ink', dark ? '#f3f4f6' : '#1f2937'),
    muted: readToken('--color-muted', dark ? '#9ca3af' : '#6b7280'),
    border: readToken('--color-border', dark ? '#374151' : '#e5e7eb'),
    splitLine: readToken('--color-border', dark ? '#3f4651' : '#eef0f3'),
    tooltipBg: dark ? 'rgba(8,9,13,0.82)' : 'rgba(255,255,255,0.96)',
    track: readToken('--color-muted', dark ? '#374151' : '#e5e7eb'),
    success: readToken('--color-success', '#10b981'),
    warning: readToken('--color-warning', '#f59e0b'),
    danger: readToken('--color-destructive', '#ef4444'),
    cpu: readToken('--color-chart-2', '#e0922f'),
    mem: readToken('--color-chart-3', '#5b6b7a'),
  };
});

// alpha-blend a token colour for area fills (oklch/hex agnostic)
const fade = (color: string, alpha: number) =>
  `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`;

const getStatusColor = (percent: number): string => {
  const c = chartColors.value;
  if (percent < 50) return c.success;
  if (percent < 80) return c.warning;
  return c.danger;
};

// ---- layout helpers ----------------------------------------------------
const cardClass = computed(() =>
  [' bg-card border p-5 rounded-3xl', props.customClass || '']
    .filter(Boolean)
    .join(' '),
);

const connectionLabel = computed(() =>
  isSSEConnected.value ? '自动刷新中' : sseError.value ? '重连中…' : '已暂停',
);

const hasHistory = computed(() => history.value.length > 0);

const toggleCollapsed = () => {
  collapsed.value = !collapsed.value;
};

// ---- chart options -----------------------------------------------------
const buildGaugeOption = (value: number, stops: Array<[number, string]>) => {
  const c = chartColors.value;
  return {
    series: [
      {
        type: 'gauge',
        startAngle: 180,
        endAngle: 0,
        min: 0,
        max: 100,
        splitNumber: 5,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: stops.map(([offset, color]) => ({ offset, color })),
          },
        },
        progress: { show: true, width: 16 },
        pointer: { show: false },
        axisLine: {
          lineStyle: {
            width: 16,
            color: [[1, c.track]],
          },
        },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        title: { show: false },
        detail: {
          valueAnimation: true,
          offsetCenter: [0, '0%'],
          fontSize: 28,
          fontWeight: 'bold',
          formatter: '{value}%',
          color: c.text,
        },
        data: [{ value }],
      },
    ],
  };
};

const cpuGaugeOption = computed(() => {
  const c = chartColors.value;
  return buildGaugeOption(serverStatus.value?.cpu_percent ?? 0, [
    [0, c.success],
    [0.5, c.warning],
    [1, c.danger],
  ]);
});

const memoryGaugeOption = computed(() => {
  const c = chartColors.value;
  return buildGaugeOption(serverStatus.value?.mem_usage ?? 0, [
    [0, c.mem],
    [0.5, c.warning],
    [1, c.danger],
  ]);
});

const historyChartOption = computed(() => {
  const c = chartColors.value;
  return {
    // 禁用 animation 避免 setOption 渐变动画时 echarts interpolate1DArray 崩
    animation: false,
    tooltip: {
      trigger: 'axis',
      backgroundColor: c.tooltipBg,
      borderColor: c.border,
      textStyle: { color: c.text },
    },
    legend: {
      data: ['CPU', '内存'],
      top: 0,
      textStyle: { color: c.text },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '15%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: history.value.map((d) => dayjs(d.timestamp).format('HH:mm:ss')),
      axisLine: { lineStyle: { color: c.border } },
      axisLabel: { color: c.muted, fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLine: { show: false },
      axisLabel: { color: c.muted, formatter: '{value}%' },
      splitLine: { lineStyle: { color: c.splitLine } },
    },
    series: [
      {
        name: 'CPU',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { width: 2, color: c.cpu },
        itemStyle: { color: c.cpu },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: fade(c.cpu, 0.18) },
              { offset: 1, color: fade(c.cpu, 0.02) },
            ],
          },
        },
        data: history.value.map((d) => d.cpu),
      },
      {
        name: '内存',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { width: 2, color: c.mem },
        itemStyle: { color: c.mem },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: fade(c.mem, 0.18) },
              { offset: 1, color: fade(c.mem, 0.02) },
            ],
          },
        },
        data: history.value.map((d) => d.memory),
      },
    ],
  };
});

// ---- SSE stream with exponential backoff -------------------------------
const clearReconnect = () => {
  if (reconnectTimer.value) {
    clearTimeout(reconnectTimer.value);
    reconnectTimer.value = null;
  }
};

const scheduleReconnect = () => {
  if (manualPause.value) return;
  clearReconnect();
  const delay = Math.min(1000 * 2 ** reconnectAttempt.value, 30000);
  reconnectAttempt.value += 1;
  reconnectTimer.value = setTimeout(() => {
    if (!manualPause.value) fetchStatusSSE();
  }, delay);
};

const fetchStatusSSE = async () => {
  // Close any existing connection first.
  if (eventSourceAbort.value) {
    eventSourceAbort.value.abort();
    eventSourceAbort.value = null;
  }

  const ctrl = new AbortController();
  eventSourceAbort.value = ctrl;

  try {
    await fetchEventSource(useOrigin('/v3/status/server/status/stream'), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokenService.get()}`,
      },
      signal: ctrl.signal,
      async onopen() {
        isSSEConnected.value = true;
        sseError.value = false;
        reconnectAttempt.value = 0;
      },
      onmessage(event) {
        const data = JSON.parse(event.data) as ServerStatus;
        serverStatus.value = data;
        emit('status-update', data);

        history.value.push({
          timestamp: new Date().toISOString(),
          cpu: data.cpu_percent,
          memory: data.mem_usage,
        });

        if (history.value.length > MAX_HISTORY) {
          history.value = history.value.slice(-MAX_HISTORY);
        }
      },
      onerror(err) {
        isSSEConnected.value = false;
        sseError.value = true;
        // Abort so the library stops its own retry; we drive reconnect ourselves.
        ctrl.abort();
        throw err;
      },
      onclose() {
        isSSEConnected.value = false;
      },
    });

    // Stream ended cleanly (server closed) — reconnect unless the user paused.
    if (!manualPause.value && !isSSEConnected.value) {
      scheduleReconnect();
    }
  } catch (err) {
    isSSEConnected.value = false;
    // AbortError = intentional close (user pause / teardown) — do not reconnect.
    if ((err as Error).name !== 'AbortError') {
      console.error('[ServerMonitor] SSE stream failed:', err);
      sseError.value = true;
      scheduleReconnect();
    }
  }
};

const toggleAutoRefresh = () => {
  if (isSSEConnected.value || eventSourceAbort.value) {
    // Pause: stop everything and suppress reconnect.
    manualPause.value = true;
    clearReconnect();
    eventSourceAbort.value?.abort();
    eventSourceAbort.value = null;
    isSSEConnected.value = false;
    sseError.value = false;
  } else {
    // Start: fresh attempt, reset backoff.
    manualPause.value = false;
    reconnectAttempt.value = 0;
    sseError.value = false;
    fetchStatusSSE();
  }
};

// Expose methods for parent component
defineExpose({
  toggleAutoRefresh,
  toggleCollapsed,
});

// Lifecycle
onMounted(() => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', onSystemThemeChange);
  }
  if (props.autoStart) {
    toggleAutoRefresh();
  }
});

onUnmounted(() => {
  // Clean up SSE + timers so a destroyed component never leaks a connection.
  manualPause.value = true;
  clearReconnect();
  mediaQuery?.removeEventListener('change', onSystemThemeChange);
  if (eventSourceAbort.value) {
    eventSourceAbort.value.abort();
    eventSourceAbort.value = null;
  }
  isSSEConnected.value = false;
});
</script>
