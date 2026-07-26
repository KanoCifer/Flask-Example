import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useClickOutside } from '../useClickOutside';

function createRefWithElement(): React.RefObject<HTMLElement | null> {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const ref = { current: el };
  return ref as React.RefObject<HTMLElement | null>;
}

describe('useClickOutside', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('点击外部区域时触发 callback', () => {
    const callback = vi.fn();
    const ref = createRefWithElement();

    renderHook(() => useClickOutside(ref, callback));

    // 点击 body（外部区域）
    document.body.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true }),
    );
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('点击内部区域时不触发 callback', () => {
    const callback = vi.fn();
    const ref = createRefWithElement();

    renderHook(() => useClickOutside(ref, callback));

    // 点击元素内部
    ref.current!.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true }),
    );
    expect(callback).not.toHaveBeenCalled();
  });
});
