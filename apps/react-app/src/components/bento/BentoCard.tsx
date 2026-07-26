import type { ReactNode } from 'react';

interface BentoCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

// 平整纸感卡片 — 轻边框 + 微阴影，Apple 式留白与克制。
// 圆角按宽度分级由调用方通过 --bento-radius 控制。
export function BentoCard({ children, className, onClick }: BentoCardProps) {
  return (
    <div
      className={`squircle /50 bg-card border p-6 ${className || ''}`}
      onClick={onClick}
      style={{
        boxShadow:
          '0 1px 2px color-mix(in oklch, var(--ink) 4%, transparent), 0 4px 12px color-mix(in oklch, var(--ink) 3%, transparent)',
      }}
    >
      {children}
    </div>
  );
}
