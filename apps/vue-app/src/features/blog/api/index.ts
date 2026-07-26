// blog API 网关桶导出（blog/public 网关统一收口）

export { blogGateway } from './blogGateway';
export type { BlogGateway } from './blogGateway';

export { socialGateway } from './socialGateway';
export type { SocialGateway } from './socialGateway';

// 博客领域类型 —— 真源在 @/features/blog/types，桶重新导出以保持兼容
export type {
  BlogListResponse,
  BlogPostResponse,
  BlogQuery,
} from '@/features/blog/types';
