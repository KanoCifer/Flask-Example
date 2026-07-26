import { useChartColors, withAlpha } from '@/composables';
import { connectionDelay, isConnected, sendPing } from '@/lib';
import { fetchStatusDetail } from '@/features/status/api/statusGateway';
import type { StatusDetailData } from '@/features/status/types';
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  watchEffect,
  type ComputedRef,
  type Ref,
} from 'vue';

/* ── 类型 ── */
export type Tone = 'success' | 'warning' | 'destructive';
export type StatusKey = 'ok' | 'warn' | 'danger';

export interface OverallStatus {
  key: StatusKey;
  tone: Tone;
  title: string;
  sub: string;
}

export interface ConnStatus {
  key: StatusKey;
  label: string;
}

export interface Availability {
  rate: number;
  incidents: number;
}

export interface UseServerStatusReturn {
  serverStatus: Ref<StatusDetailData | null>;
  overallStatus: ComputedRef<OverallStatus>;
  apiHealthy: Ref<boolean>;
  apiLatency: Ref<number>;
  wsLatency: ComputedRef<number>;
  wsStatus: ComputedRef<ConnStatus>;
  dbStatus: ComputedRef<ConnStatus>;
  latencyHistory: Ref<number[]>;
  chartOption: ComputedRef<Record<string, unknown>>;
  now: Ref<number>;
  availability: Ref<Availability | null>;
  announcement: Ref<string | null>;
  refresh: () => Promise<void>;
}

const MAX_HISTORY = 60;

/**
 * 服务器状态数据获取 + 状态衍生（健康/异常/指标数值）+ 自动刷新定时器。
 *
 * 暴露给视图的响应式数据：原始 serverStatus、聚合 overallStatus、
 * API / WS / DB 三项连接状态、延迟历史与图表 option、时钟。
 * 内部管理 4 个 polling 定时器（状态 30s、时钟 1s、API ping 10s、WS ping 1s），
 * 在 onUnmounted 时自动清理。
 */
