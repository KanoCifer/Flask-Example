import { computed, onUnmounted, ref, watch } from 'vue';
import { aiGateway } from '@readinglist/api';
import { useTypewriter } from '@/composables/useTypewriter';
import { stripHtml } from '@/features/ai/lib/stripHtml';

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
  { label: 'Ling 3.0 Flash', value: 'Ling 3.0 Flash' },
] as const;

let msgSeq = 0;
const nextMsgId = () => `ai_${++msgSeq}`;

/**
 * Module-scoped, single-slot controller for the in-flight SSE stream.
 * We hold at most one because the composable models a single thread:
 * re-entry (re-generate / new question) aborts the previous stream,
 * which prevents concurrent writes to the same message and write-after-
 * unmount races when the component is torn down mid-flight.
 */
let abortController: AbortController | null = null;

function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError';
}

function generateSessionId(): string {
  // F6: 旧实现是 `summary_${Date.now()}_${8char base36}` —— 既可预测
  // (~41-bit entropy) 又泄露"这是 summary session"的意图。已读
  // backend/app/core/agent.py:269-274 + 360-395 确认 Agno session
  // 在 agent.arun(..., user_id=..., session_id=...) 中由 user_id 命名
  // 空间隔离，get_history 在 line 367 显式按 user_id 过滤。可猜的
  // session_id 只能命中攻击者自己的桶，无跨用户劫持。本改动纯 hygiene。
  return `chat-${crypto.randomUUID()}`;
}

/**
 * Unified "AI 阅读伴侣" thread.
 *
 * The summary is no longer a separate mode — it is the thread's opening
 * assistant turn (`kind: 'briefing'`). Everything the user asks afterwards
 * appends as normal `chat` turns. One message list, one input box, one model
 * selector. The two backend streams (stateless summary vs. session chat) are
 * hidden behind a single surface.
 */
