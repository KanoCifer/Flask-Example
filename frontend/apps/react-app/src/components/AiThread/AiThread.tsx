import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronDown, Loader2 } from 'lucide-react';
import { SPRING, EASE } from '@/constants/springs';
import { renderMarkdown } from '@readinglist/utils';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useClickOutside } from '@/hooks/useClickOutside';
import { ReasoningRegion } from '@/components/ReasoningRegion';
import { useAiThread, type AiMessage } from '@/hooks/useAiThread';

interface AiThreadProps {
  title?: string;
  content: string;
}

/**
 * "kuro neko" 标记：一只细描边的风剪猫剪影 —— 这是博客的品牌意象，
 * 取代原来的机器人/灯泡 icon，用作 AI companion 的视觉锚点。
 * 出现在空状态居中、模型选择触发按钮左侧。
 */
const KURO_NEKO_PATH =
  'M23.0837 4.14727C23.4047 3.94871 23.8119 3.94526 24.1139 4.17071L29.7956 6.88457C30.0573 7.08052 30.0169 7.47596 29.7311 7.63164C21.9807 11.8619 17.302 15.9874 14.8425 19.9949C13.2514 22.5852 10.3251 29.6555 12.9733 36.0359C15.716 42.6364 21.9322 45.0203 26.5329 45.0203C30.0087 45.0203 32.3712 43.9761 34.7712 42.3523C41.2785 37.9448 42.0285 29.3468 37.1852 23.4334V23.4305C37.2025 23.4453 39.8831 25.7483 41.5759 29.2352C41.2532 28.0697 40.7733 26.9511 40.1374 25.909C38.7028 23.5552 36.7695 21.5823 34.0407 20.2107C27.9675 17.1587 15.2951 18.6299 13.2995 31.7693C13.5017 22.6565 19.5393 16.9388 25.0056 15.1697C28.0421 14.1873 31.2569 13.9996 34.2907 14.5418C38.3385 11.2644 42.8127 9.79064 44.4147 9.33965C44.7842 9.23496 45.1834 9.33932 45.4557 9.61309C45.9141 10.0747 46.7149 10.8772 47.7341 11.8836H47.7399C48.0446 12.1842 47.8852 12.7025 47.4645 12.783C43.5274 13.5426 40.839 14.2947 37.9968 15.6072C41.4431 17.0031 44.3933 19.4488 46.1921 22.8201C46.4048 23.2172 46.2189 23.7081 45.7956 23.8611L43.3874 24.7332C45.5043 28.3329 46.0487 32.7462 45.0104 37.2664C43.2467 44.9513 37.3384 50.3896 29.7956 51.6834C28.6146 51.8848 27.444 52.0193 26.2927 51.9979C25.9026 51.9909 25.5967 51.6853 25.569 51.3162C25.4877 51.1735 25.4521 51.0025 25.4831 50.826L25.945 48.2361C23.8389 48.0884 21.8642 47.7391 19.8874 46.9393C8.15393 42.188 6.92433 30.5948 8.60711 23.5701C10.7915 14.4599 17.5068 7.55894 23.0837 4.14727Z';

function KuroNekoIcon({
  size = 40,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d={KURO_NEKO_PATH} fill="currentColor" className={className} />
    </svg>
  );
}

