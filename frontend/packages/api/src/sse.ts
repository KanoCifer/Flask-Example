// ── SSE 流消费工具（框架无关，基于 fetch + ReadableStream）──

export interface SseHandlers<T = unknown> {
  /** Called for each parsed JSON data frame (after `[DONE]` sentinel is filtered). */
  onData: (data: T) => void;
  /** Called when the stream emits `[DONE]` */
  onDone?: () => void;
}

export interface SseRequestOptions {
  url: string;
  body: unknown;
  credentials?: RequestCredentials;
  signal?: AbortSignal;
}

/**
 * 解析一段 SSE 文本块，返回 {events, rest}，rest 留作下次拼接。
 * 跳过空行、非 data: 开头、解析失败的行。
 */
export function parseSseChunk(buffer: string): {
  events: string[];
  rest: string;
} {
  const parts = buffer.split('\n\n');
  const rest = parts.pop() || '';
  const events: string[] = [];
  for (const part of parts) {
    if (!part.trim() || !part.startsWith('data:')) continue;
    events.push(part.replace(/^data:\s*/, '').trim());
  }
  return { events, rest };
}

/**
 * POST 一个 JSON body 并以 SSE 流的形式消费响应。
 * 收到每个 data 帧时调用 onData，遇到 [DONE] 时调用 onDone。
 *
 * 凭证默认 `same-origin` —— 不向跨域发送 cookie / 凭据。
 */
export async function consumeSseStream<T = { content?: string }>(
  options: SseRequestOptions,
  handlers: SseHandlers<T>,
): Promise<void> {
  const response = await fetch(options.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: options.credentials ?? 'same-origin',
    body: JSON.stringify(options.body),
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error('网络连接失败，请重试');
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('无法读取响应流');

  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  const flushEvents = (): boolean => {
    const { events, rest } = parseSseChunk(buffer);
    buffer = rest;
    for (const jsonStr of events) {
      if (jsonStr === '[DONE]') return false;
      try {
        handlers.onData(JSON.parse(jsonStr) as T);
      } catch {
        // 忽略单帧解析错误
      }
    }
    return true;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const keepGoing = flushEvents();
    if (!keepGoing) break;
  }
  // terminal flush
  buffer += decoder.decode();
  flushEvents();

  handlers.onDone?.();
}
