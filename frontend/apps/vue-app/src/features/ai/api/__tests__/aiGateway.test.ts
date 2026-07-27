import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiGateway } from '@/features/ai/api/aiGateway';

vi.mock('@/api/request', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/composables/useSseStream', () => ({
  consumeSseStream: vi.fn(),
}));

import { consumeSseStream } from '@/composables/useSseStream';

describe('aiGateway', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('streamThread', () => {
    it('forwards summary-mode body, handlers, and signal to consumeSseStream', async () => {
      vi.mocked(consumeSseStream).mockResolvedValue(undefined);

      const handlers = {
        onData: vi.fn(),
        onDone: vi.fn(),
      };
      const signal = new AbortController().signal;

      await aiGateway.streamThread(
        {
          mode: 'summary',
          article_title: 'T',
          article_content: 'C',
          model: 'M',
        },
        handlers,
        signal,
      );

      expect(consumeSseStream).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('/v2/llm/thread/stream'),
          body: {
            mode: 'summary',
            article_title: 'T',
            article_content: 'C',
            model: 'M',
          },
          signal,
        }),
        handlers,
      );
    });

    it('forwards chat-mode body with session fields', async () => {
      vi.mocked(consumeSseStream).mockResolvedValue(undefined);

      const handlers = { onData: vi.fn(), onDone: vi.fn() };

      await aiGateway.streamThread(
        {
          mode: 'chat',
          message: 'hi',
          session_id: 'sess-1',
          article_content: 'article body',
          article_title: 'article title',
        },
        handlers,
      );

      expect(consumeSseStream).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('/v2/llm/thread/stream'),
          body: {
            mode: 'chat',
            message: 'hi',
            session_id: 'sess-1',
            article_content: 'article body',
            article_title: 'article title',
          },
        }),
        handlers,
      );
    });

    it('omits signal key when not provided', async () => {
      vi.mocked(consumeSseStream).mockResolvedValue(undefined);

      await aiGateway.streamThread(
        { mode: 'summary', article_content: 'C' },
        { onData: vi.fn() },
      );

      const call = vi.mocked(consumeSseStream).mock.calls[0];
      expect(call?.[0]).not.toHaveProperty('signal');
    });
  });

  describe('weatherAnalysis', () => {
    it('forwards weather_data and model_id in body', async () => {
      vi.mocked(consumeSseStream).mockResolvedValue(undefined);

      const handlers = { onData: vi.fn(), onDone: vi.fn() };

      await aiGateway.weatherAnalysis(
        {
          weather_data: { temp: 25 },
          model_id: 'Ling-2.6',
        },
        handlers,
      );

      expect(consumeSseStream).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('/v2/llm/weather-analysis'),
          body: {
            weather_data: { temp: 25 },
            model_id: 'Ling-2.6',
          },
        }),
        handlers,
      );
    });

    it('forwards signal to consumeSseStream', async () => {
      vi.mocked(consumeSseStream).mockResolvedValue(undefined);

      const signal = new AbortController().signal;

      await aiGateway.weatherAnalysis(
        { weather_data: {}, model_id: 'M' },
        { onData: vi.fn() },
        signal,
      );

      expect(consumeSseStream).toHaveBeenCalledWith(
        expect.objectContaining({ signal }),
        expect.anything(),
      );
    });
  });
});
