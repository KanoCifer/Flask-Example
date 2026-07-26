/**
 * AI 分析 sheet —— 复用 BottomSheet (z-200, 盖在 DashboardSheet 之上)。
 *
 * 桌面端 (≥sm) 退化为右侧抽屉: 自定义 width + 顶部 paper 高光 + 右→左 ambient。
 * 移动端: BottomSheet 默认 bottom-sheet 形态。
 */
import { X } from 'lucide-react';

import { BottomSheet } from '@/components';
import { AIAnalysisWidget } from './AIAnalysisWidget';

interface FishingAnalysisDrawerProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (modelId: string) => void;
}

export function FishingAnalysisDrawer({
  open,
  onClose,
  onGenerate,
}: FishingAnalysisDrawerProps) {
  // 桌面端 (≥sm) → 右侧抽屉样式
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(min-width: 640px)').matches
  ) {
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        maxH="100vh"
        lockScroll
        renderHeader={() => (
          <header className="shrink-0 px-5 pt-3 pb-4">
            <div className="/60 flex items-center justify-between border-b px-0 pb-3">
              <div>
                <h1 className="text-ink font-family-averia text-lg">AI 分析</h1>
                <p className="text-muted mt-0.5 text-xs">
                  基于当前天气与潮汐综合判断
                </p>
              </div>
              <button
                type="button"
                aria-label="关闭分析"
                onClick={onClose}
                className="text-muted hover:bg-surface hover:text-ink inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>
        )}
      >
        {/* 桌面右侧抽屉样式 */}
        <style>{`
          [role="dialog"][aria-label="AI 分析"] {
            left: auto !important;
            right: 0 !important;
            top: 0 !important;
            bottom: 0 !important;
            width: 420px;
            max-width: 90vw;
            border-radius: 24px 0 0 24px !important;
            border-left: 1px solid var(--border-color, color-mix(in oklch, var(--ink) 12%, transparent));
            box-shadow:
              inset 1px 0 0 0 oklch(from var(--page) l c h / 0.6),
              -1px 0 1px color-mix(in oklch, var(--ink) 6%, transparent),
              -8px 0 18px color-mix(in oklch, var(--ink) 8%, transparent),
              -24px 0 40px color-mix(in oklch, var(--ink) 6%, transparent);
          }
        `}</style>
        <div className="flex flex-1 flex-col overflow-y-auto px-5 py-4">
          <AIAnalysisWidget onGenerate={onGenerate} embedded hideFab />
        </div>
      </BottomSheet>
    );
  }

  // 移动端 → BottomSheet 默认 bottom sheet
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      maxH="70vh"
      lockScroll
      renderHeader={() => (
        <header className="shrink-0 px-5 pt-3 pb-4">
          <div className="/60 flex items-center justify-between border-b px-0 pb-3">
            <div>
              <h2 className="text-ink text-base font-semibold">AI 分析</h2>
              <p className="text-muted mt-0.5 text-xs">
                基于当前天气与潮汐综合判断
              </p>
            </div>
            <button
              type="button"
              aria-label="关闭分析"
              onClick={onClose}
              className="text-muted hover:bg-surface hover:text-ink inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>
      )}
    >
      <div className="flex flex-col gap-4 px-5 py-4">
        <AIAnalysisWidget onGenerate={onGenerate} embedded hideFab />
      </div>
    </BottomSheet>
  );
}
