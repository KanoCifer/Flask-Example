import { describe, it, expect, vi } from 'vitest';
import { consumeSseStream, parseSseChunk } from '../useSseStream';

/**
 * 构造一个按 chunks 顺序产出 Uint8Array 的 mock reader，
 * 模拟 SSE 流被网络切成多段到达。
 */
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

function stubFetchOk(reader: ReturnType<typeof makeReader>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, body: { getReader: () => reader } })),
  );
}

describe('consumeSseStream', () => {
  it('parses SSE data frames and fires onDone after stream ends', async () => {
    const reader = makeReader([
      'data: {"content":"Hello"}\n\n',
      'data: {"content":" World"}\n\n',
    ]);
    stubFetchOk(reader);

    const onData = vi.fn();
    const onDone = vi.fn();

    await consumeSseStream(
      { url: '/api/test', body: { prompt: 'hi' } },
      { onData, onDone },
    );

    expect(onData).toHaveBeenCalledTimes(2);
    expect(onData).toHaveBeenNthCalledWith(1, { content: 'Hello' });
    expect(onData).toHaveBeenNthCalledWith(2, { content: ' World' });
    expect(onDone).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it('stops on [DONE] and ignores later frames in the same chunk', async () => {
    const reader = makeReader([
      'data: {"content":"Hi"}\n\ndata: [DONE]\n\ndata: {"content":"Ignored"}\n\n',
    ]);
    stubFetchOk(reader);

    const onData = vi.fn();
    const onDone = vi.fn();

    await consumeSseStream({ url: '/api/test', body: {} }, { onData, onDone });

    expect(onData).toHaveBeenCalledTimes(1);
    expect(onData).toHaveBeenCalledWith({ content: 'Hi' });
    expect(onDone).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it('throws on HTTP error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500 })),
    );

    await expect(
      consumeSseStream({ url: '/api/test', body: {} }, { onData: vi.fn() }),
    ).rejects.toThrow('网络连接失败，请重试');

    vi.unstubAllGlobals();
  });

  it('throws when response body is null', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, body: null })),
    );

    await expect(
      consumeSseStream({ url: '/api/test', body: {} }, { onData: vi.fn() }),
    ).rejects.toThrow('无法读取响应流');

    vi.unstubAllGlobals();
  });

  // F10: 末帧多字节 UTF-8 字符跨 chunk 切分时必须 flush。
  it('flushes the decoder after stream ends so split multibyte chars survive', async () => {
    // '🐱' is U+1F431, encoded as 4 UTF-8 bytes: 0xF0 0x9F 0x90 0xB1
    // Split it across the final two chunks to force a buffered tail byte.
    const partial1 = new Uint8Array([0xf0, 0x9f]); // first 2 bytes of '🐱'
    const partial2 = new Uint8Array([0x90, 0xb1]); // last 2 bytes

    const reader = makeReader([
      'data: {"content":"hello "}\n\n',
      'data: {"content":"',
      partial1,
      partial2,
      '"}\n\n',
    ]);
    stubFetchOk(reader);

    const onData = vi.fn();
    await consumeSseStream({ url: '/api/test', body: {} }, { onData });

    // The trailing chunk concatenated the partial bytes via terminal flush;
    // the emoji survives and the second onData call sees the full payload.
    expect(onData).toHaveBeenCalledTimes(2);
    expect(onData).toHaveBeenNthCalledWith(1, { content: 'hello ' });
    expect(onData).toHaveBeenNthCalledWith(2, { content: '🐱' });

    vi.unstubAllGlobals();
  });

  // F3: credentials 默认值不再是 'include'。
  it('defaults credentials to same-origin, not include', async () => {
    const reader = makeReader(['data: {"content":"x"}\n\n']);
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        ({
          ok: true,
          body: { getReader: () => reader },
        }) as unknown as Response,
    );
    vi.stubGlobal('fetch', fetchMock);

    await consumeSseStream({ url: '/api/test', body: {} }, { onData: vi.fn() });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.credentials).toBe('same-origin');

    vi.unstubAllGlobals();
  });

  it('lets caller override the credentials default', async () => {
    const reader = makeReader(['data: {"content":"x"}\n\n']);
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        ({
          ok: true,
          body: { getReader: () => reader },
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

describe('parseSseChunk', () => {
  it('extracts complete events and keeps the trailing partial', () => {
    const r = parseSseChunk('data: {"a":1}\n\ndata: {"b":2}');
    expect(r.events).toEqual(['{"a":1}']);
    expect(r.rest).toBe('data: {"b":2}');
  });

  it('skips empty lines and non-data lines', () => {
    const r = parseSseChunk('\nevent: ping\n\ndata: {"x":1}\n\n');
    expect(r.events).toEqual(['{"x":1}']);
  });
});
