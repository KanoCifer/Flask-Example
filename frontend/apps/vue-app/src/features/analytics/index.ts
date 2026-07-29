// analytics 模块桶导出 — 对外公开 API
// 注意：AnalyticsView 是页面组件，由 router 直接导入，不通过桶导出（避免循环依赖）

export * from './components';
export { analyticsGateway } from '@readinglist/api';
export type { AnalyticsGateway } from '@readinglist/api';
export * from './types';
