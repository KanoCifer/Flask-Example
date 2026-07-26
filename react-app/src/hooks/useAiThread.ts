import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNotificationStore } from '@/stores/notificationState';
import { llmService } from '@/lib';

export interface AiContext {
  title?: string;
  content: string;
}

export type MessageKind = 'briefing' | 'chat';

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /**
   * AI 思考过程（reasoning channel）—— 与 content 分通道展示，可折叠。
   * 仅在助理消息上累积；用户消息保持空。
   */
  reasoning?: string;
  /** briefing = the opening summary; chat = a normal follow-up turn */
  kind: MessageKind;
}

export const MODEL_OPTIONS = [
  { label: 'Ring 2.6', value: 'Ring 2.6' },
  { label: 'Ling 2.6', value: 'Ling 2.6' },
] as const;

let msgSeq = 0;
const nextMsgId = () => `ai_${++msgSeq}`;

/**
 * Session id hygiene: the old React implementation used
 * `summary_${Date.now()}_${8char base36}` — predictable (~41-bit entropy)
 * and leaked "this is a summary session". The backend isolates sessions by
 * user_id namespace, so a guessable id only hits the attacker's own bucket.
 * Pure hygiene; matches the UUID-based id the Vue composable settled on.
 */
function generateSessionId(): string {
  return `chat-${crypto.randomUUID()}`;
}

function stripHtml(html: string): string {
  return html.replaceAll(/<[^>]+>/g, '');
}

function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError';
}

/**
 * Unified "AI 阅读伴侣" thread — React mirror of the Vue useAiCompanion.
 *
 * The summary is the thread's opening assistant turn (`kind: 'briefing'`);
 * everything the user asks afterwards appends as normal `chat` turns. One
 * message list, one input box, one model selector. The two backend streams
 * (stateless summary vs. session chat) stay behind a single surface for now
 * and are unified at the service layer by task-180.
 */
