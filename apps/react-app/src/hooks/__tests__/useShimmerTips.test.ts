import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useShimmerTips } from '../useShimmerTips';

describe('useShimmerTips', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('初始 tips 包含 3 条文案，active 为 false', () => {
    const { result } = renderHook(() => useShimmerTips());
    expect(result.current.tips).toHaveLength(3);
    expect(result.current.tips[0]).toBe('分析文章结构…');
    expect(result.current.active).toBe(false);
  });

  it('setActive(true) 启动轮播，interval 后第一条移到末尾', () => {
    const { result } = renderHook(() => useShimmerTips(2000));

    act(() => {
      result.current.setActive(true);
    });
    expect(result.current.tips[0]).toBe('分析文章结构…');

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.tips[0]).toBe('提取关键信息…');

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.tips[0]).toBe('生成总结内容…');

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.tips[0]).toBe('分析文章结构…');
  });

  it('setActive(false) 停止轮播', () => {
    const { result } = renderHook(() => useShimmerTips(2000));

    act(() => {
      result.current.setActive(true);
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.tips[0]).toBe('提取关键信息…');

    act(() => {
      result.current.setActive(false);
    });
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    // 不再轮转
    expect(result.current.tips[0]).toBe('提取关键信息…');
  });

  it('reset 恢复到初始状态', () => {
    const { result } = renderHook(() => useShimmerTips(2000));

    act(() => {
      result.current.setActive(true);
    });
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(result.current.tips[0]).toBe('生成总结内容…');

    act(() => {
      result.current.reset();
    });
    expect(result.current.tips[0]).toBe('分析文章结构…');
    expect(result.current.active).toBe(false);
  });
});
