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
 *
 * 凭证（credentials）默认 `same-origin` —— 不向跨域发送 cookie / 凭据。
 * 旧默认 `'include'` 在不需要跨域 cookie 的端点（如 `/v2/llm/*`，仅
 * 依赖 Authorization Bearer）上是过度权限。调用方可显式覆盖。
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

  /**
   * 处理 buffer 内的完整 SSE 事件（双换行分隔）。残余留作下次拼接。
   */
  const flushEvents = () => {
    const { events, rest } = parseSseChunk(buffer);
    buffer = rest;
    for (const jsonStr of events) {
      if (jsonStr === '[DONE]') return false; // 终止信号由调用方读取
      try {
        handlers.onData(JSON.parse(jsonStr) as T);
      } catch {
        // 忽略单帧解析错误
      }
    }
    return true;
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const keepGoing = flushEvents();
      if (!keepGoing) break;
    }
    // F10: stream=true 模式保留尾字节等"非完整"字符，循环结束后
    // 必须显式 flush 一次解码器，否则末帧多字节 UTF-8 跨 chunk 切分
    // 时会丢尾字节。残余 buffer 同样需要再消费一次（部分 SSE 实现
    // 在收尾时不写双换行）。
    buffer += decoder.decode();
    flushEvents();
  } finally {
    // 显式释放 reader — fetch() reject 时底层 body stream 不会自动取消
    reader.cancel().catch(() => {});
  }

  handlers.onDone?.();
}
