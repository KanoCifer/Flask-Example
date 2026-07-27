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
export { COLOR_SCHEMES, isColorScheme, safeScheme } from './colorScheme';
export type { ColorScheme } from './colorScheme';
export { getCssVar, playThemeTransition } from './themeTransition';
export type { ThemeMode } from './themeTransition';
export { renderMarkdown } from './markdown';
export { formatDate } from './formatdate';
export { useOrigin, rewriteMediaUrl } from './origin';
export type { OriginConfig } from './origin';
export { WebSocketManager } from './websocket';
export type { WebSocketManagerOptions } from './websocket';
