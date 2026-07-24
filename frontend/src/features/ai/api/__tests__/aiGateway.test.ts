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

import { apiClient } from '@/api/request';
import { consumeSseStream } from '@/composables/useSseStream';

describe('aiGateway', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('streamSummary', () => {
    it('forwards body, handlers, and signal to consumeSseStream', async () => {
      vi.mocked(consumeSseStream).mockResolvedValue(undefined);

      const handlers = {
        onData: vi.fn(),
        onDone: vi.fn(),
      };
      const signal = new AbortController().signal;

      await aiGateway.streamSummary(
        { title: 'T', content: 'C', model: 'M' },
        handlers,
        signal,
      );

      expect(consumeSseStream).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('/v2/llm/summary/stream'),
          body: { title: 'T', content: 'C', model: 'M' },
          signal,
        }),
        handlers,
      );
    });

    it('omits signal key when not provided', async () => {
      vi.mocked(consumeSseStream).mockResolvedValue(undefined);

      await aiGateway.streamSummary(
        { title: 'T', content: 'C', model: 'M' },
        { onData: vi.fn() },
      );

      const call = vi.mocked(consumeSseStream).mock.calls[0];
      expect(call?.[0]).not.toHaveProperty('signal');
    });
  });

  describe('streamChat', () => {
    it('forwards first-turn article fields in body', async () => {
      vi.mocked(consumeSseStream).mockResolvedValue(undefined);

      const handlers = { onData: vi.fn(), onDone: vi.fn() };

      await aiGateway.streamChat(
        {
          message: 'hi',
          session_id: 'sess-1',
          article_content: 'article body',
          article_title: 'article title',
        },
        handlers,
      );

      expect(consumeSseStream).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('/v2/llm/chat/stream'),
          body: {
            message: 'hi',
            session_id: 'sess-1',
            article_content: 'article body',
            article_title: 'article title',
          },
        }),
        handlers,
      );
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