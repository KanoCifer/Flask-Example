/**
 * Quick feedback banner —— "钓完了？告诉我们今天实际如何"。
 *
 * Apple HIG notification card: 凹进 page 一层的圆角容器, 不是顶部 border-t 切割。
 * 副标题 + 单 CTA, 不再叠警告色; 跟 dashboard 节奏保持一致。
 */
import { motion } from 'framer-motion';

interface QuickFeedbackBannerProps {
  visible: boolean;
  disabled?: boolean;
  onSubmit: () => void;
}

export function QuickFeedbackBanner({
  visible,
  disabled = false,
  onSubmit,
}: QuickFeedbackBannerProps) {
  if (!visible) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="fm-grouped flex flex-col items-start gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4"
      aria-label="反馈今日指数"
    >
      <div className="min-w-0 flex-1">
        <p className="text-ink font-family-averia text-base">
          钓完了？告诉我们今天实际如何
        </p>
        <p className="text-muted mt-0.5 text-xs">
          三个问题，三十秒 —— 您的反馈会帮系统下次更准
        </p>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onSubmit}
        className="bg-accent text-ink hover:bg-accent/90 disabled:bg-surface disabled:text-muted min-h-10 shrink-0 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed sm:min-h-11 sm:px-5"
      >
        反馈今日指数
      </button>
    </motion.section>
  );
}