export function useAiThread(ctx: AiContext) {
  const notifier = useNotificationStore();

  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [model, setModel] = useState<string>(MODEL_OPTIONS[0].value);
  const [sessionId, setSessionId] = useState('');
  const [streamingBriefing, setStreamingBriefing] = useState(false);

  // Whether the next (first-in-session) chat turn still needs to attach
  // article grounding. Cleared after the first send; re-armed by clearThread.
  const [needsGrounding, setNeedsGrounding] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  // Single-slot in-flight stream controller (re-entry aborts the previous).
  const abortControllerRef = useRef<AbortController | null>(null);
  // Epoch token: bumped on every clearThread so a stream that outlives the
  // reset can't write its late callbacks into the freshly-cleared state.
  const epochRef = useRef(0);

  const pureContent = useMemo(() => stripHtml(ctx.content), [ctx.content]);

  const hasContent = messages.length > 0;
  const canSend = input.trim().length > 0 && !loading;
  const canGenerate = pureContent.length > 0 && !loading;

  const briefingIdx = useMemo(
    () => messages.findIndex((m) => m.kind === 'briefing'),
    [messages],
  );

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = containerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  /** Generate the opening summary — the briefing. */
  const generateBriefing = useCallback(async () => {
    if (!canGenerate) {
      notifier.error('文章内容为空，无法总结');
      return;
    }

    setError('');
    setLoading(true);
    setStreamingBriefing(true);

    const epoch = epochRef.current;

    // Drop any previous briefing so the new one replaces it.
    const msg: AiMessage = {
      id: nextMsgId(),
      role: 'assistant',
      content: '',
      kind: 'briefing',
    };
    setMessages((prev) => [msg, ...prev.filter((m) => m.kind !== 'briefing')]);

    abortControllerRef.current?.abort();
    const ac = new AbortController();
    abortControllerRef.current = ac;

    try {
      await llmService().streamThread(
        {
          mode: 'summary',
          article_title: ctx.title || '',
          article_content: pureContent,
          model,
        },
        {
          onData: (d) => {
            if (epoch !== epochRef.current) return;
            if (!d.content) return;
            // type 缺省按 content 处理（向后兼容 + 错误帧走 content 通道）
            const isReasoning = d.type === 'reasoning';
            const delta = d.content;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === msg.id
                  ? isReasoning
                    ? { ...m, reasoning: (m.reasoning ?? '') + delta }
                    : { ...m, content: m.content + delta }
                  : m,
              ),
            );
          },
        },
        ac.signal,
      );
    } catch (e: unknown) {
      if (isAbortError(e)) return;
      const errorMsg =
        e instanceof Error ? e.message : 'AI总结失败，请稍后重试';
      setError(errorMsg);
      notifier.error(errorMsg);
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    } finally {
      if (epoch === epochRef.current) {
        setLoading(false);
        setStreamingBriefing(false);
      }
    }
  }, [canGenerate, ctx.title, model, notifier, pureContent]);

  /** Ask a follow-up question in the same thread. */
  const send = useCallback(async () => {
    if (!canSend) return;

    const text = input.trim();
    setInput('');

    const epoch = epochRef.current;

    const userMsg: AiMessage = {
      id: nextMsgId(),
      role: 'user',
      content: text,
      kind: 'chat',
    };
    const assistantMsg: AiMessage = {
      id: nextMsgId(),
      role: 'assistant',
      content: '',
      kind: 'chat',
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    scrollToBottom();

    let currentSessionId = sessionId;
    if (!currentSessionId) {
      currentSessionId = generateSessionId();
      setSessionId(currentSessionId);
    }

    setLoading(true);
    setError('');
    const attachGrounding = needsGrounding;

    abortControllerRef.current?.abort();
    const ac = new AbortController();
    abortControllerRef.current = ac;

    try {
      await llmService().streamThread(
        {
          mode: 'chat',
          message: text,
          session_id: currentSessionId,
          ...(attachGrounding
            ? {
                article_content: ctx.content,
                article_title: ctx.title || '',
              }
            : {}),
        },
        {
          onData: (d) => {
            if (epoch !== epochRef.current) return;
            if (!d.content) return;
            // type 缺省按 content 处理（向后兼容 + 错误帧走 content 通道）
            const isReasoning = d.type === 'reasoning';
            const delta = d.content;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id
                  ? isReasoning
                    ? { ...m, reasoning: (m.reasoning ?? '') + delta }
                    : { ...m, content: m.content + delta }
                  : m,
              ),
            );
            // scrolling only matters for visible (content) deltas; reasoning
            // streams into a hidden region and the user will re-open manually.
            if (!isReasoning) scrollToBottom();
          },
        },
        ac.signal,
      );
    } catch (e: unknown) {
      if (isAbortError(e)) return;
      const errorMsg = e instanceof Error ? e.message : '对话失败，请稍后重试';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: `[ERROR] ${errorMsg}` }
            : m,
        ),
      );
      setError(errorMsg);
      notifier.error(errorMsg);
    } finally {
      if (epoch === epochRef.current) {
        setLoading(false);
        // First send of this session done; future turns skip grounding.
        setNeedsGrounding(false);
      }
    }
  }, [
    canSend,
    ctx.content,
    ctx.title,
    input,
    needsGrounding,
    notifier,
    scrollToBottom,
    sessionId,
  ]);

  const onKeydown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void send();
      }
    },
    [send],
  );

  function clearThread() {
    abortControllerRef.current?.abort();
    epochRef.current += 1;
    setMessages([]);
    setSessionId('');
    setError('');
    setNeedsGrounding(true);
    setLoading(false);
    setStreamingBriefing(false);
  }

  /**
   * User-initiated cancel of the in-flight stream. Aborts the signal, which
   * rejects the fetch with AbortError — caught and swallowed in the stream
   * handlers' catch, so any partial content already streamed is preserved.
   * `loading` is cleared by that call's `finally`.
   */
  function cancel() {
    abortControllerRef.current?.abort();
  }

  // Tear-down safety for a stream that outlives the component.
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return {
    messages,
    input,
    setInput,
    loading,
    error,
    model,
    setModel,
    sessionId,
    modelOptions: MODEL_OPTIONS,
    hasContent,
    canSend,
    canGenerate,
    streamingBriefing,
    briefingIdx,
    containerRef,
    scrollToBottom,
    generateBriefing,
    send,
    onKeydown,
    clearThread,
    cancel,
  };
}
