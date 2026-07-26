import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@/lib', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib')>();
  return {
    ...actual,
    llmService: vi.fn(),
  };
});

import { llmService } from '@/lib';
import { fishingMapService } from '../service';

function makeSseChunks(chunks: string[]) {
  let idx = 0;
  const reader = {
    read: vi.fn(async () => {
      if (idx < chunks.length) {
        return {
          done: false,
          value: new TextEncoder().encode(chunks[idx++]),
        };
      }
      return { done: true, value: undefined };
    }),
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, body: { getReader: () => reader } })),
  );
}

describe('fishingMapService.generateAnalysis', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(llmService).mockReset();
  });

  it('forwards kind to the underlying weatherAnalysis onChunk (reasoning vs content)', async () => {
    makeSseChunks([
      'data: {"type":"reasoning","content":"thinking..."}\n\n',
      'data: {"type":"content","content":"rainy"}\n\n',
      'data: {"type":"reasoning","content":" more thinking"}\n\n',
      'data: {"type":"content","content":" and windy"}\n\n',
      'data: [DONE]\n\n',
    ]);

    const weatherAnalysis = vi.fn(async (_payload, onChunk) => {
      onChunk('thinking...', 'reasoning');
      onChunk('rainy', 'content');
      onChunk(' more thinking', 'reasoning');
      onChunk(' and windy', 'content');
    });
    vi.mocked(llmService).mockReturnValue({
      // methods we don't exercise
      getCachedChat: vi.fn(),
      streamThread: vi.fn(),
      weatherAnalysis,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const onChunk = vi.fn();
    await fishingMapService().generateAnalysis(
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        liveWeather: undefined,
        forecasts: [],
        tideData: null,
        weatherIndices: [],
        locationName: 'sh',
        modelId: 'Ling-2.6-1T',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      onChunk,
    );

    expect(weatherAnalysis).toHaveBeenCalledTimes(1);
    // 透传给 service 上层的 kind 必须保留 —— 这是分流的关键。
    expect(onChunk).toHaveBeenCalledTimes(4);
    expect(onChunk).toHaveBeenNthCalledWith(1, 'thinking...', 'reasoning');
    expect(onChunk).toHaveBeenNthCalledWith(2, 'rainy', 'content');
    expect(onChunk).toHaveBeenNthCalledWith(3, ' more thinking', 'reasoning');
    expect(onChunk).toHaveBeenNthCalledWith(4, ' and windy', 'content');
  });

  it('forwards an undefined kind when the upstream does not pass one (pure passthrough)', async () => {
    // service.ts 是纯透传层 —— kind 缺省处理逻辑在 llmService.weatherAnalysis 内部
    // (见 llmService.test.ts 'defaults missing type to content')。
    // 这里只验证透传不丢也不改写 kind 字段。
    const weatherAnalysis = vi.fn(async (_payload, onChunk) => {
      // 模拟上游以旧单参方式回调
      onChunk('hello');
    });
    vi.mocked(llmService).mockReturnValue({
      getCachedChat: vi.fn(),
      streamThread: vi.fn(),
      weatherAnalysis,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const onChunk = vi.fn();
    await fishingMapService().generateAnalysis(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onChunk as any,
    );

    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onChunk).toHaveBeenCalledWith('hello', undefined);
  });
});
