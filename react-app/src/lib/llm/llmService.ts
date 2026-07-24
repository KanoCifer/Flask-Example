import apiClient, { extractData } from '@/api/apiClient';
import { consumeSseStream } from '@/hooks/useSseStream';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CachedSummaryResponse {
  cached?: boolean;
  summary?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CachedChatResponse {
  cached?: boolean;
  messages?: ChatMessage[];
  session_id?: string;
}

export interface StreamThreadPayload {
  mode: 'summary' | 'chat';
  message?: string;
  session_id?: string;
  article_content?: string;
  article_title?: string;
  model?: string;
}

export interface StreamFrame {
  content?: string;
  is_end?: boolean;
}

export interface SseHandlers {
  onData: (data: StreamFrame) => void;
  onDone?: () => void;
}

export interface LlmService {
  /** 静默查询历史对话 */
  getCachedChat(payload: {
    article_content: string;
    article_title?: string;
  }): Promise<CachedChatResponse>;

  /** 统一的 thread 流式入口（总结 / 对话） */
  streamThread(
    payload: StreamThreadPayload,
    handlers: SseHandlers,
    signal?: AbortSignal,
  ): Promise<void>;

  /** AI 天气分析（流式） */
  weatherAnalysis(
    payload: { weather_data: unknown },
    onChunk: (content: string) => void,
    signal?: AbortSignal,
  ): Promise<void>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const apiBase = import.meta.env.VITE_API_BASE || '/';

// ── Service ──────────────────────────────────────────────────────────────────

export const llmService = (): LlmService => ({
  async getCachedChat(payload) {
    const res = await apiClient.post<{ data: CachedChatResponse }>(
      'v2/llm/history/chat',
      payload,
    );
    return extractData(res);
  },

  async streamThread(payload, handlers, signal) {
    await consumeSseStream<StreamFrame>(
      {
        url: `${apiBase}/v2/llm/thread/stream`,
        body: payload,
        signal,
      },
      handlers,
    );
  },

  async weatherAnalysis(payload, onChunk, signal) {
    await consumeSseStream<StreamFrame>(
      {
        url: `${apiBase}/v2/llm/weather-analysis`,
        body: payload,
        signal,
      },
      {
        onData: (data) => {
          if (data.content) onChunk(data.content);
        },
      },
    );
  },
});
