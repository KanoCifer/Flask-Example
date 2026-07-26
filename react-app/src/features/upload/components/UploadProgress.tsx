import { useMemo } from 'react';

interface UploadProgressProps {
  /** 进度百分比 0-100，超界会自动 clamp。 */
  progress: number;
  /** 是否显示百分比文字（默认 false，由调用方通过 children 控制）。 */
  showLabel?: boolean;
  /** 自定义高度（如 'h-1' / 'h-2'）。 */
  height?: string;
}

/**
 * UploadProgress —— 0-100 进度条（React 版，对齐 Vue UploadProgress）。
 *
 * - 自动 clamp 到 [0, 100]，传入越界值不会破坏布局。
 * - 100 时进度条转 success 配色。
 */
export function UploadProgress({
  progress,
  showLabel = false,
  height = 'h-2',
}: UploadProgressProps) {
  const clamped = useMemo(
    () => Math.max(0, Math.min(100, progress)),
    [progress],
  );
  const isDone = clamped >= 100;

  return (
    <div className="flex w-full flex-col gap-2">
      {showLabel && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted font-medium">上传进度</span>
          <span className="text-ink tabular-nums">{clamped}%</span>
        </div>
      )}
      <div
        className={[
          'bg-surface relative w-full overflow-hidden rounded-full',
          height,
        ].join(' ')}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={[
            'h-full rounded-full transition-all duration-300 ease-out',
            isDone ? 'bg-success' : 'bg-accent',
          ].join(' ')}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
