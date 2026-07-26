import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, h, nextTick, ref, type Ref } from 'vue';
import { mount } from '@vue/test-utils';

// ── gateway mock ─────────────────────────────────────────────────
const fetchStatusDetail = vi.fn();
vi.mock('@/features/status/api/statusGateway', () => ({
  fetchStatusDetail: (...args: unknown[]) => fetchStatusDetail(...args),
}));

// ── visitor mock ─────────────────────────────────────────────────
const connectionDelay: Ref<number> = ref(0);
const isConnected: Ref<boolean> = ref(true);
const sendPing = vi.fn();
vi.mock('@/utils/visitor', () => ({
  connectionDelay,
  isConnected,
  sendPing,
}));

// ── chart colors mock ───────────────────────────────────────────
const palette = ref({
  primary: '#3b82f6',
  warning: '#f97316',
  foreground: '#1f2937',
  mutedForeground: '#9ca3af',
  border: '#e5e7eb',
  card: '#ffffff',
  series: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de'],
});
vi.mock('@/composables/useChartColors', () => ({
  useChartColors: () => ({ palette }),
  withAlpha: (color: string, alpha: number) => `${color}${alpha}`,
}));

function makeStatus() {
  return {
    version: { repo_url: 'https://x', current_version: '1.0.0' },
    service: {
      runtime: 'go1.26',
      go_version: '1.26',
      goroutines: 42,
      gc_count: 7,
      start_time: 1700000000,
      heap_memory_bytes: 100 * 1024 * 1024,
      total_memory_bytes: 512 * 1024 * 1024,
      db_ok: true,
      api_ok: true,
    },
    system: {
      system_time: '',
      system_timezone: 'Asia/Shanghai',
      os_name: 'Ubuntu 24.04',
      os_version: '',
      kernel_version: '6.5',
      cpu_model: 'Intel i7',
      cpu_count_physical: 4,
      cpu_count_logical: 8,
      load_average: { '1m': 0.5, '5m': 0.3, '15m': 0.2 },
      cpu_percent: 12.5,
      memory_usage_percent: 45,
      memory_used_bytes: 4 * 1024 ** 3,
      memory_total_bytes: 8 * 1024 ** 3,
    },
  };
}

/**
 * 挂载一个使用目标 composable 的哨兵组件，通过闭包暴露 hook 实例。
 * onMounted / onUnmounted 在 mount / unmount 时触发。
 */
function makeWrapper<R>(composable: () => R) {
  let instance: R;
  const Comp = defineComponent({
    setup() {
      instance = composable();
      return () => h('div');
    },
  });
  const wrapper = mount(Comp);
  return {
    get hook() {
      return instance!;
    },
    unmount: () => wrapper.unmount(),
  };
}

async function resetModule() {
  vi.resetModules();
}

describe('useServerStatus', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    await resetModule();
    fetchStatusDetail.mockReset();
    fetchStatusDetail.mockResolvedValue(makeStatus());
    connectionDelay.value = 0;
    isConnected.value = true;
    sendPing.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('初始状态:null/true/0', async () => {
    const { useServerStatus } = await import('../useServerStatus');
    const { hook } = makeWrapper(useServerStatus);
    expect(hook.serverStatus.value).toBeNull();
    expect(hook.apiHealthy.value).toBe(true);
    expect(hook.apiLatency.value).toBe(0);
    expect(hook.latencyHistory.value).toEqual([]);
    expect(hook.overallStatus.value.key).toBe('ok');
  });

  it('onMounted 触发 loadStatus + 30s 轮询', async () => {
    const { useServerStatus } = await import('../useServerStatus');
    const { hook, unmount } = makeWrapper(useServerStatus);
    await vi.advanceTimersByTimeAsync(0);
    await nextTick();
    expect(fetchStatusDetail).toHaveBeenCalledTimes(1);
    expect(hook.serverStatus.value).not.toBeNull();

    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchStatusDetail).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('overallStatus:api 异常 → danger', async () => {
    const { useServerStatus } = await import('../useServerStatus');
    const { hook } = makeWrapper(useServerStatus);
    hook.apiHealthy.value = false;
    expect(hook.overallStatus.value.key).toBe('danger');
    expect(hook.overallStatus.value.tone).toBe('destructive');
  });

  it('overallStatus:ws 高延迟 → warn', async () => {
    const { useServerStatus } = await import('../useServerStatus');
    const { hook } = makeWrapper(useServerStatus);
    isConnected.value = true;
    connectionDelay.value = 3000;
    await nextTick();
    expect(hook.overallStatus.value.key).toBe('warn');
  });

  it('overallStatus:ws 断开 → warn', async () => {
    const { useServerStatus } = await import('../useServerStatus');
    const { hook } = makeWrapper(useServerStatus);
    isConnected.value = false;
    await nextTick();
    expect(hook.overallStatus.value.key).toBe('warn');
  });

  it('wsStatus:畅通/偏慢/高延迟/静默', async () => {
    const { useServerStatus } = await import('../useServerStatus');
    const { hook } = makeWrapper(useServerStatus);
    isConnected.value = true;

    connectionDelay.value = 50;
    await nextTick();
    expect(hook.wsStatus.value.label).toBe('畅通');

    connectionDelay.value = 500;
    await nextTick();
    expect(hook.wsStatus.value.label).toBe('偏慢');

    connectionDelay.value = 3000;
    await nextTick();
    expect(hook.wsStatus.value.label).toBe('高延迟');

    isConnected.value = false;
    await nextTick();
    expect(hook.wsStatus.value.label).toBe('静默');
  });

  it('dbStatus:检测中/主库/未响应', async () => {
    const { useServerStatus } = await import('../useServerStatus');
    const { hook } = makeWrapper(useServerStatus);
    expect(hook.dbStatus.value.label).toBe('检测中');

    hook.serverStatus.value = makeStatus();
    expect(hook.dbStatus.value.label).toBe('主库');

    hook.serverStatus.value!.service.db_ok = false;
    expect(hook.dbStatus.value.label).toBe('未响应');
  });

  it('latencyHistory 随 connectionDelay 累积并封顶 60', async () => {
    const { useServerStatus } = await import('../useServerStatus');
    const { hook } = makeWrapper(useServerStatus);
    for (let i = 0; i < 65; i++) {
      connectionDelay.value = 100 + i;
      await nextTick();
    }
    expect(hook.latencyHistory.value.length).toBe(60);
    // 保留最近 60，最早的被丢弃
    expect(hook.latencyHistory.value[0]).toBeCloseTo(105, 0);
  });

  it('chartOption 随 latencyHistory 变化', async () => {
    const { useServerStatus } = await import('../useServerStatus');
    const { hook } = makeWrapper(useServerStatus);
    expect(
      (hook.chartOption.value.series as { data: number[] }[])[0].data.length,
    ).toBe(0);

    connectionDelay.value = 120;
    await nextTick();
    connectionDelay.value = 80;
    await nextTick();
    expect(
      (hook.chartOption.value.series as { data: number[] }[])[0].data.length,
    ).toBe(2);
  });

  it('refresh 手动重新拉取', async () => {
    const { useServerStatus } = await import('../useServerStatus');
    const { hook, unmount } = makeWrapper(useServerStatus);
    await vi.advanceTimersByTimeAsync(0);
    const firstCallCount = fetchStatusDetail.mock.calls.length;

    await hook.refresh();
    expect(fetchStatusDetail.mock.calls.length).toBe(firstCallCount + 1);
    unmount();
  });
});
