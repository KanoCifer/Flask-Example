import { describe, it, expect, vi } from 'vitest';
import { consumeSseStream } from '@readinglist/api';

function makeReader(chunks: (string | Uint8Array)[]) {
  let idx = 0;
  const encoder = new TextEncoder();
  return {
    read: vi.fn(async () => {
      if (idx >= chunks.length) {
        return { done: true, value: undefined };
      }
      const c = chunks[idx++];
      const value = typeof c === 'string' ? encoder.encode(c) : c;
      return { done: false, value };
    }),
    cancel: vi.fn(async () => {}),
  };
}

describe('consumeSseStream', () => {
  it('解析 SSE 数据帧并调用 onData，流结束后调用 onDone', async () => {
    const chunks = [
      'data: {"content":"Hello"}\n\n',
      'data: {"content":" World"}\n\n',
    ];
    let idx = 0;

    const mockReader = {
      read: vi.fn(async () => {
        if (idx < chunks.length) {
          const encoder = new TextEncoder();
          return { done: false, value: encoder.encode(chunks[idx++]) };
        }
        return { done: true, value: undefined };
      }),
    };

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        body: { getReader: () => mockReader },
      })),
    );

    const onData = vi.fn();
    const onDone = vi.fn();

    await consumeSseStream(
      { url: '/api/test', body: { prompt: 'hi' } },
      { onData, onDone },
    );

    expect(onData).toHaveBeenCalledTimes(2);
    expect(onData).toHaveBeenNthCalledWith(1, { content: 'Hello' });
    expect(onData).toHaveBeenNthCalledWith(2, { content: ' World' });
    // 流结束时 onDone 被调用
    expect(onDone).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it('收到 [DONE] 时停止解析后续帧并调用 onDone', async () => {
    const chunks = [
      'data: {"content":"Hi"}\n\n',
      'data: [DONE]\n\n',
      'data: {"content":"Ignored"}\n\n',
    ];
    let idx = 0;

    const mockReader = {
      read: vi.fn(async () => {
        if (idx < chunks.length) {
          const encoder = new TextEncoder();
          return { done: false, value: encoder.encode(chunks[idx++]) };
        }
        return { done: true, value: undefined };
      }),
    };

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        body: { getReader: () => mockReader },
      })),
    );

    const onData = vi.fn();
    const onDone = vi.fn();

    await consumeSseStream({ url: '/api/test', body: {} }, { onData, onDone });

    // 只有 [DONE] 之前的帧被处理
    expect(onData).toHaveBeenCalledTimes(1);
    expect(onData).toHaveBeenCalledWith({ content: 'Hi' });
    expect(onDone).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it('HTTP 错误时抛出异常', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500 })),
    );

    await expect(
      consumeSseStream({ url: '/api/test', body: {} }, { onData: vi.fn() }),
    ).rejects.toThrow('网络连接失败，请重试');

    vi.unstubAllGlobals();
  });

  it('空响应体时抛出异常', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, body: null })),
    );

    await expect(
      consumeSseStream({ url: '/api/test', body: {} }, { onData: vi.fn() }),
    ).rejects.toThrow('无法读取响应流');

    vi.unstubAllGlobals();
  });

  // F10: 末帧多字节 UTF-8 跨 chunk 切分时必须 terminal flush。
  it('flushes decoder at end so split multibyte chars survive', async () => {
    const partial1 = new Uint8Array([0xf0, 0x9f]); // first 2 bytes of '🐱'
    const partial2 = new Uint8Array([0x90, 0xb1]); // last 2 bytes

    const mockReader = makeReader([
      'data: {"content":"hi "}\n\n',
      'data: {"content":"',
      partial1,
      partial2,
      '"}\n\n',
    ]);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, body: { getReader: () => mockReader } })),
    );

    const onData = vi.fn();
    await consumeSseStream({ url: '/api/test', body: {} }, { onData });

    expect(onData).toHaveBeenCalledTimes(2);
    expect(onData).toHaveBeenNthCalledWith(2, { content: '🐱' });

    vi.unstubAllGlobals();
  });

  // F3: 默认 credentials 不是 'include'。
  it('defaults credentials to same-origin, not include', async () => {
    const mockReader = makeReader(['data: {"content":"x"}\n\n']);
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        ({
          ok: true,
          body: { getReader: () => mockReader },
        }) as unknown as Response,
    );
    vi.stubGlobal('fetch', fetchMock);

    await consumeSseStream({ url: '/api/test', body: {} }, { onData: vi.fn() });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.credentials).toBe('same-origin');

    vi.unstubAllGlobals();
  });

  it('lets caller override the credentials default', async () => {
    const mockReader = makeReader(['data: {"content":"x"}\n\n']);
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        ({
          ok: true,
          body: { getReader: () => mockReader },
        }) as unknown as Response,
    );
    vi.stubGlobal('fetch', fetchMock);

    await consumeSseStream(
      { url: '/api/test', body: {}, credentials: 'include' },
      { onData: vi.fn() },
    );

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.credentials).toBe('include');

    vi.unstubAllGlobals();
  });
});
