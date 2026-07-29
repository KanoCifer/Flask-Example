// ── shimmerTips.ts ──────────────────────────────────────────────────────────
// 双端共享的 loading 提示文案轮播常量。框架无关。
//
// 从 Vue 端 `composables/useShimmerTips.ts` 与 React 端 `hooks/useShimmerTips.ts` 迁入，
// 两端各自保留响应式薄包装（Vue ref/watch vs React useState/useEffect），仅共享常量。

/** 轮播的 loading 提示文案，按显示顺序排列 */
export const SHIMMER_TIPS = [
  '分析文章结构…',
  '提取关键信息…',
  '生成总结内容…',
] as const;
