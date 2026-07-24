import {
  consumeSseStream,
  type SseHandlers,
} from '@/composables/useSseStream';
import type {
  AiStreamFrame,
  StreamThreadBody,
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
 * SSE 端点走 `consumeSseStream`(raw fetch)。所有调用方通过该 port 访问 LLM，
 * 不再直接持有 fetch。
 */
export interface AiGateway {
  /** 流式生成 AI 总结 / 对话（mode 字段区分）。 */
  streamThread(
    body: StreamThreadBody,
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
  streamThread: (body, handlers, signal) =>
    stream('/v2/llm/thread/stream', body, handlers, signal),
  weatherAnalysis: (body, handlers, signal) =>
    stream('/v2/llm/weather-analysis', body, handlers, signal),
};