export function useAiCompanion(ctx: AiContext) {
  const messages = ref<AiMessage[]>([]);
  const input = ref('');
  const loading = ref(false);
  const error = ref('');
  const model = ref<string>(MODEL_OPTIONS[0].value);
  const sessionId = ref('');
  // Whether the next (first-in-session) chat turn still needs to attach
  // article grounding. Cleared after the first send. Re-armed by clearThread
  // and on a fresh session (no session_id loaded from cache). The old
  // `user_msgs.length === 1` heuristic broke once restore() populated history.
  const needsGrounding = ref(true);

  // typewriter drives the hero briefing stream; mirrored into the message
  const tw = useTypewriter();
  const streamingBriefing = ref(false);
  const briefingIdx = computed(() =>
    messages.value.findIndex((m) => m.kind === 'briefing'),
  );

  let containerEl: HTMLElement | null = null;
  const bindContainer = (el: Element | { $el?: Element } | null) => {
    if (el && '$el' in el && el.$el) {
      containerEl = el.$el as HTMLElement;
    } else {
      containerEl = (el as HTMLElement | null) ?? null;
    }
  };

  async function scrollToBottom() {
    await Promise.resolve();
    if (containerEl) containerEl.scrollTop = containerEl.scrollHeight;
  }

  // keep the briefing message content in lockstep with the typewriter
  watch(tw.text, (t) => {
    const idx = briefingIdx.value;
    if (idx >= 0) messages.value[idx].content = t;
  });

  // ctx 是普通对象 (非响应式) — strip 一次即可，不需要 computed 包装
  const pureContent = stripHtml(ctx.content);
  const hasContent = computed(() => messages.value.length > 0);
  const canSend = computed(
    () => input.value.trim().length > 0 && !loading.value,
  );
  const canGenerate = computed(() => pureContent.length > 0 && !loading.value);
  const isStreamingBriefing = computed(() => streamingBriefing.value);

  /** Generate the opening summary — the briefing. */
  async function generateBriefing(notifyError: (msg: string) => void) {
    if (!canGenerate.value) {
      notifyError('文章内容为空，无法总结');
      return;
    }

    error.value = '';
    loading.value = true;
    streamingBriefing.value = true;
    tw.reset();

    // drop any previous briefing so the new one replaces it
    const prev = briefingIdx.value;
    if (prev >= 0) messages.value.splice(prev, 1);

    const msg: AiMessage = {
      id: nextMsgId(),
      role: 'assistant',
      content: '',
      reasoning: '',
      kind: 'briefing',
    };
    messages.value.unshift(msg);

    // cancel any in-flight stream (re-generate, double-click) before starting
    abortController?.abort();
    abortController = new AbortController();

    try {
      await aiGateway.streamThread(
        {
          mode: 'summary',
          article_content: pureContent,
          article_title: ctx.title || '',
          model: model.value,
        },
        {
          onData: (d) => {
            if (!d.content) return;
            // type 缺省按 content 处理（向后兼容 + 错误帧走 content 通道）。
            // Reasoning 不走 typewriter，直接累加到消息的 reasoning 字段。
            if (d.type === 'reasoning') {
              const m = messages.value.find((x) => x.id === msg.id);
              if (m) m.reasoning = (m.reasoning ?? '') + d.content;
            } else {
              tw.push(d.content);
            }
          },
          onDone: () => tw.done(),
        },
        abortController.signal,
      );
    } catch (e: unknown) {
      if (isAbortError(e)) return;
      error.value = e instanceof Error ? e.message : 'AI总结失败，请稍后重试';
      notifyError(error.value);
      const idx = briefingIdx.value;
      if (idx >= 0) messages.value.splice(idx, 1);
    } finally {
      loading.value = false;
      streamingBriefing.value = false;
    }
  }

  /** Ask a follow-up question in the same thread. */
  async function send(notifyError: (msg: string) => void) {
    if (!canSend.value) return;

    const text = input.value.trim();
    input.value = '';

    messages.value.push({
      id: nextMsgId(),
      role: 'user',
      content: text,
      kind: 'chat',
    });
    const assistant: AiMessage = {
      id: nextMsgId(),
      role: 'assistant',
      content: '',
      reasoning: '',
      kind: 'chat',
    };
    messages.value.push(assistant);
    void scrollToBottom();

    if (!sessionId.value) sessionId.value = generateSessionId();

    loading.value = true;
    error.value = '';
    const idx = messages.value.length - 1;
    const attachGrounding = needsGrounding.value;

    // cancel any in-flight stream (double-click send, re-entry) before starting
    abortController?.abort();
    abortController = new AbortController();

    try {
      await aiGateway.streamThread(
        {
          mode: 'chat',
          message: text,
          session_id: sessionId.value,
          ...(attachGrounding
            ? {
                article_content: ctx.content,
                article_title: ctx.title || '',
              }
            : {}),
        },
        {
          onData: (d) => {
            if (!d.content) return;
            const target = messages.value[idx];
            if (!target) return;
            // type 缺省按 content 处理（向后兼容 + 错误帧走 content 通道）
            if (d.type === 'reasoning') {
              target.reasoning = (target.reasoning ?? '') + d.content;
            } else {
              target.content += d.content;
              void scrollToBottom();
            }
          },
        },
        abortController.signal,
      );
    } catch (e: unknown) {
      if (isAbortError(e)) return;
      const msg = e instanceof Error ? e.message : '对话失败，请稍后重试';
      messages.value[idx].content = `[ERROR] ${msg}`;
      error.value = msg;
      notifyError(msg);
    } finally {
      loading.value = false;
      // first send of this session done; future turns skip grounding.
      needsGrounding.value = false;
    }
  }

  function onKeydown(e: KeyboardEvent, sendFn: () => Promise<void>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendFn();
    }
  }

  function clearThread() {
    abortController?.abort();
    messages.value = [];
    sessionId.value = '';
    error.value = '';
    tw.reset();
    // cleared thread = fresh session; the next chat turn must re-attach
    // article grounding.
    needsGrounding.value = true;
  }

  /**
   * User-initiated cancel of the in-flight stream. Aborts the signal, which
   * rejects the fetch with AbortError — caught and swallowed in the stream
   * handlers' catch, so any partial content already streamed is preserved.
   * `loading` is cleared by that call's `finally`.
   */
  function cancel() {
    abortController?.abort();
  }

  // tear-down safety: a stream that outlives the component would write to
  // a disposed reactive ref and surface a Vue warning.
  onUnmounted(() => {
    abortController?.abort();
  });

  return {
    messages,
    input,
    loading,
    error,
    model,
    sessionId,
    modelOptions: MODEL_OPTIONS,
    hasContent,
    canSend,
    canGenerate,
    isStreamingBriefing,
    briefingIdx,
    bindContainer,
    scrollToBottom,
    generateBriefing,
    send,
    onKeydown,
    clearThread,
    cancel,
  };
}
