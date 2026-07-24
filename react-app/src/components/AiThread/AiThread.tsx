import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useRef, useState } from 'react';
import { SPRING, EASE } from '@/constants/springs';
import { renderMarkdown } from '@/lib/markdown';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useClickOutside } from '@/hooks/useClickOutside';
import { ReasoningRegion } from '@/components/ReasoningRegion';
import {
  useAiThread,
  type AiMessage,
} from '@/hooks/useAiThread';

interface AiThreadProps {
  title?: string;
  content: string;
}

const BRIEFING_ICON = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 8V4H8" />
    <rect width="16" height="12" x="4" y="8" rx="2" />
    <path d="M2 14h2" />
    <path d="M20 14h2" />
    <path d="M15 13v2" />
    <path d="M9 13v2" />
  </svg>
);

function StreamingCursor() {
  return (
    <span
      className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-accent align-text-bottom"
      aria-hidden="true"
    />
  );
}

/** Streaming status pill shown in the header while a request is in flight. */
function StatusText({
  loading,
  isStreamingBriefing,
}: {
  loading: boolean;
  isStreamingBriefing: boolean;
}) {
  const reduce = usePrefersReducedMotion();
  const text = !loading ? '' : isStreamingBriefing ? '正在生成总结…' : '正在回复…';
  return (
    <AnimatePresence mode="wait">
      {text && (
        <motion.span
          key={text}
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          className="text-muted text-xs"
        >
          {text}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

function ModelSelector({
  model,
  modelOptions,
  onChange,
  disabled,
}: {
  model: string;
  modelOptions: ReadonlyArray<{ label: string; value: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  const label = modelOptions.find((o) => o.value === model)?.label ?? model;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="border bg-surface/30 text-ink inline-flex max-w-[12rem] items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors hover:bg-surface/60 focus-visible:ring-2 focus-visible:ring-ring/40 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        aria-expanded={open}
        aria-label={`当前模型 ${label}，点击切换`}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="truncate">{label}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="text-muted h-3.5 w-3.5 shrink-0 transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : undefined }}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="2"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.18, ease: EASE.outQuint }}
            className="absolute right-0 top-full z-10 mt-1 w-56 rounded-lg border bg-card/95 p-1 shadow-lg backdrop-blur-md"
          >
            {modelOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-surface/60"
                aria-pressed={opt.value === model}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                <span
                  className={`truncate${opt.value === model ? ' text-ink' : ' text-muted'}`}
                >
                  {opt.label}
                </span>
                {opt.value === model && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="text-accent h-3.5 w-3.5 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EmptyState({
  canGenerate,
  loading,
  onGenerate,
}: {
  canGenerate: boolean;
  loading: boolean;
  onGenerate: () => void;
}) {
  const reduce = usePrefersReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: EASE.outQuint }}
      className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-ink/10 bg-surface/20 px-6 py-8 text-center"
    >
      <div className="relative flex items-center justify-center">
        <div
          className={`absolute h-16 w-16 rounded-full bg-accent/20 blur-2xl ${loading ? 'animate-glow-pulse' : 'animate-glow-breathe'}`}
          aria-hidden="true"
        />
        <div className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-accent/20 bg-accent/10">
          <span className="text-accent">{BRIEFING_ICON}</span>
        </div>
      </div>
      <p className="text-ink text-sm leading-relaxed">
        点击「生成总结」，快速提炼文章核心要点
      </p>
      <button
        type="button"
        className="bg-accent text-ink hover:bg-accent/90 disabled:bg-accent/40 inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 focus:outline-none disabled:cursor-not-allowed active:scale-[0.96]"
        disabled={!canGenerate}
        onClick={onGenerate}
      >
        {loading && (
          <svg
            className="h-3.5 w-3.5 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        生成总结
      </button>
      <p className="text-muted text-xs">也可以直接在下方输入你的问题</p>
    </motion.div>
  );
}

function BriefingMessage({
  msg,
  modelLabel,
  isLast,
  loading,
  onRegenerate,
}: {
  msg: AiMessage;
  modelLabel: string;
  isLast: boolean;
  loading: boolean;
  onRegenerate: () => void;
}) {
  const reduce = usePrefersReducedMotion();
  const rendered = useMemo(() => renderMarkdown(msg.content), [msg.content]);
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={SPRING.card}
      className="rounded-xl border-t-2 border-accent/20 bg-surface/30 px-5 py-4"
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="text-accent text-[11px] font-semibold tracking-[0.14em] uppercase">
          摘要
        </span>
        <span className="text-muted text-xs">· {modelLabel}</span>
        <button
          type="button"
          className="text-muted hover:text-ink ml-auto cursor-pointer text-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 focus:outline-none"
          disabled={loading}
          onClick={onRegenerate}
        >
          重新生成
        </button>
      </div>
      <ReasoningRegion reasoning={msg.reasoning} contentEmpty={!msg.content} />
      <div
        className="prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: rendered }}
      />
      {isLast && loading && <StreamingCursor />}
    </motion.div>
  );
}

function ChatTurn({
  msg,
  isLast,
  loading,
}: {
  msg: AiMessage;
  isLast: boolean;
  loading: boolean;
}) {
  const reduce = usePrefersReducedMotion();
  const isUser = msg.role === 'user';
  const rendered = useMemo(
    () => (isUser ? '' : renderMarkdown(msg.content)),
    [isUser, msg.content],
  );
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={SPRING.snappy}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-secondary text-ink whitespace-pre-line'
            : 'bg-surface/40 text-ink'
        }`}
      >
        {!isUser && (
          <ReasoningRegion
            reasoning={msg.reasoning}
            contentEmpty={!msg.content}
          />
        )}
        {isUser ? (
          <span>{msg.content}</span>
        ) : (
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: rendered }}
          />
        )}
        {!isUser && isLast && loading && <StreamingCursor />}
      </div>
    </motion.div>
  );
}

/**
 * Collapsible "思考过程" region. See `@/components/ReasoningRegion`.
 *
 * Per-message override semantics come free from React keys (`msg.id`),
 * so the local `useState<boolean|null>` lifecycle aligns with one
 * briefing/chat turn each.
 */

export function AiThread({ title, content }: AiThreadProps) {
  const reduce = usePrefersReducedMotion();
  const {
    messages,
    input,
    setInput,
    loading,
    error,
    model,
    setModel,
    modelOptions,
    hasContent,
    canSend,
    canGenerate,
    streamingBriefing,
    containerRef,
    generateBriefing,
    send,
    onKeydown,
    clearThread,
  } = useAiThread({ title, content });

  const modelLabel =
    modelOptions.find((o) => o.value === model)?.label ?? model;
  const lastMsg = messages[messages.length - 1];

  return (
    <section className="bg-page/60 dark:bg-page/50 mb-6 overflow-hidden rounded-2xl border shadow-sm ring-1 ring-accent/[0.08] backdrop-blur-md motion-reduce:backdrop-blur-none">
      {/* Glow layer */}
      <div className="relative">
        <div
          className={`pointer-events-none absolute top-0 left-6 h-16 w-16 rounded-full bg-accent/30 blur-2xl ${loading ? 'animate-glow-pulse' : 'animate-glow-breathe'}`}
          aria-hidden="true"
        />

        {/* Header */}
        <div className="relative flex items-center justify-between gap-3 px-5 pt-4 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent/20 bg-accent/10 shadow-sm shadow-accent/10">
              <span className="text-accent">{BRIEFING_ICON}</span>
            </div>
            <h3 className="text-ink font-serif text-sm font-semibold tracking-tight">
              AI 阅读伴侣
            </h3>
            <StatusText loading={loading} isStreamingBriefing={streamingBriefing} />
          </div>

          <div className="flex items-center gap-1.5">
            <ModelSelector
              model={model}
              modelOptions={modelOptions}
              onChange={setModel}
              disabled={loading}
            />
            <AnimatePresence>
              {hasContent && (
                <motion.button
                  type="button"
                  initial={reduce ? false : { opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.18 }}
                  className="text-muted hover:text-ink cursor-pointer rounded-lg px-2 py-1 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 focus:outline-none"
                  aria-label="清空对话"
                  disabled={loading}
                  onClick={clearThread}
                >
                  清空
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-destructive px-5 pb-3 text-sm">{error}</p>
      )}

      {/* Thread */}
      <div
        ref={containerRef}
        className="max-h-80 space-y-3 overflow-y-auto px-5 py-4"
      >
        <AnimatePresence>
          {!hasContent && (
            <EmptyState
              canGenerate={canGenerate}
              loading={loading}
              onGenerate={() => void generateBriefing()}
            />
          )}
        </AnimatePresence>

        {messages.map((msg) => {
          const isLast = lastMsg?.id === msg.id;
          if (msg.kind === 'briefing') {
            return (
              <BriefingMessage
                key={msg.id}
                msg={msg}
                modelLabel={modelLabel}
                isLast={isLast}
                loading={loading}
                onRegenerate={() => void generateBriefing()}
              />
            );
          }
          return (
            <ChatTurn key={msg.id} msg={msg} isLast={isLast} loading={loading} />
          );
        })}
      </div>

      {/* Input bar */}
      <div className="flex items-center gap-2 border-t border-ink/10 px-4 py-3">
        <input
          type="text"
          value={input}
          placeholder={hasContent ? '继续提问…' : '向 AI 提问这篇文章…'}
          className="border bg-surface/30 text-ink placeholder-muted flex-1 rounded-lg px-3.5 py-2.5 text-sm transition-colors focus:ring-2 focus:ring-ring/40 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          disabled={loading}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeydown}
        />
        <button
          type="button"
          className={`inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 focus:outline-none ${
            canSend
              ? 'bg-accent text-ink hover:bg-accent/90'
              : 'bg-ink/5 text-muted cursor-not-allowed'
          }`}
          disabled={!canSend}
          aria-label="发送"
          onClick={() => void send()}
        >
          {loading ? (
            <svg
              className="h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : (
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 12h14M12 5l7 7-7 7"
              />
            </svg>
          )}
        </button>
      </div>
    </section>
  );
}
