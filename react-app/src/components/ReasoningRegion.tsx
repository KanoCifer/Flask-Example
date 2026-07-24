import { useEffect, useRef, useState } from 'react';

/**
 * 可折叠「思考过程」区 —— 展示 AI 推理通道（reasoning channel）。
 *
 * 行为契约（与前端两端 + 团队内 component 必须一致）：
 * - 纯推理阶段（content 为空）默认展开
 * - 正文 delta 一开始即自动收起
 * - 手动切换可覆盖默认行为（覆盖在 reasoning 非空期间保持）
 * - reasoning 用 `text-muted` 语义色，正文保留 `prose`
 *
 * 跨分析 reset：单条流的生命周期由调用方决定。thread 端每条消息新
 * component instance 自然 fresh。weather/fishing 端是整轮一条 region，
 * 当 reasoning 由空 → 非空（新分析开始），手动覆盖状态自动失效，
 * 让 auto-open 重新生效。
 */
export interface ReasoningRegionProps {
  reasoning?: string;
  contentEmpty: boolean;
  /** 外层容器类名，用于调整 margin/border。两个调用方对外观有微调差别。 */
  wrapperClassName?: string;
  /** 内容容器类名。默认无滚动上限；weather 调用方传入 max-h + overflow-y-auto。 */
  bodyClassName?: string;
}

const DEFAULT_WRAPPER = 'mb-2 border-b border-ink/10 pb-2';
const DEFAULT_BODY =
  'text-muted mt-1.5 whitespace-pre-wrap text-xs leading-relaxed';

export function ReasoningRegion({
  reasoning,
  contentEmpty,
  wrapperClassName = DEFAULT_WRAPPER,
  bodyClassName = DEFAULT_BODY,
}: ReasoningRegionProps) {
  const reasoningStr = reasoning ?? '';
  const hasReasoning = reasoningStr.length > 0;
  // null = 跟随自动；true/false = 用户手动锁定。
  const [override, setOverride] = useState<boolean | null>(null);
  // auto = content 为空时展开, content 出现后收起。
  const autoOpen = contentEmpty;
  const open = override !== null ? override : autoOpen;

  // 跨分析 reset: 上一轮分析结束时 reasoning 被调用方清成 '',
  // 下一轮开始时 reasoning 由空 → 非空, 此 transition 触发 override 重置。
  // 这样用户在上一轮手动 collapse 的状态不会泄漏到下一轮。
  const prevReasoningRef = useRef(reasoningStr);
  useEffect(() => {
    if (reasoningStr.length > 0 && prevReasoningRef.current.length === 0) {
      setOverride(null);
    }
    prevReasoningRef.current = reasoningStr;
  }, [reasoningStr]);

  if (!hasReasoning) return null;

  return (
    <div className={wrapperClassName}>
      <button
        type="button"
        className="text-muted hover:text-ink inline-flex cursor-pointer items-center gap-1 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 focus:outline-none"
        aria-expanded={open}
        onClick={() => setOverride(open ? false : true)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-3 w-3 shrink-0 transition-transform duration-200${
            open ? 'rotate-90' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="2"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
        </svg>
        <span>思考过程</span>
      </button>
      {open && (
        <div className={bodyClassName}>{reasoningStr}</div>
      )}
    </div>
  );
}