export function useServerStatus(): UseServerStatusReturn {
  const { palette } = useChartColors();

  /* ── Server metrics ── */
  const serverStatus = ref<StatusDetailData | null>(null);
  let statusTimer: ReturnType<typeof setInterval> | null = null;
  let nowTimer: ReturnType<typeof setInterval> | null = null;
  const now = ref(Date.now());

  async function loadStatus() {
    try {
      serverStatus.value = await fetchStatusDetail();
    } catch {
      /* silent */
    }
  }

  /* ── Latency history ── */
  const latencyHistory = ref<number[]>([]);

  watchEffect(() => {
    const ms = connectionDelay?.value;
    if (ms && ms > 0) {
      latencyHistory.value = [
        ...latencyHistory.value.slice(-(MAX_HISTORY - 1)),
        Math.round(ms * 10) / 10,
      ];
    }
  });

  /* ── API health check (direct fetch) ── */
  const apiLatency = ref(0);
  const apiHealthy = ref(true);

  async function pingApi() {
    const apiBase = import.meta.env.VITE_API_BASE || '';
    const start = performance.now();

    let url: string;
    if (apiBase.startsWith('http://') || apiBase.startsWith('https://')) {
      // VITE_API_BASE 是绝对 URL（如 https://api.kanocifer.chat），直接使用
      url = `${apiBase}/v3/status/detail`;
    } else {
      const protocol = window.location.protocol;
      const host = window.location.host;
      url = `${protocol}//${host}${apiBase}/v3/status/detail`;
    }

    try {
      const res = await fetch(url, {
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

  let apiTimer: ReturnType<typeof setInterval> | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;

  /* ── 30 天可用率 + 公告(暂未接 API,占位) ── */
  const availability = ref<Availability | null>(null);
  const announcement = ref<string | null>(null);

  /* ── 状态聚合 ── */
  const overallStatus = computed<OverallStatus>(() => {
    if (!apiHealthy.value) {
      return {
        key: 'danger',
        tone: 'destructive',
        title: '正在重新连接',
        sub: '请稍后重试,我们已记录问题',
      };
    }
    const delay = connectionDelay?.value ?? 0;
    if (!isConnected?.value || delay > 2000) {
      return {
        key: 'warn',
        tone: 'warning',
        title: '略感疲倦',
        sub: '响应正在变慢,可能影响加载',
      };
    }
    return {
      key: 'ok',
      tone: 'success',
      title: '一切如常',
      sub: '所有系统按预期运行',
    };
  });

  const wsLatency = computed(() => {
    const ms = connectionDelay?.value ?? 0;
    return ms ? Math.round(ms) : 0;
  });

  const wsStatus = computed<ConnStatus>(() => {
    if (!isConnected?.value) return { key: 'warn', label: '静默' };
    const ms = connectionDelay?.value ?? 0;
    if (ms > 2000) return { key: 'danger', label: '高延迟' };
    if (ms > 200) return { key: 'warn', label: '偏慢' };
    return { key: 'ok', label: '畅通' };
  });

  const dbStatus = computed<ConnStatus>(() => {
    if (!serverStatus.value) return { key: 'warn', label: '检测中' };
    return serverStatus.value.service.db_ok
      ? { key: 'ok', label: '主库' }
      : { key: 'danger', label: '未响应' };
  });

  /* ── Latency chart (echarts) ── */
  const chartOption = computed<Record<string, unknown>>(() => {
    const data = latencyHistory.value;
    const xData = data.map((_, i) => `${i}s`);

    const fg = palette.value.foreground;
    const muted = palette.value.mutedForeground;
    const border = palette.value.border;
    const card = palette.value.card;
    const primary = palette.value.primary;
    const gridLine = withAlpha(palette.value.mutedForeground, 0.18);

    return {
      backgroundColor: 'transparent',
      textStyle: { color: muted, fontSize: 12 },
      grid: { left: 36, right: 8, top: 8, bottom: 22, containLabel: false },
      tooltip: {
        trigger: 'axis',
        backgroundColor: card,
        borderColor: border,
        borderWidth: 1,
        padding: [8, 12],
        textStyle: { color: fg, fontSize: 12 },
        axisPointer: {
          type: 'line',
          lineStyle: { color: primary, type: 'solid', width: 1, opacity: 0.4 },
        },
        formatter: (
          params: { seriesName: string; value: number; axisValue: string }[],
        ) => {
          const p = params[0];
          return `<div style="font-size:11px;color:${muted}">${p.axisValue}</div><div style="font-size:14px;font-weight:600;color:${fg};margin-top:2px">${p.value} ms</div>`;
        },
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: xData,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: muted,
          fontSize: 10,
          interval: Math.max(0, Math.floor(data.length / 5) - 1),
          formatter: (v: string) => `-${v}`,
        },
      },
      yAxis: {
        type: 'value',
        max: 800,
        min: 0,
        interval: 200,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: gridLine, type: 'dashed' } },
        axisLabel: { color: muted, fontSize: 10 },
      },
      series: [
        {
          name: '延迟',
          type: 'line',
          data,
          smooth: 0.25,
          symbol: 'circle',
          symbolSize: (value: number, params: { dataIndex: number }) =>
            params.dataIndex === data.length - 1 ? 6 : 0,
          showSymbol: data.length > 0,
          lineStyle: { width: 1.6, color: primary },
          itemStyle: { color: primary, borderColor: card, borderWidth: 2 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: withAlpha(primary, 0.28) },
                { offset: 1, color: withAlpha(primary, 0) },
              ],
            },
          },
        },
      ],
    };
  });

  /* ── Lifecycle ── */
  onMounted(() => {
    loadStatus();
    statusTimer = setInterval(loadStatus, 30_000);
    nowTimer = setInterval(() => {
      now.value = Date.now();
    }, 1000);
    pingApi();
    apiTimer = setInterval(pingApi, 10_000);
    pingTimer = setInterval(sendPing, 1000);
  });

  onUnmounted(() => {
    if (statusTimer) clearInterval(statusTimer);
    if (nowTimer) clearInterval(nowTimer);
    if (apiTimer) clearInterval(apiTimer);
    if (pingTimer) clearInterval(pingTimer);
  });

  async function refresh() {
    await loadStatus();
  }

  return {
    serverStatus,
    overallStatus,
    apiHealthy,
    apiLatency,
    wsLatency,
    wsStatus,
    dbStatus,
    latencyHistory,
    chartOption,
    now,
    availability,
    announcement,
    refresh,
  };
}
