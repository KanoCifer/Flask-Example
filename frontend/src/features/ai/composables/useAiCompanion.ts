import { computed, ref, watch } from 'vue';
import { aiGateway } from '@/features/ai/api/aiGateway';
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
  /** briefing = the opening summary; chat = a normal follow-up turn */
  kind: MessageKind;
}

export const MODEL_OPTIONS = [
  { label: 'Ring 2.6', value: 'Ring 2.6' },
  { label: 'Ling 2.6', value: 'Ling 2.6' },
] as const;

let msgSeq = 0;
const nextMsgId = () => `ai_${++msgSeq}`;

function generateSessionId() {
  return `summary_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
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
  const canGenerate = computed(
    () => pureContent.length > 0 && !loading.value,
  );
  const isStreamingBriefing = computed(() => streamingBriefing.value);

  /** Restore cached briefing + cached chat history on mount. */
  async function restore() {
    // 两次缓存读取无依赖关系，并行发起
    const [summaryResult, chatResult] = await Promise.allSettled([
      aiGateway.getCachedSummary({
        article_content: pureContent,
        ...(ctx.title ? { article_title: ctx.title } : {}),
      }),
      aiGateway.getCachedChat({
        article_content: pureContent,
        ...(ctx.title ? { article_title: ctx.title } : {}),
      }),
    ]);

    if (summaryResult.status === 'fulfilled') {
      const summary = summaryResult.value;
      if (summary.cached && summary.summary) {
        messages.value.push({
          id: nextMsgId(),
          role: 'assistant',
          content: summary.summary,
          kind: 'briefing',
        });
      }
    }

    if (chatResult.status === 'fulfilled') {
      const chat = chatResult.value;
      if (chat.cached && chat.messages?.length) {
        for (const m of chat.messages) {
          messages.value.push({
            id: nextMsgId(),
            role: m.role,
            content: m.content,
            kind: 'chat',
          });
        }
        if (chat.session_id) sessionId.value = chat.session_id;
      }
    }
  }

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
      kind: 'briefing',
    };
    messages.value.unshift(msg);

    try {
      await aiGateway.streamSummary(
        {
          title: ctx.title || '',
          content: pureContent,
          model: model.value,
        },
        {
          onData: (d) => {
            if (d.content) tw.push(d.content);
          },
          onDone: () => tw.done(),
        },
      );
    } catch (e: unknown) {
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

    messages.value.push({ id: nextMsgId(), role: 'user', content: text, kind: 'chat' });
    const assistant: AiMessage = {
      id: nextMsgId(),
      role: 'assistant',
      content: '',
      kind: 'chat',
    };
    messages.value.push(assistant);
    void scrollToBottom();

    if (!sessionId.value) sessionId.value = generateSessionId();

    loading.value = true;
    error.value = '';
    const idx = messages.value.length - 1;
    const isFirstTurn =
      messages.value.filter((m) => m.role === 'user').length === 1;

    try {
      await aiGateway.streamChat(
        {
          message: text,
          session_id: sessionId.value,
          ...(isFirstTurn
            ? {
                article_content: ctx.content,
                article_title: ctx.title || '',
              }
            : {}),
        },
        {
          onData: (d) => {
            if (d.content) {
              messages.value[idx].content += d.content;
              void scrollToBottom();
            }
          },
        },
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '对话失败，请稍后重试';
      messages.value[idx].content = `[ERROR] ${msg}`;
      error.value = msg;
      notifyError(msg);
    } finally {
      loading.value = false;
    }
  }

  function onKeydown(e: KeyboardEvent, sendFn: () => Promise<void>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendFn();
    }
  }

  function clearThread() {
    messages.value = [];
    sessionId.value = '';
    error.value = '';
    tw.reset();
  }

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
    restore,
    generateBriefing,
    send,
    onKeydown,
    clearThread,
  };
}