export interface SseHandlers<T = unknown> {
  onData: (data: T) => void;
  onDone?: () => void;
}

export interface SseRequestOptions {
  url: string;
  body: unknown;
  credentials?: RequestCredentials;
  signal?: AbortSignal;
}

function parseSseChunk(buffer: string): { events: string[]; rest: string } {
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
 * POST JSON body 并以 SSE 流消费响应。
 * 收到每个 data 帧调用 onData，遇到 [DONE] 调用 onDone。
 *
 * 凭证默认 `same-origin` —— 不向跨域发送 cookie / 凭据。旧默认
 * `'include'` 在不需要跨域 cookie 的端点上属于过度权限；调用方可显式
 * 覆盖。循环结束后执行 terminal decoder flush，避免末帧多字节 UTF-8
 * 字符跨 chunk 切分时丢尾字节。
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
  // terminal flush: stream=true 模式保留尾字节；残余 buffer 也要再消费一次
  buffer += decoder.decode();
  flushEvents();

  handlers.onDone?.();
}
