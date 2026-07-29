// RSS / 订阅网关 —— 真源 @readinglist/api
export { rssGateway } from '@readinglist/api';
export type { RssGateway } from '@readinglist/api';
export { subscriptionGateway } from '@readinglist/api';
export type { SubscriptionGateway } from '@readinglist/api';

// RSS 解析 / 订阅条目领域类型 —— 真源在 @readinglist/types
export type {
  ParseRssPayload,
  ParseRssResponse,
  RefreshResult,
  RssEntry,
  SubscriptionItem,
} from '@readinglist/types';

// 订阅领域类型 —— 真源在 @/features/subscription/types
export type {
  CreateSubscriptionPayload,
  Subscription,
  TestNotificationPayload,
  UpdateSubscriptionPayload,
} from '@/features/subscription/types';
