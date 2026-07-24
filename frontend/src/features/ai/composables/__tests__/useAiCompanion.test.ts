import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent, h, nextTick, onMounted } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';

vi.mock('@/features/ai/api/aiGateway', () => ({
  aiGateway: {
    getCachedSummary: vi.fn(),
    getCachedChat: vi.fn(),
    streamSummary: vi.fn(),
    streamChat: vi.fn(),
    weatherAnalysis: vi.fn(),
  },
}));

vi.mock('@/composables/useTypewriter', async () => {
  const { ref } = await import('vue');
  return {
    useTypewriter: () => {
      const text = ref('');
      return {
        text,
        push: vi.fn((chunk: string) => {
          text.value += chunk;
        }),
        done: vi.fn(),
        reset: vi.fn(() => {
          text.value = '';
        }),
        start: vi.fn(),
        isTyping: ref(false),
        isDone: ref(false),
      };
    },
  };
});

import {
  useAiCompanion,
  MODEL_OPTIONS,
  type AiContext,
} from '../useAiCompanion';
import { aiGateway } from '@/features/ai/api/aiGateway';

describe('useAiCompanion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(aiGateway.getCachedSummary).mockResolvedValue({ cached: false });
    vi.mocked(aiGateway.getCachedChat).mockResolvedValue({ cached: false });
    vi.mocked(aiGateway.streamSummary).mockResolvedValue(undefined);
    vi.mocked(aiGateway.streamChat).mockResolvedValue(undefined);
  });

  describe('thread creation', () => {
    it('starts with empty messages and hasContent=false', () => {
      const c = useAiCompanion({ title: 'T', content: '<p>hi</p>' });
      expect(c.messages.value).toEqual([]);
      expect(c.hasContent.value).toBe(false);
      expect(c.error.value).toBe('');
      expect(c.loading.value).toBe(false);
      expect(c.sessionId.value).toBe('');
      expect(c.input.value).toBe('');
    });

    it('defaults model to first MODEL_OPTIONS value', () => {
      const c = useAiCompanion({ content: 'x' });
      expect(c.model.value).toBe(MODEL_OPTIONS[0].value);
    });

    it('exposes modelOptions equal to MODEL_OPTIONS', () => {
      const c = useAiCompanion({ content: 'x' });
      expect(c.modelOptions).toEqual(MODEL_OPTIONS);
    });

    it('canGenerate is false when content is empty after stripHtml', () => {
      const c = useAiCompanion({ content: '<p></p>' });
      expect(c.canGenerate.value).toBe(false);
    });

    it('canGenerate is true when pureContent is non-empty', () => {
      const c = useAiCompanion({ content: '<p>x</p>' });
      expect(c.canGenerate.value).toBe(true);
    });
  });

  describe('generateBriefing', () => {
    it('calls aiGateway.streamSummary with stripped content and current model', async () => {
      const c = useAiCompanion({ title: 'T', content: '<p>body</p>' });
      const notify = vi.fn();

      await c.generateBriefing(notify);

      expect(aiGateway.streamSummary).toHaveBeenCalledWith(
        {
          title: 'T',
          content: 'body',
          model: MODEL_OPTIONS[0].value,
        },
        expect.objectContaining({
          onData: expect.any(Function),
          onDone: expect.any(Function),
        }),
        expect.any(AbortSignal),
      );
    });

    it('uses empty title when ctx.title is missing', async () => {
      const c = useAiCompanion({ content: '<p>body</p>' });
      const notify = vi.fn();

      await c.generateBriefing(notify);

      expect(aiGateway.streamSummary).toHaveBeenCalledWith(
        expect.objectContaining({ title: '' }),
        expect.any(Object),
        expect.any(AbortSignal),
      );
    });

    it('unshifts a briefing message and accumulates streamed content via typewriter', async () => {
      const c = useAiCompanion({ content: '<p>x</p>' });
      const notify = vi.fn();

      let captured: { onData: (d: { content?: string }) => void; onDone: () => void } | null =
        null;
      vi.mocked(aiGateway.streamSummary).mockImplementation(
        async (_body, handlers) => {
          captured = handlers as typeof captured;
        },
      );

      expect(c.isStreamingBriefing.value).toBe(false);
      const promise = c.generateBriefing(notify);

      // immediately after kicking off, streamingBriefing is true and a briefing message exists
      expect(c.isStreamingBriefing.value).toBe(true);
      expect(c.messages.value.length).toBe(1);
      expect(c.messages.value[0]).toMatchObject({
        role: 'assistant',
        kind: 'briefing',
        content: '',
      });

      captured!.onData({ content: 'hello ' });
      await nextTick();
      expect(c.messages.value[0].content).toBe('hello ');

      captured!.onData({ content: 'world' });
      await nextTick();
      expect(c.messages.value[0].content).toBe('hello world');

      captured!.onDone();
      await promise;
      expect(c.isStreamingBriefing.value).toBe(false);
      expect(c.loading.value).toBe(false);
    });

    it('notifies and skips generation when canGenerate is false', async () => {
      const c = useAiCompanion({ content: '<p></p>' });
      const notify = vi.fn();

      await c.generateBriefing(notify);

      expect(notify).toHaveBeenCalledWith('文章内容为空，无法总结');
      expect(aiGateway.streamSummary).not.toHaveBeenCalled();
    });
  });

  describe('send', () => {
    it('appends user + assistant messages, clears input, generates sessionId', async () => {
      const c = useAiCompanion({ content: '<p>x</p>' });
      const notify = vi.fn();
      c.input.value = 'question';

      await c.send(notify);

      expect(c.messages.value.length).toBe(2);
      expect(c.messages.value[0]).toMatchObject({
        role: 'user',
        content: 'question',
        kind: 'chat',
      });
      expect(c.messages.value[1]).toMatchObject({
        role: 'assistant',
        kind: 'chat',
      });
      expect(c.input.value).toBe('');
      expect(c.sessionId.value).toMatch(/^chat-[0-9a-f-]{36}$/);
    });

    it('does not send when input is empty', async () => {
      const c = useAiCompanion({ content: '<p>x</p>' });
      const notify = vi.fn();

      await c.send(notify);

      expect(aiGateway.streamChat).not.toHaveBeenCalled();
      expect(c.messages.value).toEqual([]);
    });

    it('does not send while loading', async () => {
      const c = useAiCompanion({ content: '<p>x</p>' });
      const notify = vi.fn();
      c.loading.value = true;
      c.input.value = 'q';

      await c.send(notify);

      expect(aiGateway.streamChat).not.toHaveBeenCalled();
    });

    it('passes article fields on first turn only', async () => {
      const c = useAiCompanion({
        title: 'Hello',
        content: '<p>x</p>',
      });
      const notify = vi.fn();

      // first turn
      c.input.value = 'first';
      await c.send(notify);

      expect(aiGateway.streamChat).toHaveBeenLastCalledWith(
        expect.objectContaining({
          message: 'first',
          article_content: '<p>x</p>',
          article_title: 'Hello',
        }),
        expect.any(Object),
        expect.any(AbortSignal),
      );

      // second turn
      c.input.value = 'second';
      await c.send(notify);

      const lastCall = vi.mocked(aiGateway.streamChat).mock.calls.at(-1)![0];
      expect(lastCall).not.toHaveProperty('article_content');
      expect(lastCall).not.toHaveProperty('article_title');
      expect(lastCall).toMatchObject({ message: 'second' });
    });

    it('appends streamed chunks to the assistant message', async () => {
      const c = useAiCompanion({ content: '<p>x</p>' });
      const notify = vi.fn();
      c.input.value = 'q';

      let captured: { onData: (d: { content?: string }) => void } | null = null;
      vi.mocked(aiGateway.streamChat).mockImplementation(
        async (_body, handlers) => {
          captured = handlers as typeof captured;
        },
      );

      await c.send(notify);
      const assistantIdx = c.messages.value.length - 1;

      captured!.onData({ content: 'a' });
      await nextTick();
      expect(c.messages.value[assistantIdx].content).toBe('a');

      captured!.onData({ content: 'b' });
      await nextTick();
      expect(c.messages.value[assistantIdx].content).toBe('ab');
    });
  });

  describe('error path', () => {
    it('sets error and removes briefing when streamSummary throws', async () => {
      const c = useAiCompanion({ content: '<p>x</p>' });
      const notify = vi.fn();
      vi.mocked(aiGateway.streamSummary).mockRejectedValue(
        new Error('网络连接失败，请重试'),
      );

      await c.generateBriefing(notify);

      expect(c.error.value).toBe('网络连接失败，请重试');
      expect(notify).toHaveBeenCalledWith('网络连接失败，请重试');
      expect(c.loading.value).toBe(false);
      expect(c.isStreamingBriefing.value).toBe(false);
      // briefing message removed on error
      expect(c.messages.value.length).toBe(0);
    });

    it('uses default message when streamSummary throws a non-Error', async () => {
      const c = useAiCompanion({ content: '<p>x</p>' });
      const notify = vi.fn();
      vi.mocked(aiGateway.streamSummary).mockRejectedValue('boom');

      await c.generateBriefing(notify);

      expect(c.error.value).toBe('AI总结失败，请稍后重试');
      expect(notify).toHaveBeenCalledWith('AI总结失败，请稍后重试');
    });

    it('marks assistant message with [ERROR] when streamChat throws', async () => {
      const c = useAiCompanion({ content: '<p>x</p>' });
      const notify = vi.fn();
      c.input.value = 'q';
      vi.mocked(aiGateway.streamChat).mockRejectedValue(new Error('对话失败'));

      await c.send(notify);

      const assistant = c.messages.value.at(-1)!;
      expect(assistant.role).toBe('assistant');
      expect(assistant.content).toBe('[ERROR] 对话失败');
      expect(c.error.value).toBe('对话失败');
      expect(notify).toHaveBeenCalledWith('对话失败');
    });
  });

  describe('clearThread', () => {
    it('resets messages, sessionId, error', async () => {
      const c = useAiCompanion({ content: '<p>x</p>' });
      const notify = vi.fn();

      await c.generateBriefing(notify);
      c.error.value = 'manual error';
      c.sessionId.value = 'manual-id';

      expect(c.messages.value.length).toBeGreaterThan(0);

      c.clearThread();

      expect(c.messages.value).toEqual([]);
      expect(c.hasContent.value).toBe(false);
      expect(c.sessionId.value).toBe('');
      expect(c.error.value).toBe('');
    });

    // F5
    it('re-arms needsGrounding after clearThread', async () => {
      vi.mocked(aiGateway.getCachedSummary).mockResolvedValue({ cached: false });
      vi.mocked(aiGateway.getCachedChat).mockResolvedValue({ cached: false });

      const c = useAiCompanion({ content: '<p>x</p>' });
      const notify = vi.fn();

      // first send consumes the initial grounding
      c.input.value = 'q1';
      await c.send(notify);

      c.clearThread();

      c.input.value = 'q2';
      await c.send(notify);

      const lastBody = vi.mocked(aiGateway.streamChat).mock.calls.at(-1)![0];
      expect(lastBody).toMatchObject({ article_content: '<p>x</p>' });
    });
  });

  describe('model switching', () => {
    it('allows changing model.value', () => {
      const c = useAiCompanion({ content: 'x' });
      c.model.value = 'Ling 2.6';
      expect(c.model.value).toBe('Ling 2.6');
    });

    it('keeps modelOptions stable across mutations', () => {
      const c = useAiCompanion({ content: 'x' });
      c.model.value = 'Ling 2.6';
      expect(c.modelOptions).toEqual(MODEL_OPTIONS);
    });

    it('passes the current model to streamSummary', async () => {
      const c = useAiCompanion({ content: '<p>x</p>' });
      const notify = vi.fn();
      c.model.value = 'Ling 2.6';

      await c.generateBriefing(notify);

      expect(aiGateway.streamSummary).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'Ling 2.6' }),
        expect.any(Object),
        expect.any(AbortSignal),
      );
    });
  });

  describe('restore', () => {
    it('appends cached summary as a briefing message', async () => {
      vi.mocked(aiGateway.getCachedSummary).mockResolvedValue({
        cached: true,
        summary: 'cached briefing',
      });
      vi.mocked(aiGateway.getCachedChat).mockResolvedValue({ cached: false });

      const c = useAiCompanion({ content: '<p>x</p>' });
      await c.restore();

      expect(c.messages.value.length).toBe(1);
      expect(c.messages.value[0]).toMatchObject({
        kind: 'briefing',
        role: 'assistant',
        content: 'cached briefing',
      });
    });

    it('appends cached chat messages and session_id', async () => {
      vi.mocked(aiGateway.getCachedSummary).mockResolvedValue({ cached: false });
      vi.mocked(aiGateway.getCachedChat).mockResolvedValue({
        cached: true,
        messages: [
          { role: 'user', content: 'hi' },
          { role: 'assistant', content: 'hello' },
        ],
        session_id: 'sess-1',
      });

      const c = useAiCompanion({ content: '<p>x</p>' });
      await c.restore();

      expect(c.messages.value.length).toBe(2);
      expect(c.messages.value[0]).toMatchObject({
        kind: 'chat',
        role: 'user',
        content: 'hi',
      });
      expect(c.messages.value[1]).toMatchObject({
        kind: 'chat',
        role: 'assistant',
        content: 'hello',
      });
      expect(c.sessionId.value).toBe('sess-1');
    });

    it('silently ignores cache miss errors', async () => {
      vi.mocked(aiGateway.getCachedSummary).mockRejectedValue(new Error('nope'));
      vi.mocked(aiGateway.getCachedChat).mockRejectedValue(new Error('nope'));

      const c = useAiCompanion({ content: '<p>x</p>' });
      await c.restore();

      expect(c.messages.value).toEqual([]);
      expect(c.error.value).toBe('');
    });

    it('does nothing when neither cache hits', async () => {
      vi.mocked(aiGateway.getCachedSummary).mockResolvedValue({ cached: false });
      vi.mocked(aiGateway.getCachedChat).mockResolvedValue({ cached: false });

      const c = useAiCompanion({ content: '<p>x</p>' });
      await c.restore();

      expect(c.messages.value).toEqual([]);
      expect(c.hasContent.value).toBe(false);
    });

    // F6: 验证 sessionId 用 crypto.randomUUID() 生成 —— 无泄露意图的前缀
    // (旧 summary_)、足够 entropy 且每次独立。
    it('generates unique UUID-based session ids with no intent-leaking prefix', async () => {
      vi.mocked(aiGateway.getCachedSummary).mockResolvedValue({ cached: false });
      vi.mocked(aiGateway.getCachedChat).mockResolvedValue({ cached: false });

      const c1 = useAiCompanion({ content: '<p>x</p>' });
      c1.input.value = 'q';
      await c1.send(vi.fn());

      const c2 = useAiCompanion({ content: '<p>x</p>' });
      c2.input.value = 'q';
      await c2.send(vi.fn());

      expect(c1.sessionId.value).not.toBe(c2.sessionId.value);
      // UUID v4: 8-4-4-4-12 hex 字符，4 位置上是 version digit (4)
      expect(c1.sessionId.value).toMatch(
        /^chat-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    });

    // F5
    it('clears needsGrounding after restoring an existing session_id', async () => {
      vi.mocked(aiGateway.getCachedSummary).mockResolvedValue({ cached: false });
      vi.mocked(aiGateway.getCachedChat).mockResolvedValue({
        cached: true,
        messages: [
          { role: 'user', content: 'previous q' },
          { role: 'assistant', content: 'previous a' },
        ],
        session_id: 'sess-restored',
      });

      const c = useAiCompanion({ content: '<p>x</p>' });
      await c.restore();
      expect(c.sessionId.value).toBe('sess-restored');

      c.input.value = 'next question';
      await c.send(vi.fn());

      // post-restore first message must NOT re-attach grounding — that
      // session already had its grounding turn.
      const lastBody = vi.mocked(aiGateway.streamChat).mock.calls.at(-1)![0];
      expect(lastBody).not.toHaveProperty('article_content');
      expect(lastBody).not.toHaveProperty('article_title');
      expect(lastBody).toMatchObject({ message: 'next question' });
    });

    // F5
    it('re-arms needsGrounding when restore finds no session_id', async () => {
      vi.mocked(aiGateway.getCachedSummary).mockResolvedValue({ cached: false });
      vi.mocked(aiGateway.getCachedChat).mockResolvedValue({ cached: false });

      const c = useAiCompanion({ content: '<p>x</p>' });
      await c.restore();
      expect(c.sessionId.value).toBe('');

      c.input.value = 'first';
      await c.send(vi.fn());

      const lastBody = vi.mocked(aiGateway.streamChat).mock.calls.at(-1)![0];
      expect(lastBody).toMatchObject({ article_content: '<p>x</p>' });
    });
  });

  describe('exports', () => {
    it('exports MODEL_OPTIONS, AiContext, MessageKind, AiMessage types compile', () => {
      // Type-only smoke check — the actual types are exercised by other tests.
      const ctx: AiContext = { content: 'x' };
      expect(ctx.content).toBe('x');
      expect(MODEL_OPTIONS.length).toBeGreaterThan(0);
    });
  });

  describe('abort & lifecycle (F2)', () => {
    function makeWrapper() {
      let instance: ReturnType<typeof useAiCompanion>;
      const Comp = defineComponent({
        setup() {
          instance = useAiCompanion({ content: '<p>x</p>' });
          return () => h('div');
        },
      });
      const wrapper = mount(Comp);
      return {
        get hook() {
          return instance!;
        },
        unmount: () => wrapper.unmount(),
      };
    }

    // F1: mirrors what AiCompanion.vue does at mount time.
    it('onMounted triggers restore so cached content loads on first paint', async () => {
      vi.mocked(aiGateway.getCachedSummary).mockResolvedValue({
        cached: true,
        summary: 'cached briefing',
      });
      vi.mocked(aiGateway.getCachedChat).mockResolvedValue({ cached: false });

      let instance: ReturnType<typeof useAiCompanion>;
      const Comp = defineComponent({
        setup() {
          instance = useAiCompanion({ content: '<p>x</p>' });
          onMounted(() => {
            void instance.restore();
          });
          return () => h('div');
        },
      });
      const wrapper = mount(Comp);
      await flushPromises();

      expect(instance!.messages.value.length).toBe(1);
      expect(instance!.messages.value[0]).toMatchObject({
        kind: 'briefing',
        content: 'cached briefing',
      });
      wrapper.unmount();
    });

    // F1 + empty content: restore() must not surface visible errors when
    // there is nothing to summarize (avoids a 422 from the backend).
    it('onMounted restore with empty content does not raise or set error', async () => {
      vi.mocked(aiGateway.getCachedSummary).mockResolvedValue({ cached: false });
      vi.mocked(aiGateway.getCachedChat).mockResolvedValue({ cached: false });

      let instance: ReturnType<typeof useAiCompanion>;
      const Comp = defineComponent({
        setup() {
          instance = useAiCompanion({ content: '<p></p>' });
          onMounted(() => {
            void instance.restore();
          });
          return () => h('div');
        },
      });
      const wrapper = mount(Comp);
      await flushPromises();

      expect(instance!.error.value).toBe('');
      expect(instance!.messages.value).toEqual([]);
      wrapper.unmount();
    });

    it('passes an AbortSignal to streamSummary', async () => {
      const c = useAiCompanion({ content: '<p>x</p>' });
      const notify = vi.fn();

      await c.generateBriefing(notify);

      const call = vi.mocked(aiGateway.streamSummary).mock.calls.at(-1)!;
      expect(call[2]).toBeInstanceOf(AbortSignal);
    });

    it('passes an AbortSignal to streamChat', async () => {
      const c = useAiCompanion({ content: '<p>x</p>' });
      const notify = vi.fn();
      c.input.value = 'hi';

      await c.send(notify);

      const call = vi.mocked(aiGateway.streamChat).mock.calls.at(-1)!;
      expect(call[2]).toBeInstanceOf(AbortSignal);
    });

    it('aborts the previous stream on re-entry (re-generate briefing)', async () => {
      const c = useAiCompanion({ content: '<p>x</p>' });
      const notify = vi.fn();

      let firstSignal: AbortSignal | null = null;
      vi.mocked(aiGateway.streamSummary).mockImplementationOnce(
        async (_body, handlers, signal) => {
          firstSignal = signal ?? null;
        },
      );

      // kick off the first briefing; the mockImplementationOnlyOnce resolves
      // immediately, so loading settles back to false — but the captured
      // signal still belongs to the first call.
      await c.generateBriefing(notify);

      // restore default resolver, then start a second briefing
      vi.mocked(aiGateway.streamSummary).mockResolvedValue(undefined);
      const p2 = c.generateBriefing(notify);

      expect(firstSignal).not.toBeNull();
      expect(firstSignal!.aborted).toBe(true);

      await p2;
      const secondCall =
        vi.mocked(aiGateway.streamSummary).mock.calls.at(-1)!;
      const secondSignal = secondCall[2] as AbortSignal;
      expect(secondSignal.aborted).toBe(false);
    });

    it('aborts the previous stream when send is re-entered', async () => {
      const c = useAiCompanion({ content: '<p>x</p>' });
      const notify = vi.fn();

      let firstSignal: AbortSignal | null = null;
      vi.mocked(aiGateway.streamChat).mockImplementationOnce(
        async (_body, handlers, signal) => {
          firstSignal = signal ?? null;
        },
      );

      c.input.value = 'first';
      await c.send(notify);

      vi.mocked(aiGateway.streamChat).mockResolvedValue(undefined);
      c.input.value = 'second';
      const p2 = c.send(notify);

      expect(firstSignal).not.toBeNull();
      expect(firstSignal!.aborted).toBe(true);

      await p2;
    });

    it('clearThread aborts the in-flight stream', async () => {
      const c = useAiCompanion({ content: '<p>x</p>' });
      const notify = vi.fn();

      let captured: AbortSignal | null = null;
      vi.mocked(aiGateway.streamSummary).mockImplementationOnce(
        async (_body, _handlers, signal) => {
          captured = signal ?? null;
        },
      );

      // capture the first call (default impl resolves, so this is fine)
      await c.generateBriefing(notify);

      // second call: keep it pending so we can observe clearThread's abort
      let pending: (() => void) | null = null;
      vi.mocked(aiGateway.streamSummary).mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            pending = () => resolve();
          }),
      );
      const p2 = c.generateBriefing(notify);

      // the *previous* signal (from the resolved first call) is already
      // aborted by re-entry; what we care about is the *current* in-flight
      // signal being aborted by clearThread.
      const currentCall =
        vi.mocked(aiGateway.streamSummary).mock.calls.at(-1)!;
      const currentSignal = currentCall[2] as AbortSignal;
      expect(currentSignal.aborted).toBe(false);

      c.clearThread();
      expect(currentSignal.aborted).toBe(true);

      pending!();
      await p2;
    });

    it('swallows AbortError silently (no error, no notify, no stuck loading)', async () => {
      const c = useAiCompanion({ content: '<p>x</p>' });
      const notify = vi.fn();
      const abortErr = new DOMException('aborted', 'AbortError');
      vi.mocked(aiGateway.streamSummary).mockRejectedValueOnce(abortErr);

      await c.generateBriefing(notify);

      expect(c.error.value).toBe('');
      expect(notify).not.toHaveBeenCalled();
      expect(c.loading.value).toBe(false);
      expect(c.isStreamingBriefing.value).toBe(false);
    });

    it('swallows AbortError silently in send (no [ERROR] marker)', async () => {
      const c = useAiCompanion({ content: '<p>x</p>' });
      const notify = vi.fn();
      c.input.value = 'q';
      const abortErr = new DOMException('aborted', 'AbortError');
      vi.mocked(aiGateway.streamChat).mockRejectedValueOnce(abortErr);

      await c.send(notify);

      expect(c.error.value).toBe('');
      expect(notify).not.toHaveBeenCalled();
      const assistant = c.messages.value.at(-1)!;
      expect(assistant.role).toBe('assistant');
      expect(assistant.content).toBe('');
      expect(c.loading.value).toBe(false);
    });

    it('component unmount aborts the in-flight stream', async () => {
      const notify = vi.fn();

      let pending: (() => void) | null = null;
      vi.mocked(aiGateway.streamSummary).mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            pending = () => resolve();
          }),
      );

      const { hook, unmount } = makeWrapper();
      const p = hook.generateBriefing(notify);

      const call = vi.mocked(aiGateway.streamSummary).mock.calls.at(-1)!;
      const signal = call[2] as AbortSignal;
      expect(signal.aborted).toBe(false);

      unmount();
      expect(signal.aborted).toBe(true);

      pending!();
      await p;
    });
  });
});