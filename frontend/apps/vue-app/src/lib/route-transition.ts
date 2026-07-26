// 路由过渡动画策略 —— 纯模块，不依赖 Vue / Pinia，可独立单测。
// 单一职责：route.meta.transition → 过渡动画名。

/** 已支持的过渡动画名。router meta 中只允许写这些值。 */
export type RouteTransitionName = 'fade' | 'slide-up';

/** router meta 未声明 transition 时使用的默认动画。 */
export const DEFAULT_TRANSITION_NAME: RouteTransitionName = 'slide-up';

/** 已知过渡动画名的集合 —— 单一事实来源。 */
export const TRANSITION_NAMES: ReadonlySet<RouteTransitionName> = new Set([
  'fade',
  'slide-up',
]);

/** 类型守卫：判断给定字符串是否为合法的过渡动画名。 */
export function isRouteTransitionName(
  value: unknown,
): value is RouteTransitionName {
  return (
    typeof value === 'string' &&
    TRANSITION_NAMES.has(value as RouteTransitionName)
  );
}

/**
 * 把 router meta 上的 transition 字段解析为合法的动画名。
 * 缺失或未知值一律降级到 DEFAULT —— 调用方无需关心兜底。
 */
export function resolveTransitionName(
  metaTransition: unknown,
): RouteTransitionName {
  return isRouteTransitionName(metaTransition)
    ? metaTransition
    : DEFAULT_TRANSITION_NAME;
}
