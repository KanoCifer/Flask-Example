import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nextTick } from 'vue';
import { useShimmerTips } from '../useShimmerTips';

describe('useShimmerTips', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('初始 tips 包含 3 条文案', () => {
    const { tips } = useShimmerTips();
    expect(tips.value).toHaveLength(3);
    expect(tips.value[0]).toBe('分析文章结构…');
  });

  it('active 默认 false', () => {
    const { active } = useShimmerTips();
    expect(active.value).toBe(false);
  });

  it('active=true 启动轮播，interval 后第一条移到末尾', async () => {
    const { tips, active } = useShimmerTips(2000);
    active.value = true;
    await nextTick(); // watch 回调是异步的

    expect(tips.value[0]).toBe('分析文章结构…');

    vi.advanceTimersByTime(2000);
    expect(tips.value[0]).toBe('提取关键信息…');

    vi.advanceTimersByTime(2000);
    expect(tips.value[0]).toBe('生成总结内容…');

    vi.advanceTimersByTime(2000);
    // 循环回来
    expect(tips.value[0]).toBe('分析文章结构…');
  });

  it('active=false 停止轮播', async () => {
    const { tips, active } = useShimmerTips(2000);
    active.value = true;
    await nextTick();
    vi.advanceTimersByTime(2000);
    expect(tips.value[0]).toBe('提取关键信息…');

    active.value = false;
    await nextTick();
    vi.advanceTimersByTime(4000);
    // 不再轮转
    expect(tips.value[0]).toBe('提取关键信息…');
  });
});