function StreamingCursor() {
  return (
    <span
      className="bg-card/70 ml-0.5 inline-block h-4 w-1.5 animate-pulse align-text-bottom"
      aria-hidden="true"
    />
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
        className="text-muted hover:bg-accent/10 hover:text-ink focus-visible:ring-ring/40 inline-flex max-w-[12rem] items-center gap-1.5 rounded-lg px-2 py-1.5 font-serif text-xs transition-colors focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
        aria-expanded={open}
        aria-label={`当前模型 ${label}，点击切换`}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <KuroNekoIcon size={14} className="shrink-0" />
        <span className="truncate">{label}</span>
        <ChevronDown
          className={`text-muted h-3.5 w-3.5 shrink-0 transition-transform duration-200${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 4 }}
            transition={{ duration: 0.18, ease: EASE.outQuint }}
            className="bg-card/95 absolute bottom-full left-0 z-10 mb-1 w-56 rounded-lg border p-1 shadow-lg backdrop-blur-md"
          >
            {modelOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`hover:bg-accent/10 flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left font-serif text-sm transition-colors ${
                  opt.value === model ? 'bg-accent/10 text-ink' : 'text-muted'
                }`}
                aria-pressed={opt.value === model}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                <span className="truncate">{opt.label}</span>
                {opt.value === model && (
                  <Check
                    className="text-accent h-3.5 w-3.5 shrink-0"
                    aria-hidden="true"
                  />
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
      className="bg-surface/20 flex flex-col items-center gap-4 rounded-xl px-6 py-8 text-center"
    >
      <div className="relative flex items-center justify-center">
        <div
          className={`bg-accent/20 absolute h-16 w-16 rounded-full blur-2xl ${
            loading ? 'animate-glow-pulse' : 'animate-glow-breathe'
          }`}
          aria-hidden="true"
        />
        <span className="text-accent">
          <KuroNekoIcon size={40} />
        </span>
      </div>
      <p className="text-ink text-sm leading-relaxed">
        点击「生成总结」，快速提炼文章核心要点
      </p>
      <button
        type="button"
        className="bg-accent text-contrast hover:bg-accent/90 disabled:bg-accent/40 focus-visible:ring-ring/40 inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 active:scale-[0.96] disabled:cursor-not-allowed"
        disabled={!canGenerate}
        onClick={onGenerate}
      >
        {loading && (
          <Loader2
            className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
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
      className="border-accent/20 bg-surface/30 min-h-80 rounded-2xl border-t-2 px-5 py-4"
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="text-accent text-[11px] font-semibold tracking-[0.14em] uppercase">
          摘要
        </span>
        <span className="text-muted text-xs">· {modelLabel}</span>
        <button
          type="button"
          className="text-muted hover:text-ink focus-visible:ring-ring/40 ml-auto cursor-pointer text-xs transition-colors focus:outline-none focus-visible:ring-2"
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
    cancel,
  } = useAiThread({ title, content });

  const modelLabel =
    modelOptions.find((o) => o.value === model)?.label ?? model;
  const lastMsg = messages[messages.length - 1];

  const sendOrStop = () => {
    if (loading) cancel();
    else void send();
  };

  return (
    <section className="from-card/70 via-card/50 to-accent/[0.04] shadow-accent/[0.06] ring-accent/[0.08] mb-6 overflow-hidden rounded-2xl bg-gradient-to-br shadow-sm ring-1 backdrop-blur-md motion-reduce:backdrop-blur-none">
      {/* Glow layer */}
      <div className="relative">
        <div
          className={`bg-accent/30 pointer-events-none absolute top-0 left-6 h-16 w-16 rounded-full blur-2xl ${
            loading ? 'animate-glow-pulse' : 'animate-glow-breathe'
          }`}
          aria-hidden="true"
        />
      </div>

      {/* Error */}
      {error && <p className="text-destructive px-5 pb-3 text-sm">{error}</p>}

      {/* Thread */}
      <div
        ref={containerRef}
        className="max-h-[50vh] space-y-3 overflow-y-auto px-5 py-4"
      >
        <AnimatePresence>
          {!hasContent && (
            <EmptyState
              canGenerate={canGenerate}
              loading={loading || streamingBriefing}
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
            <ChatTurn
              key={msg.id}
              msg={msg}
              isLast={isLast}
              loading={loading}
            />
          );
        })}
      </div>

      {/* Input bar */}
      <div className="px-4 py-3">
        <div className="bg-surface/30 focus-within:ring-ring/40 rounded-xl border transition-colors focus-within:ring-2">
          <textarea
            value={input}
            placeholder={hasContent ? '继续提问…' : '向 AI 提问这篇文章…'}
            className="text-ink placeholder-muted h-20 w-full resize-none rounded-t-xl bg-transparent px-3.5 py-3 text-sm focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            disabled={loading}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeydown}
          />

          {/* Toolbar: 模型切换 + 发送 / 停止 */}
          <div className="flex items-center justify-between gap-2 px-2 pt-1 pb-2">
            <ModelSelector
              model={model}
              modelOptions={modelOptions}
              onChange={setModel}
              disabled={loading}
            />

            <button
              type="button"
              className={`focus-visible:ring-ring/40 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors focus:outline-none focus-visible:ring-2 ${
                loading || canSend
                  ? 'bg-accent text-contrast hover:bg-accent/90 cursor-pointer'
                  : 'bg-ink/5 text-muted cursor-not-allowed'
              }`}
              disabled={!loading && !canSend}
              aria-label={loading ? '停止生成' : '发送'}
              onClick={sendOrStop}
            >
              {loading ? (
                <span className="relative inline-flex h-4 w-4 items-center justify-center">
                  <Loader2
                    className="absolute inset-0 h-4 w-4 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                  <span
                    className="bg-contrast h-1.5 w-1.5 rounded-[1px]"
                    aria-hidden="true"
                  />
                </span>
              ) : (
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
