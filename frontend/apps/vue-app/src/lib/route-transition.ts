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
 * 启发式（支持博客 + 学习两类路由）：
 * - 博客：list（`/blog`、`/blog/category/:slug`）< detail（`/blog/:id`）< editor（`/blog/:id/edit`、`/blog/new`）
 * - 学习：list（`/learning`）< course（`/learning/course/:id`）< lesson（`/learning/course/:id/lesson/:id`）
 *   编辑器视为详情页的下一层：进入编辑"更深"，离开编辑"更浅"。
 * - 同级或向更浅：反向（进入从左，像"返回上一层"）
 * - 向更深：正向（进入从右，像"推入下一页"）
 * - 首屏（无来源）：正向，符合"从列表进入"的默认直觉
 * - 跨分类（blog ↔ learning 或任一侧 other）：兜底正向
 */
export function resolvePageSlideDirection(
  fromPath: string | null | undefined,
  toPath: string,
): PageSlideDirection {
  if (!fromPath) return PAGE_SLIDE_FORWARD;

  const classifier = pickClassifier(fromPath, toPath);
  const fromKind = classifier(fromPath);
  const toKind = classifier(toPath);

  if (fromKind === 'other' || toKind === 'other') {
    return PAGE_SLIDE_FORWARD;
  }
  if (fromKind === toKind) {
    return PAGE_SLIDE_FORWARD;
  }

  return classifier.isGoingDeeper(fromKind, toKind)
    ? PAGE_SLIDE_FORWARD
    : PAGE_SLIDE_BACKWARD;
}

/**
 * 根据源/目标路径前缀挑选合适的分类器。
 * 同一前缀下的两个路径共用一个分类器；不同前缀（blog ↔ learning）
 * 则兜底返回 blog 分类器，但 paths 一旦落到 blog 分类器都变 other，
 * 自然走"兜底正向"分支,跨分类不会误判反向。
 */
function pickClassifier(
  fromPath: string,
  toPath: string,
): PathClassifier<BlogPathKind | LearningPathKind> {
  const fromFamily = classifyFamily(fromPath);
  const toFamily = classifyFamily(toPath);

  if (fromFamily === 'learning' && toFamily === 'learning') {
    return learningClassifier;
  }
  return blogClassifier;
}

type PathFamily = 'blog' | 'learning' | 'other';

function classifyFamily(path: string): PathFamily {
  const normalized = path.split('?')[0]?.split('#')[0] ?? path;
  if (normalized === '/learning' || normalized.startsWith('/learning/')) {
    return 'learning';
  }
  if (normalized === '/blog' || normalized.startsWith('/blog/')) {
    return 'blog';
  }
  return 'other';
}

interface PathClassifier<Kinds extends string> {
  (path: string): Kinds | 'other';
  isGoingDeeper(from: Kinds | 'other', to: Kinds | 'other'): boolean;
}

const blogClassifier: PathClassifier<BlogPathKind> = (() => {
  const fn = ((path: string) =>
    classifyBlogPath(path)) as PathClassifier<BlogPathKind>;
  fn.isGoingDeeper = (from, to) => {
    if (from === 'list' && (to === 'detail' || to === 'editor')) return true;
    if (from === 'detail' && to === 'editor') return true;
    return false;
  };
  return fn;
})();

const learningClassifier: PathClassifier<LearningPathKind> = (() => {
  const fn = ((path: string) =>
    classifyLearningPath(path)) as PathClassifier<LearningPathKind>;
  fn.isGoingDeeper = (from, to) => {
    if (from === 'list' && (to === 'course' || to === 'lesson')) return true;
    if (from === 'course' && to === 'lesson') return true;
    return false;
  };
  return fn;
})();

/**
 * 博客路径分类 —— 纯字符串判断，不依赖 vue-router。
 * 保持与 router/index.ts 中的 path 字面量同步。
 */
export type BlogPathKind = 'list' | 'detail' | 'editor' | 'other';

export function classifyBlogPath(path: string): BlogPathKind {
  const normalized = path.split('?')[0]?.split('#')[0] ?? path;

  if (normalized === '/blog' || /^\/blog\/category\/[^/]+$/.test(normalized)) {
    return 'list';
  }

  // 编辑器必须在详情之前判断 —— `/blog/:id/edit` 也是 `/^\/blog\/[^/]+$/` 的子集。
  if (normalized === '/blog/new' || /^\/blog\/[^/]+\/edit$/.test(normalized)) {
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

/**
 * 学习路径分类 —— 三层 master/detail 层级：list < course < lesson。
 * 保持与 router/index.ts 中的 path 字面量同步。
 */
export type LearningPathKind = 'list' | 'course' | 'lesson' | 'other';

export function classifyLearningPath(path: string): LearningPathKind {
  const normalized = path.split('?')[0]?.split('#')[0] ?? path;

  // 必须先判断 lesson —— `/learning/course/:id/lesson/:id` 也匹配下面的 course 正则。
  if (/^\/learning\/course\/[^/]+\/lesson\/[^/]+$/.test(normalized)) {
    return 'lesson';
  }
  if (/^\/learning\/course\/[^/]+$/.test(normalized)) {
    return 'course';
  }
  if (normalized === '/learning') {
    return 'list';
  }

  return 'other';
}
