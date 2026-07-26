export { rssGateway } from './rssGateway';
export type { RssGateway } from './rssGateway';

export { subscriptionGateway } from './subscriptionGateway';
export type { SubscriptionGateway } from './subscriptionGateway';

// RSS 解析 / 订阅条目领域类型 —— 真源在 @readinglist/types，桶重新导出以保持兼容
export type {
  ParseRssPayload,
  ParseRssResponse,
  RefreshResult,
  RssEntry,
  SubscriptionItem,
} from '@readinglist/types';

// 订阅领域类型 —— 真源在 @/features/subscription/types，桶重新导出以保持兼容
export type {
  CreateSubscriptionPayload,
  Subscription,
  TestNotificationPayload,
  UpdateSubscriptionPayload,
} from '@/features/subscription/types';
