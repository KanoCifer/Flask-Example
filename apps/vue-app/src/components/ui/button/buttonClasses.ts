// UiButton 变体 / 尺寸样式映射（设计系统三层 token，全部用 Tailwind 语义类）
// 参考 docs/rules/design-system.md 按钮章节：default / outline / destructive / ghost。
//
// 注意：未引入 class-variance-authority / tailwind-merge —— 项目 deps 里没有。
// 类合并靠 Vue 3 单根元素自动继承父 class 即可；如需覆盖同名类（如把 base 的
// `rounded-md` 换成 `rounded-full`），用 Tailwind v4 的 `!` 前缀（`!rounded-full`）。

export type ButtonVariant = 'default' | 'outline' | 'destructive' | 'ghost';

export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonVariants {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

// 基础样式：布局 + 焦点环 + 过渡 + 按下反馈 + 禁用态。
// 所有变体共享这套"骨架"，变体只负责配色和边框，尺寸只负责高/宽/间距。
const BASE = [
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium',
  'transition-[color,transform,background-color] duration-150 ease-out motion-reduce:transition-none',
  'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
  'active:scale-[0.96] motion-reduce:active:scale-100',
  'disabled:cursor-not-allowed disabled:opacity-50',
  'rounded-xl',
];

const VARIANTS: Record<ButtonVariant, string> = {
  default: 'bg-accent text-contrast hover:bg-accent/90',
  outline: ' text-muted hover:bg-surface hover:text-ink border',
  destructive: 'bg-destructive text-contrast hover:bg-destructive/90',
  ghost: 'text-muted hover:bg-surface hover:text-ink',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 px-3',
  md: 'h-9 gap-2 px-4',
  lg: 'h-10 gap-2 px-6',
  icon: 'h-9 w-9',
};

export function buttonClasses(options: ButtonVariants = {}): string {
  const { variant = 'default', size } = options;
  return [...BASE, VARIANTS[variant], size ? SIZES[size] : '']
    .filter(Boolean)
    .join(' ');
}
