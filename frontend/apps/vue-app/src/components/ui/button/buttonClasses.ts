// UiButton 变体 / 尺寸样式映射（设计系统三层 token，全部用 Tailwind 语义类）
// 参考 docs/rules/design-system.md 按钮章节：default / outline / destructive / ghost。
//
// border-draw —— 参考 codeigniter fx-15 "Border Draw" 效果：
// 静止态只显示 1px 内描边（--border token）；hover 时 ::after 的 2px 边框
// 通过 clip-path inset(0 100% → 0 0) 从左到右"画"出来。几何用 arbitrary
// value，颜色全部走语义 token（border / current → ink），不硬编码。
//
// 注意：未引入 class-variance-authority / tailwind-merge —— 项目 deps 里没有。
// 类合并靠 Vue 3 单根元素自动继承父 class 即可；如需覆盖同名类（如把 base 的
// `rounded-md` 换成 `rounded-full`），用 Tailwind v4 的 `!` 前缀（`!rounded-full`）。

export type ButtonVariant =
  | 'default'
  | 'outline'
  | 'destructive'
  | 'ghost'
  | 'border-draw';

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
  // Border Draw: 1px 内描边静止态 → hover 时 2px 边框从左到右"画出"
  // ::after 的 clip-path 过渡独立于 BASE 的 color/transform 过渡,不冲突。
  'border-draw':
    'relative border border-transparent text-ink shadow-[inset_0_0_0_1px_var(--border)] ' +
    'after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:border-2 after:border-current ' +
    'after:content-[""] after:clip-path-[inset(0_100%_0_0)] after:transition-[clip-path] after:duration-300 ' +
    'hover:after:clip-path-[inset(0_0_0_0)]',
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
