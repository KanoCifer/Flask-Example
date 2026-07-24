import { apiClient } from '@/api/request';
import {
  consumeSseStream,
  type SseHandlers,
} from '@/composables/useSseStream';
import type {
  CachedChatResponse,
  CachedAiPayload,
  CachedSummaryResponse,
  AiStreamFrame,
  StreamChatBody,
  StreamSummaryBody,
  WeatherAnalysisBody,
} from '@/features/ai/types';

// 缓存一次 origin (env + location.host 在运行时不变)
const API_BASE = (() => {
  const envBase = import.meta.env.VITE_API_BASE || '';
  if (envBase.startsWith('http://') || envBase.startsWith('https://')) {
    return envBase;
  }
  return `${window.location.protocol}//${window.location.host}${envBase}`;
})();

function buildWsUrl(): string {
  return API_BASE;
}
/**
 * 适配 `/v2/llm/*` 端点的 gateway port。
 *
 * 沿用 `rssGateway` / `mapGateway` 模式：JSON 端点走 `@/utils` 的 apiClient(axios)，
 * SSE 端点走 `consumeSseStream`(raw fetch)。所有调用方通过该 port 访问 LLM，
 * 不再直接持有 fetch。
 */
export interface AiGateway {
  /** 静默查询后端缓存的 AI 总结。未登录也会发起，命中即返回。 */
  getCachedSummary(payload: CachedAiPayload): Promise<CachedSummaryResponse>;
  /** 静默查询后端缓存的 AI 对话历史。 */
  getCachedChat(payload: CachedAiPayload): Promise<CachedChatResponse>;
  /** 流式生成 AI 文章总结。 */
  streamSummary(
    body: StreamSummaryBody,
    handlers: SseHandlers<AiStreamFrame>,
    signal?: AbortSignal,
  ): Promise<void>;
  /** 流式 AI 对话。 */
  streamChat(
    body: StreamChatBody,
    handlers: SseHandlers<AiStreamFrame>,
    signal?: AbortSignal,
  ): Promise<void>;
  /** 流式生成天气/钓鱼 AI 分析。 */
  weatherAnalysis(
    body: WeatherAnalysisBody,
    handlers: SseHandlers<AiStreamFrame>,
    signal?: AbortSignal,
  ): Promise<void>;
}

const postCached = <T>(path: string, payload: unknown) =>
  apiClient.post<{ data: T }>(path, payload).then((r) => r.data.data);

const stream = (
  path: string,
  body: unknown,
  handlers: SseHandlers<AiStreamFrame>,
  signal?: AbortSignal,
) =>
  consumeSseStream<AiStreamFrame>(
    { url: `${buildWsUrl()}${path}`, body, ...(signal ? { signal } : {}) },
    handlers,
  );

export const aiGateway: AiGateway = {
  getCachedSummary: (payload) => postCached<CachedSummaryResponse>(
    'v2/llm/history/summary',
    payload,
  ),
  getCachedChat: (payload) => postCached<CachedChatResponse>(
    'v2/llm/history/chat',
    payload,
  ),
  streamSummary: (body, handlers, signal) =>
    stream('/v2/llm/summary/stream', body, handlers, signal),
  streamChat: (body, handlers, signal) =>
    stream('/v2/llm/chat/stream', body, handlers, signal),
  weatherAnalysis: (body, handlers, signal) =>
    stream('/v2/llm/weather-analysis', body, handlers, signal),
};