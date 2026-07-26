import { describe, it, expect, vi, afterEach } from 'vitest';
import { useTypewriter } from '../useTypewriter';
import { flushRAF } from '@/test/setup';

describe('useTypewriter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Push 模式 ──────────────────────────────────────────

  it('push 模式：逐帧追加文本', () => {
    const { text, push, done, isTyping } = useTypewriter();
    push('Hello World');
    expect(isTyping.value).toBe(true);

    // 每帧吐 2 个字符（累积）
    flushRAF(0);
    expect(text.value).toBe('He');

    flushRAF(1);
    expect(text.value).toBe('Hell');

    flushRAF(2);
    expect(text.value).toBe('Hello ');

    done();
    flushRAF(3);
    flushRAF(4);
    flushRAF(5);
    flushRAF(6);
    expect(text.value).toBe('Hello World');
  });

  it('push 模式：done 后 buffer 清空则停止', () => {
    const { text, push, done, isTyping, isDone } = useTypewriter();
    push('AB');
    done();

    flushRAF(0);
    expect(text.value).toBe('AB');
    expect(isDone.value).toBe(true);
    expect(isTyping.value).toBe(false);
  });

  // ── Pull 模式 ──────────────────────────────────────────

  it('pull 模式：按 speed 逐帧显示（speed 映射为 charsPerFrame）', () => {
    const { text, start, isTyping, isDone } = useTypewriter();
    // speed=24 → Math.round(24/16) = 2 chars/frame
    start('ABCDEF', 24);

    expect(isTyping.value).toBe(true);
    expect(text.value).toBe('');

    flushRAF(0);
    expect(text.value).toBe('AB');

    flushRAF(1);
    expect(text.value).toBe('ABCD');

    flushRAF(2);
    expect(text.value).toBe('ABCDEF');
    expect(isDone.value).toBe(true);
    expect(isTyping.value).toBe(false);
  });

  it('pull 模式：完成后调用 onComplete', () => {
    const onComplete = vi.fn();
    const { start } = useTypewriter();
    // speed=24 → 2 chars/frame, 'XY' 只需 1 帧
    start('XY', 24, onComplete);

    flushRAF(0);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('pull 模式：speed <= 0 时默认每帧 2 字符', () => {
    const { text, start } = useTypewriter();
    start('ABCD', 0);

    flushRAF(0);
    expect(text.value).toBe('AB');

    flushRAF(1);
    expect(text.value).toBe('ABCD');
  });

  // ── reset ──────────────────────────────────────────────

  it('reset 清空所有状态', () => {
    const { text, push, reset, isTyping, isDone } = useTypewriter();
    push('Hello');
    flushRAF(0);

    reset();
    expect(text.value).toBe('');
    expect(isTyping.value).toBe(false);
    expect(isDone.value).toBe(false);
  });
});
