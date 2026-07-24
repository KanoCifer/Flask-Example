import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/api/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/apiClient')>();
  return {
    default: {
      post: vi.fn(),
    },
    extractData: actual.extractData,
  };
});

import apiClient from '@/api/apiClient';
import { llmService } from '../llmService';

/**
 * Build a fetch mock that emits the given SSE chunks once, then signals done.
 * Mirrors the shape used in useSseStream.test.ts.
 */
function mockSseFetch(chunks: string[]) {
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
    vi.fn(async () => ({ ok: true, body: { getReader: () => mockReader } })),
  );
}

describe('llmService', () => {
  let service: ReturnType<typeof llmService>;

  beforeEach(() => {
    service = llmService();
    vi.mocked(apiClient.post).mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getCachedChat', () => {
    it('POSTs to v2/llm/history/chat and unwraps messages', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({
        data: {
          data: {
            cached: true,
            messages: [{ role: 'user', content: 'hi' }],
            session_id: 'sid-1',
          },
        },
      });

      const result = await service.getCachedChat({
        article_content: 'content',
        article_title: 'T',
      });

      expect(apiClient.post).toHaveBeenCalledWith('v2/llm/history/chat', {
        article_content: 'content',
        article_title: 'T',
      });
      expect(result.messages).toHaveLength(1);
      expect(result.session_id).toBe('sid-1');
    });
  });

  describe('streamThread', () => {
    it('POSTs to /v2/llm/thread/stream with mode=summary and streams frames', async () => {
      mockSseFetch([
        'data: {"content":"Hello"}\n\n',
        'data: {"content":" world"}\n\n',
        'data: [DONE]\n\n',
      ]);

      const onData = vi.fn();
      await service.streamThread(
        {
          mode: 'summary',
          article_title: 't',
          article_content: 'c',
          model: 'Ring 2.6',
        },
        { onData },
      );

      const fetchMock = vi.mocked(globalThis.fetch);
      const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
      const body = JSON.parse(init?.body as string);
      expect(body).toEqual({
        mode: 'summary',
        article_title: 't',
        article_content: 'c',
        model: 'Ring 2.6',
      });
      expect(onData).toHaveBeenCalledTimes(2);
      expect(onData).toHaveBeenNthCalledWith(1, { content: 'Hello' });
      expect(onData).toHaveBeenNthCalledWith(2, { content: ' world' });
    });

    it('omits article fields for chat mode when not provided', async () => {
      mockSseFetch(['data: {"content":"reply"}\n\n', 'data: [DONE]\n\n']);

      const onData = vi.fn();
      await service.streamThread(
        { mode: 'chat', message: 'hi', session_id: 'sid' },
        { onData },
      );

      const fetchMock = vi.mocked(globalThis.fetch);
      const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
      const body = JSON.parse(init?.body as string);
      expect(body).toEqual({ mode: 'chat', message: 'hi', session_id: 'sid' });
      expect(onData).toHaveBeenCalledWith({ content: 'reply' });
    });

    it('includes article grounding on first chat message', async () => {
      mockSseFetch(['data: {"content":"reply"}\n\n', 'data: [DONE]\n\n']);

      const onData = vi.fn();
      await service.streamThread(
        {
          mode: 'chat',
          message: 'hi',
          session_id: 'sid',
          article_content: 'full text',
          article_title: 'Title',
        },
        { onData },
      );

      const fetchMock = vi.mocked(globalThis.fetch);
      const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
      const body = JSON.parse(init?.body as string);
      expect(body).toEqual({
        mode: 'chat',
        message: 'hi',
        session_id: 'sid',
        article_content: 'full text',
        article_title: 'Title',
      });
    });

    it('forwards AbortSignal to fetch', async () => {
      mockSseFetch(['data: {"content":"x"}\n\n', 'data: [DONE]\n\n']);

      const controller = new AbortController();
      await service.streamThread(
        { mode: 'summary', article_content: 'c' },
        { onData: vi.fn() },
        controller.signal,
      );

      const fetchMock = vi.mocked(globalThis.fetch);
      const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
      expect(init?.signal).toBe(controller.signal);
    });
  });

  describe('weatherAnalysis', () => {
    it('streams content chunks via onChunk callback', async () => {
      mockSseFetch([
        'data: {"content":"rainy"}\n\n',
        'data: {"content":" and windy"}\n\n',
        'data: [DONE]\n\n',
      ]);

      const onChunk = vi.fn();
      await service.weatherAnalysis(
        { weather_data: { location: [121, 31] } },
        onChunk,
      );

      expect(onChunk).toHaveBeenCalledTimes(2);
      expect(onChunk).toHaveBeenNthCalledWith(1, 'rainy', 'content');
      expect(onChunk).toHaveBeenNthCalledWith(2, ' and windy', 'content');
    });

    it('splits reasoning and content kinds via onChunk callback', async () => {
      mockSseFetch([
        'data: {"type":"reasoning","content":"thinking..."}\n\n',
        'data: {"type":"content","content":"rainy"}\n\n',
        'data: {"type":"reasoning","content":" more thinking"}\n\n',
        'data: {"type":"content","content":" and windy"}\n\n',
        'data: [DONE]\n\n',
      ]);

      const onChunk = vi.fn();
      await service.weatherAnalysis(
        { weather_data: { location: [121, 31] } },
        onChunk,
      );

      expect(onChunk).toHaveBeenCalledTimes(4);
      expect(onChunk).toHaveBeenNthCalledWith(1, 'thinking...', 'reasoning');
      expect(onChunk).toHaveBeenNthCalledWith(2, 'rainy', 'content');
      expect(onChunk).toHaveBeenNthCalledWith(3, ' more thinking', 'reasoning');
      expect(onChunk).toHaveBeenNthCalledWith(4, ' and windy', 'content');
    });

    it('defaults missing type to content', async () => {
      mockSseFetch([
        'data: {"content":"no-type"}\n\n',
        'data: {"type":"content","content":"typed"}\n\n',
        'data: [DONE]\n\n',
      ]);

      const onChunk = vi.fn();
      await service.weatherAnalysis({ weather_data: {} }, onChunk);

      expect(onChunk).toHaveBeenNthCalledWith(1, 'no-type', 'content');
      expect(onChunk).toHaveBeenNthCalledWith(2, 'typed', 'content');
    });

    it('forwards AbortSignal to fetch', async () => {
      mockSseFetch(['data: {"content":"x"}\n\n', 'data: [DONE]\n\n']);

      const controller = new AbortController();
      await service.weatherAnalysis(
        { weather_data: {} },
        vi.fn(),
        controller.signal,
      );

      const fetchMock = vi.mocked(globalThis.fetch);
      const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
      expect(init?.signal).toBe(controller.signal);
    });
  });

  describe('streamThread dual-channel', () => {
    it('forwards StreamFrame.type through onData unchanged', async () => {
      mockSseFetch([
        'data: {"type":"reasoning","content":"think1"}\n\n',
        'data: {"type":"content","content":"out1"}\n\n',
        'data: {"type":"reasoning","content":"think2"}\n\n',
        'data: [DONE]\n\n',
      ]);

      const onData = vi.fn();
      await service.streamThread(
        { mode: 'summary', article_content: 'c' },
        { onData },
      );

      expect(onData).toHaveBeenCalledTimes(3);
      expect(onData).toHaveBeenNthCalledWith(
        1,
        { type: 'reasoning', content: 'think1' },
      );
      expect(onData).toHaveBeenNthCalledWith(
        2,
        { type: 'content', content: 'out1' },
      );
      expect(onData).toHaveBeenNthCalledWith(
        3,
        { type: 'reasoning', content: 'think2' },
      );
    });
  });
});
