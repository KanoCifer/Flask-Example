import { describe, it, expect, vi, afterEach } from 'vitest';
import { useAnimateNumber } from '../useAnimateNumber';
import { flushRAF } from '@/test/setup';

describe('useAnimateNumber', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('初始 displayValue 为 0', () => {
    const { displayValue } = useAnimateNumber();
    expect(displayValue.value).toBe(0);
  });

  it('animateTo 第 0 帧值为 0', () => {
    const { displayValue, animateTo } = useAnimateNumber(800);
    animateTo(100);
    flushRAF(0);
    expect(displayValue.value).toBe(0);
  });

  it('animateTo 逐步推进多帧达到目标值', () => {
    const { displayValue, animateTo } = useAnimateNumber(800);
    animateTo(100);

    // startTime 在第 0 帧设为 0
    flushRAF(0);
    expect(displayValue.value).toBe(0);

    // 中间帧
    flushRAF(400);
    expect(displayValue.value).toBe(50);

    // 最终帧
    flushRAF(800);
    expect(displayValue.value).toBe(100);
  });

  it('animateTo 覆盖前一个动画', () => {
    const { displayValue, animateTo } = useAnimateNumber(800);
    animateTo(50);
    flushRAF(0);
    flushRAF(400);
    expect(displayValue.value).toBe(25);

    // 中途切换到新目标（startTime 重置为 null）
    animateTo(200);
    flushRAF(1000); // 新 startTime = 1000
    expect(displayValue.value).toBe(0);

    flushRAF(1800); // elapsed = 800
    expect(displayValue.value).toBe(200);
  });

  it('document.hidden 时暂停动画', () => {
    const { displayValue, animateTo } = useAnimateNumber(800);
    animateTo(100);

    flushRAF(0);
    flushRAF(400);
    expect(displayValue.value).toBe(50);

    // 模拟标签隐藏
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    });

    flushRAF(1200); // 即使时间前进也不应推进
    expect(displayValue.value).toBe(50);

    // 恢复可见
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => false,
    });

    // 继续推进 —— elapsed 从 startTime=0 算起
    flushRAF(1600); // elapsed = 1600 > 800
    expect(displayValue.value).toBe(100);
  });
});
