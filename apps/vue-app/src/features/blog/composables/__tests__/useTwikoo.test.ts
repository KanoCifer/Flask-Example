import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// mock twikoo 模块
const mockInit = vi.fn();
vi.mock('twikoo', () => ({
  default: { init: mockInit },
}));

describe('useTwikoo', () => {
  beforeEach(() => {
    mockInit.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('调用 twikoo.init 并注入 envId', async () => {
    const { useTwikoo } = await import('@/composables');
    await useTwikoo({ el: '#comment', path: '/', lang: 'zh-CN' });

    expect(mockInit).toHaveBeenCalledTimes(1);
    expect(mockInit).toHaveBeenCalledWith({
      el: '#comment',
      path: '/',
      lang: 'zh-CN',
      envId: 'https://api.kanocifer.chat/twikoo',
    });
  });

  it('只传必要参数时 envId 仍注入', async () => {
    const { useTwikoo } = await import('@/composables');
    await useTwikoo({ el: '#twikoo' });

    expect(mockInit).toHaveBeenCalledWith({
      el: '#twikoo',
      envId: 'https://api.kanocifer.chat/twikoo',
    });
  });
});
