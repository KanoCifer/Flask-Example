import { AnimatePresence, motion } from 'framer-motion';
import { Bot, CloudOff, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { renderMarkdown } from '@readinglist/utils';
import { createPortal } from 'react-dom';
import { ReasoningRegion } from '@/components/ReasoningRegion';
import { useAnalysisContext } from '../contexts/AnalysisContext';

const AI_MODELS = [
  { id: 'Ling-2.6-1T', name: 'Ling 2.6' },
  { id: 'Ling-2.6-flash', name: 'Ling 2.6 Flash' },
  { id: 'Ring-2.5-1T', name: 'Ring 2.5' },
];

// 可折叠推理区在本 widget 内的样式微调 (与 @/components/ReasoningRegion 默认值略不同):
// - 缺少 mb-2: 父级使用 space-y-3 控间距, 避免视觉叠加。
// - body 上限 max-h-32 + overflow-y-auto: 长时间推理不撑开弹层。
const REASONING_WRAPPER = 'border-border/60 border-b pb-2';
const REASONING_BODY =
  'text-muted mt-1.5 max-h-32 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed';

interface AIAnalysisWidgetProps {
  onGenerate: (modelId: string) => void;
  /**
   * 嵌入模式：去掉 fixed 定位与 portal，改为流式布局。
   * 与 hideFab 配合，可放进 drawer / sheet 等容器内。
   */
  embedded?: boolean;
  /**
   * 隐藏 FAB 入口（由父组件 header 或 drawer 触发开关）。
   */
  hideFab?: boolean;
}

const SHIMMER_TEXTS = [
  '正在整理天气变化...',
  '正在评估体感与风况...',
  '正在结合潮汐节奏...',
];


/**
 * AI 分析组件 —— Apple HIG surface。
 *
 * 嵌入模式 (drawer / sheet 内): 流式布局, 顶部 status chip, 主体内容区, 底部 model select + 主按钮。
 * 浮层模式 (默认): 一个 flat solid FAB (没有 blob orbs / 没有渐变装饰),
 * 卡片表面 `bg-page /40 shadow-sm`, 不使用 AI bento 的
 * `from-indigo-300/30 ... blur-2xl` 装饰光晕 (DESIGN.md §6 显式禁止)。
 */
export function AIAnalysisWidget({
  onGenerate,
  embedded = false,
  hideFab = false,
}: AIAnalysisWidgetProps) {
  const {
    analysisOpen,
    analysisLoading,
    analysisError,
    analysisResult,
    analysisReasoning,
    analysisHasData,
    toggleAnalysis,
    closeAnalysis,
    setAnalysisLoading,
    abortAnalysis,
  } = useAnalysisContext();

  const [shimmerIndex, setShimmerIndex] = useState(0);
  const shimmerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (analysisLoading) {
      shimmerTimerRef.current = setInterval(() => {
        setShimmerIndex((i) => (i + 1) % SHIMMER_TEXTS.length);
      }, 1800);
    } else {
      if (shimmerTimerRef.current) {
        clearInterval(shimmerTimerRef.current);
        shimmerTimerRef.current = null;
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShimmerIndex(0);
    }
    return () => {
      if (shimmerTimerRef.current) clearInterval(shimmerTimerRef.current);
    };
  }, [analysisLoading]);

  const [selectedModel, setSelectedModel] = useState(AI_MODELS[0].id);

  const statusLabel = (() => {
    if (analysisLoading) return '分析中';
    if (analysisError) return '分析失败';
    if (analysisResult) return '已生成';
    return '待生成';
  })();

  const statusClass = (() => {
    if (analysisLoading) return 'bg-accent/15 text-ink';
    if (analysisError) return 'bg-destructive/15 text-destructive';
    if (analysisResult) return 'bg-success/15 text-success';
    return 'bg-surface text-muted';
  })();

  // 内嵌模式：去掉 fixed + portal，改为流式容器
  if (embedded) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span
            className={`${statusClass} rounded-full px-2.5 py-0.5 text-xs font-medium`}
          >
            {statusLabel}
          </span>
          {analysisOpen && (
            <button
              onClick={closeAnalysis}
              className="text-muted hover:bg-surface rounded-full p-1"
              aria-label="关闭分析"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="space-y-3">
          <ReasoningRegion
            reasoning={analysisReasoning}
            contentEmpty={!analysisResult}
            wrapperClassName={REASONING_WRAPPER}
            bodyClassName={REASONING_BODY}
          />
          {!analysisHasData ? (
            <EmptyState
              icon={<CloudOff className="h-6 w-6" />}
              title="等待天气与潮汐数据加载"
              subtitle="数据到位后即可生成分析"
            />
          ) : analysisLoading ? (
            <LoadingState shimmerText={SHIMMER_TEXTS[shimmerIndex]} />
          ) : analysisError ? (
            <ErrorState message={analysisError} />
          ) : analysisResult ? (
            <ResultState html={renderMarkdown(analysisResult)} />
          ) : (
            <PlaceholderState />
          )}

          {!analysisLoading && (
            <div className="flex items-center gap-2">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-secondary text-ink flex-1 rounded-xl px-3 py-2 text-xs"
              >
                {AI_MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {analysisLoading ? (
            <button
              onClick={() => {
                abortAnalysis();
              }}
              className="bg-destructive text-ink hover:bg-destructive/90 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium transition-colors"
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
              >
                <rect
                  x="6"
                  y="6"
                  width="12"
                  height="12"
                  rx="1"
                  fill="currentColor"
                />
              </svg>
              取消分析
            </button>
          ) : (
            <button
              onClick={() => {
                onGenerate(selectedModel);
                setAnalysisLoading(true);
              }}
              disabled={!analysisHasData}
              className="bg-accent text-ink hover:bg-accent/90 disabled:bg-surface disabled:text-muted relative flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium transition-colors disabled:cursor-not-allowed"
            >
              {analysisResult ? '重新分析' : '生成分析'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // 浮层模式 (默认): flat surface 卡片 + solid FAB。
  // 不再有 `bg-linear-to-br from-indigo-300/30 to-sky-500/20 blur-2xl` 装饰光晕,
  // 不再有 `from-accent/90 to-accent/85` FAB 渐变 (DESIGN.md §6 显式禁止)。
  return (
    <>
      {createPortal(
        <div className="fixed right-1/2 bottom-28 z-50 flex translate-x-1/2 flex-col items-center gap-4 sm:bottom-24">
          <AnimatePresence mode="wait">
            {analysisOpen && (
              <motion.div
                key="analysis-card"
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                className="bg-page /40 w-[90vw] max-w-sm overflow-hidden rounded-3xl border shadow-xl"
                role="dialog"
                aria-label="AI 天气分析"
              >
                <div className="/60 flex items-start justify-between gap-3 border-b px-4 py-3">
                  <div>
                    <h3 className="text-ink text-sm font-semibold tracking-tight">
                      AI 天气分析
                    </h3>
                    <p className="text-muted mt-0.5 text-xs">
                      结合实时天气与潮汐节奏给出出行建议
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={`${statusClass} rounded-full px-2.5 py-0.5 text-xs font-medium`}
                    >
                      {statusLabel}
                    </span>
                    <button
                      onClick={closeAnalysis}
                      className="text-muted hover:bg-surface rounded-full p-1"
                      aria-label="关闭分析"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3 px-4 py-3">
                  <ReasoningRegion
                    reasoning={analysisReasoning}
                    contentEmpty={!analysisResult}
                    wrapperClassName={REASONING_WRAPPER}
                    bodyClassName={REASONING_BODY}
                  />
                  {!analysisHasData ? (
                    <EmptyState
                      icon={<CloudOff className="h-6 w-6" />}
                      title="等待天气与潮汐数据加载"
                      subtitle="数据到位后即可生成分析"
                    />
                  ) : analysisLoading ? (
                    <LoadingState shimmerText={SHIMMER_TEXTS[shimmerIndex]} />
                  ) : analysisError ? (
                    <ErrorState message={analysisError} />
                  ) : analysisResult ? (
                    <ResultState html={renderMarkdown(analysisResult)} />
                  ) : (
                    <PlaceholderState />
                  )}

                  {!analysisLoading && (
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="bg-secondary text-ink flex-1 rounded-xl px-3 py-2 text-xs"
                      >
                        {AI_MODELS.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {analysisLoading ? (
                    <button
                      onClick={() => {
                        abortAnalysis();
                      }}
                      className="bg-destructive text-ink hover:bg-destructive/90 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium transition-colors"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden
                      >
                        <rect
                          x="6"
                          y="6"
                          width="12"
                          height="12"
                          rx="1"
                          fill="currentColor"
                        />
                      </svg>
                      取消分析
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        onGenerate(selectedModel);
                        setAnalysisLoading(true);
                      }}
                      disabled={!analysisHasData}
                      className="bg-accent text-ink hover:bg-accent/90 disabled:bg-surface disabled:text-muted relative flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium transition-colors disabled:cursor-not-allowed"
                    >
                      {analysisResult ? '重新分析' : '生成分析'}
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>,
        document.body,
      )}

      {!hideFab && !analysisOpen && (
        <button
          onClick={toggleAnalysis}
          className="bg-accent text-ink hover:bg-accent/90 active:bg-accent/85 fixed right-4 bottom-32 z-40 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-transform hover:-translate-y-0.5 active:translate-y-0 sm:right-6 sm:bottom-28 sm:h-14 sm:w-14"
          aria-label="打开 AI 分析"
          title="AI分析"
        >
          {analysisHasData && (
            <span className="bg-success ring-page absolute top-0.5 right-0.5 inline-flex h-2.5 w-2.5 rounded-full ring-2 sm:top-0 sm:right-0 sm:h-3 sm:w-3" />
          )}
          <Bot className="h-5 w-5 sm:h-6 sm:w-6" />
        </button>
      )}
    </>
  );
}

function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-4 text-center">
      <div className="bg-surface mb-3 flex h-12 w-12 items-center justify-center rounded-2xl">
        {icon}
      </div>
      <p className="text-muted text-sm">{title}</p>
      <p className="text-muted mt-1 text-xs">{subtitle}</p>
    </div>
  );
}

function LoadingState({ shimmerText }: { shimmerText: string }) {
  return (
    <div className="space-y-3">
      <p className="text-muted text-sm">{shimmerText}</p>
      <div className="space-y-2">
        <div className="bg-secondary skeleton-pulse h-3 w-full rounded" />
        <div className="bg-secondary skeleton-pulse h-3 w-5/6 rounded" />
        <div className="bg-secondary skeleton-pulse h-3 w-2/3 rounded" />
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="bg-destructive/10 text-destructive rounded-xl p-3 text-sm">
      {message}
    </div>
  );
}

function ResultState({ html }: { html: string }) {
  return (
    <div
      className="prose prose-sm text-ink max-h-[50vh] min-h-16 overflow-y-auto sm:max-h-[60vh]"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function PlaceholderState() {
  return (
    <p className="text-muted text-sm">
      点击「生成分析」，获取适合外出与钓鱼的天气建议。
    </p>
  );
}
