// ── @readinglist/utils ──────────────────────────────────────────────────────
// 跨前端共享的纯工具函数。框架无关，零 React/Vue 运行时依赖。
//
// 消费方通过 workspace: protocol 引入:
//   import { tokenService } from '@readinglist/utils';

export { tokenService } from './tokenService';
export { getVisitorId } from './visitorId';
export { collectVisitorData } from './visitorTrack';
export type { VisitorData } from './visitorTrack';
export { buildWsUrl } from './buildWsUrl';
export { COLOR_SCHEMES, isColorScheme } from './colorScheme';
export type { ColorScheme } from './colorScheme';
export { getCssVar, playThemeTransition } from './themeTransition';
export type { ThemeMode } from './themeTransition';
export { renderMarkdown } from './markdown';
export { formatDate } from './formatdate';
export { useOrigin, rewriteMediaUrl } from './origin';
export type { OriginConfig } from './origin';
export { WebSocketManager } from './websocket';
export type { WebSocketManagerOptions } from './websocket';
export { createSequencedTask } from './sequencedTask';
export type { SequencedResult } from './sequencedTask';
export { SHIMMER_TIPS } from './shimmerTips';
export { ToastQueue } from './toastQueue';
export type { ToastType, ToastItem, ToastListener } from './toastQueue';
// ── 领域纯函数（框架无关，按域聚合）──────────────────────────────────────────
export {
  cycleOptions,
  statusOptions,
  channelOptions,
  reminderPointOptions,
  currencySuggestions,
  getDefaultNextBillingDate,
  toDateInputValue,
  getMonthlyEstimate,
  getDaysUntil,
  getCycleLabel,
  formatPrice,
  upsertSubscription,
  toStringArray,
} from './domain/subscription';
export {
  exampleFeeds,
  truncateSummary,
  getFeedHost,
  getFeedProtocol,
  getSubscriptionTitle,
} from './domain/rss';
export type { ExampleFeed } from './domain/rss';
export { weatherIcon, formatDistance, formatDuration } from './domain/fishing';
// ── 订阅领域 DTO（真源 @readinglist/types，供表单映射函数引用）────────────────
export type {
  Subscription,
  CreateSubscriptionPayload,
  UpdateSubscriptionPayload,
} from '@readinglist/types';
export {
  applyThemeToDocument,
  applyFontToDocument,
  applySchemeToDocument,
  STORAGE_KEYS,
} from './theme';
export type { Theme, FontFamily } from './theme';
