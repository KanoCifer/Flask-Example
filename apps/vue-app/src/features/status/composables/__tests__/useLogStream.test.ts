import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { mount } from '@vue/test-utils';

// ── gateway mock ─────────────────────────────────────────────────
const fetchRecentEvents = vi.fn();
vi.mock('@/features/status/api/logGateway', () => ({
  fetchRecentEvents: (...args: unknown[]) => fetchRecentEvents(...args),
}));

function makeEvent(id: number, type = 'startup') {
  return {
    id,
    timestamp: '2026-07-20T12:00:00Z',
    type,
    source: 'system',
    title: `event ${id}`,
    message: '',
    extra: {},
  };
}

/**
 * 挂载一个使用目标 composable 的哨兵组件,返回 composable 返回值。
 * onMounted / onUnmounted 生命周期在 mount / unmount 时触发。
 */
async function mountHook<R>(
  setupFn: () => R,
): Promise<{ hook: R; unmount: () => void }> {
  const Comp = defineComponent({
    setup() {
      return () => h('div');
    },
  });
  const wrapper = mount(Comp);
  return {
    hook: wrapper.vm as unknown as R & Record<string, never>,
    unmount: () => wrapper.unmount(),
  };
}

// 包装:通过 wrapper 暴露 hook 返回值需要借助 defineExpose,改用兜底:
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

describe('useLogStream', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    await resetModule();
    fetchRecentEvents.mockReset();
    fetchRecentEvents.mockResolvedValue([makeEvent(1), makeEvent(2)]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('初始为空数组', async () => {
    const { useLogStream } = await import('../useLogStream');
    const { hook } = makeWrapper(useLogStream);
    expect(hook.recentEvents.value).toEqual([]);
  });

  it('onMounted 触发首屏拉取 + 30s 轮询', async () => {
    const { useLogStream } = await import('../useLogStream');
    const { hook, unmount } = makeWrapper(useLogStream);
    await vi.advanceTimersByTimeAsync(0);
    await nextTick();
    expect(fetchRecentEvents).toHaveBeenCalledTimes(1);
    expect(fetchRecentEvents).toHaveBeenCalledWith({ perPage: 10 });
    expect(hook.recentEvents.value.length).toBe(2);

    // 30s 后第二次拉取
    fetchRecentEvents.mockResolvedValue([makeEvent(3)]);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchRecentEvents).toHaveBeenCalledTimes(2);
    expect(hook.recentEvents.value.length).toBe(1);
    expect(hook.recentEvents.value[0].id).toBe(3);
    unmount();
  });

  it('perPage 参数透传', async () => {
    const { useLogStream } = await import('../useLogStream');
    const { unmount } = makeWrapper(() => useLogStream(5));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchRecentEvents).toHaveBeenCalledWith({ perPage: 5 });
    unmount();
  });

  it('拉取失败保持静默(不抛错,保留旧数据)', async () => {
    const { useLogStream } = await import('../useLogStream');
    const { hook, unmount } = makeWrapper(useLogStream);
    await vi.advanceTimersByTimeAsync(0);
    expect(hook.recentEvents.value.length).toBe(2);

    fetchRecentEvents.mockRejectedValueOnce(new Error('network'));
    await vi.advanceTimersByTimeAsync(30_000);
    await nextTick();
    // 旧数据保留,不抛错
    expect(hook.recentEvents.value.length).toBe(2);
    unmount();
  });

  it('refresh 手动重新拉取', async () => {
    const { useLogStream } = await import('../useLogStream');
    const { hook, unmount } = makeWrapper(useLogStream);
    await vi.advanceTimersByTimeAsync(0);
    expect(hook.recentEvents.value[0].id).toBe(1); // 首屏数据

    fetchRecentEvents.mockResolvedValue([makeEvent(9)]);
    await hook.refresh();
    expect(hook.recentEvents.value.length).toBe(1);
    expect(hook.recentEvents.value[0].id).toBe(9);
    unmount();
  });

  it('unmount 清理定时器', async () => {
    const { useLogStream } = await import('../useLogStream');
    const { unmount } = makeWrapper(useLogStream);
    await vi.advanceTimersByTimeAsync(0);
    unmount();
    const callCount = fetchRecentEvents.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    // unmount 后不再拉取
    expect(fetchRecentEvents.mock.calls.length).toBe(callCount);
  });
});
