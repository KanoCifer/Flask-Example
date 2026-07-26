/**
 * motion-v 运动原语
 *
 * 按**运动意图**而非组件命名。三组原语覆盖项目中所有 motion-v 动画需求。
 *
 * ## 使用导引
 *
 * | 场景 | 推荐原语 |
 * |------|----------|
 * | Modal / Drawer / TaskDetail 面板入场 | `SPRING_SNUG` |
 * | 导航悬浮 / 装饰性卡片入场 | `SPRING_BOUNCE` |
 * | Dynamic Island | `SPRING_CRISP` |
 * | 滚动显现（scroll reveal） | `SPRING_REVEAL` |
 * | 基础弹簧入场（通用） | `SPRING` |
 * | 遮罩层 / backdrop | `FADE_FAST` |
 * | 内容淡入 / blur 衔接 | `FADE` |
 * | 卡片 hover / 分组入场 | `EASE` |
 * | 进度条 / 状态页 | `EASE_SLOW` |
 * | 页面分页过渡 | `EASE_INOUT` |
 *
 * ## 叠加动态值
 *
 *   :transition="{ ...EASE, duration: 0.48 }"
 *   :transition="{ ...EASE_SLOW, delay: 0.28, duration: 0.6 }"
 *
 * @see DESIGN.md §Motion
 */

// ======================== Spring ========================

/** 基础弹簧 — 通用的入场 / 显现动画 */
export const SPRING = { type: 'spring' } as const;

/** 收紧弹簧 — 面板级（Modal / Drawer / TaskDetail），克制无过冲 */
export const SPRING_SNUG = {
  type: 'spring',
  stiffness: 320,
  damping: 32,
  mass: 0.8,
} as const;

/** 弹性弹簧 — 导航悬浮 / 装饰性入场，有过冲感 */
export const SPRING_BOUNCE = {
  type: 'spring',
  stiffness: 320,
  damping: 28,
} as const;

/** 清脆弹簧 — 纯零弹跳，Apple Dynamic Island 风格 */
export const SPRING_CRISP = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
  bounce: 0,
} as const;

/** 慢速弹簧 — 滚动显现（scroll reveal），克制但持续 */
export const SPRING_REVEAL = {
  type: 'spring',
  duration: 1,
  stiffness: 100,
  damping: 20,
} as const;

// ======================== Fade ========================

/** 快速淡入 — 遮罩层 / backdrop */
export const FADE_FAST = { duration: 0.18 } as const;

/** 标准淡入 — 内容浮现 / blur 衔接 */
export const FADE = { duration: 0.25 } as const;

// ======================== Ease ========================

/** 统一感 ease-out（snap in, soft rest）— 卡片 hover、分组入场 */
export const EASE = {
  duration: 0.24,
  ease: [0.22, 1, 0.36, 1] as const,
} as const;

/** 从容 ease-out — 进度条、状态页 */
export const EASE_SLOW = {
  duration: 0.4,
  ease: [0.16, 1, 0.3, 1] as const,
} as const;

/** 页面过渡 ease-in-out — 博客分页过渡 */
export const EASE_INOUT = {
  duration: 0.25,
  ease: 'easeOut',
} as const;

// ======================== Animation Targets ========================

/** whileInView: 淡入 + 上滑显现 */
export const WHILE_IN_VIEW_FADE_UP = { opacity: 1, y: 0 };

/** whileHover: 微放大 */
export const HOVER_SCALE_UP = { scale: 1.05 } as const;

/** whileTap: 缩小 */
export const TAP_SCALE_DOWN = { scale: 0.9 } as const;

/** whileHover: 轻微抬升 */
export const HOVER_LIFT = { y: -4 } as const;
