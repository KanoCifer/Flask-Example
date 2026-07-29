import apiClient, { extractData, consumeSseStream } from '@readinglist/api';

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

/** 单包流通道标识 —— 'reasoning' 为 AI 思考过程，'content' 为正文 delta。缺省视为 'content'（向后兼容）。 */
export type StreamFrameType = 'reasoning' | 'content';

export interface StreamFrame {
  content?: string;
  is_end?: boolean;
  type?: StreamFrameType;
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

  /**
   * AI 天气分析（流式） —— 第二参数 `kind` 区分推理 / 正文通道。
   * 旧调用方不传 `kind` 时仍按 content 行为兼容。
   */
  weatherAnalysis(
    payload: { weather_data: unknown },
    onChunk: (content: string, kind?: StreamFrameType) => void,
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
          if (!data.content) return;
          // type 缺省按 content 处理 —— 兼容无 type 字段的旧帧与错误帧
          // （错误帧后端也 type='content'，保持视觉上仍能看到错误标记）
          const kind: StreamFrameType =
            data.type === 'reasoning' ? 'reasoning' : 'content';
          onChunk(data.content, kind);
        },
      },
    );
  },
});
