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
 * 统一处理 reader / decoder / buffer，调用方只需关心业务逻辑。
 */
export async function consumeSseStream<T = { content?: string }>(
  options: SseRequestOptions,
  handlers: SseHandlers<T>,
): Promise<void> {
  const response = await fetch(options.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: options.credentials ?? 'include',
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

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const { events, rest } = parseSseChunk(buffer);
      buffer = rest;

      let finished = false;
      for (const jsonStr of events) {
        if (jsonStr === '[DONE]') {
          finished = true;
          break;
        }
        try {
          const data = JSON.parse(jsonStr) as T;
          handlers.onData(data);
          continue;
        } catch {
          // 忽略单帧解析错误，继续消费后续帧
        }
      }
      if (finished) break;
    }
  } finally {
    // 显式释放 reader — fetch() reject 时底层 body stream 不会自动取消
    reader.cancel().catch(() => {});
  }

  handlers.onDone?.();
}