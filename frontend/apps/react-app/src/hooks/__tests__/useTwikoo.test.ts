import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

// Mock twikoo before importing the hook
const mockInit = vi.fn();
vi.mock('twikoo', () => ({
  default: { init: mockInit },
}));

describe('useTwikoo', () => {
  it('返回的 init 函数调用 twikoo.init 并注入 envId', async () => {
    const { useTwikoo } = await import('../useTwikoo');
    const { result } = renderHook(() => useTwikoo());

    result.current({ el: '#comment', path: '/', lang: 'zh-CN' });

    expect(mockInit).toHaveBeenCalledTimes(1);
    expect(mockInit).toHaveBeenCalledWith({
      el: '#comment',
      path: '/',
      lang: 'zh-CN',
      envId: 'https://api.kanocifer.chat/twikoo',
    });
  });

  it('只传必要参数时 envId 仍注入', async () => {
    const { useTwikoo } = await import('../useTwikoo');
    const { result } = renderHook(() => useTwikoo());

    result.current({ el: '#twikoo' });

    expect(mockInit).toHaveBeenCalledWith({
      el: '#twikoo',
      envId: 'https://api.kanocifer.chat/twikoo',
    });
  });
});
