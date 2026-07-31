// 路由过渡动画策略 —— 纯模块，不依赖 Vue / Pinia，可独立单测。
// 单一职责：route.meta.transition → 过渡动画名 + master/detail 方向。

/** 已支持的过渡动画名。router meta 中只允许写这些值。 */
export type RouteTransitionName = 'fade' | 'slide-up' | 'page-side-by-side';

/** router meta 未声明 transition 时使用的默认动画。 */
export const DEFAULT_TRANSITION_NAME: RouteTransitionName = 'slide-up';

/** 已知过渡动画名的集合 —— 单一事实来源。 */
export const TRANSITION_NAMES: ReadonlySet<RouteTransitionName> = new Set([
  'fade',
  'slide-up',
  'page-side-by-side',
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

/** page-side-by-side 的滑动方向。写入 CSS 变量 --page-slide-direction。 */
export type PageSlideDirection = 1 | -1;

/** 正向：进入从右（+1 = 来自左侧列表）。 */
export const PAGE_SLIDE_FORWARD: PageSlideDirection = 1;
/** 反向：进入从左（-1 = 来自右侧详情）。 */
export const PAGE_SLIDE_BACKWARD: PageSlideDirection = -1;

/**
 * 根据源 / 目标路径推断 master/detail 滑动方向。
 *
 * 启发式（专为博客路由设计）：
 * - list（`/blog`、`/blog/category/:slug`）< detail（`/blog/:id`）< editor（`/blog/:id/edit`、`/blog/new`）
 *   编辑器视为详情页的下一层：进入编辑"更深"，离开编辑"更浅"。
 * - 同级或向更浅：反向（进入从左，像"返回上一层"）
 * - 向更深：正向（进入从右，像"推入下一页"）
 * - 首屏（无来源）：正向，符合"从列表进入"的默认直觉
 */
export function resolvePageSlideDirection(
  fromPath: string | null | undefined,
  toPath: string,
): PageSlideDirection {
  if (!fromPath) return PAGE_SLIDE_FORWARD;

  const fromKind = classifyBlogPath(fromPath);
  const toKind = classifyBlogPath(toPath);

  if (fromKind === 'other' || toKind === 'other') {
    return PAGE_SLIDE_FORWARD;
  }
  if (fromKind === toKind) {
    return PAGE_SLIDE_FORWARD;
  }

  return isGoingDeeper(fromKind, toKind)
    ? PAGE_SLIDE_FORWARD
    : PAGE_SLIDE_BACKWARD;
}

function isGoingDeeper(from: BlogPathKind, to: BlogPathKind): boolean {
  if (from === 'list' && (to === 'detail' || to === 'editor')) return true;
  if (from === 'detail' && to === 'editor') return true;
  return false;
}

/**
 * 博客路径分类 —— 纯字符串判断，不依赖 vue-router。
 * 保持与 router/index.ts 中的 path 字面量同步。
 */
export type BlogPathKind = 'list' | 'detail' | 'editor' | 'other';

export function classifyBlogPath(path: string): BlogPathKind {
  const normalized = path.split('?')[0]?.split('#')[0] ?? path;

  if (
    normalized === '/blog' ||
    /^\/blog\/category\/[^/]+$/.test(normalized)
  ) {
    return 'list';
  }

  // 编辑器必须在详情之前判断 —— `/blog/:id/edit` 也是 `/^\/blog\/[^/]+$/` 的子集。
  if (
    normalized === '/blog/new' ||
    /^\/blog\/[^/]+\/edit$/.test(normalized)
  ) {
    return 'editor';
  }

  // 详情排除 `/blog/category`（无 slug）—— router 里不匹配这种路径，但分类
  // 走的是 /blog/category/:slug，所以这里必须把裸的 category 当作 other。
  if (
    /^\/blog\/[^/]+$/.test(normalized) &&
    !normalized.startsWith('/blog/category')
  ) {
    return 'detail';
  }

  return 'other';
}
